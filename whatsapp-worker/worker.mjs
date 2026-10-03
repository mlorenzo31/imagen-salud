// Bot de WhatsApp (Baileys). Debe ejecutarse en un equipo siempre encendido.
// Lee la cola wa_outbox, envía los resultados y marca facturas_caja.whatsapp_enviado.
// Uso: DATABASE_URL=... node worker.mjs   (ver README.md)
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pg from 'pg';
import pino from 'pino';
import QRCode from 'qrcode';

const { DATABASE_URL, DATABASE_SSL } = process.env;
if (!DATABASE_URL) { console.error('Falta DATABASE_URL'); process.exit(1); }

const db = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 3,
});
const log = pino({ level: 'warn' });
const MAX_INTENTOS = 3;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 4000 + Math.floor(Math.random() * 5000); // 4–9 s entre mensajes (anti-bloqueo)

async function asegurarTablas() {
  await db.query(`CREATE TABLE IF NOT EXISTS wa_estado (id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), estado TEXT NOT NULL DEFAULT 'APAGADO', qr TEXT, numero TEXT, latido TIMESTAMPTZ)`);
  await db.query(`CREATE TABLE IF NOT EXISTS wa_outbox (id SERIAL PRIMARY KEY, factura_id INT NOT NULL, telefono TEXT NOT NULL, mensaje TEXT NOT NULL, adjunto_url TEXT, adjunto_nombre TEXT, estado TEXT NOT NULL DEFAULT 'PENDIENTE', intentos INT NOT NULL DEFAULT 0, error TEXT, creado TIMESTAMPTZ NOT NULL DEFAULT now(), enviado TIMESTAMPTZ)`);
  await db.query(`CREATE INDEX IF NOT EXISTS wa_outbox_pend_idx ON wa_outbox (estado, id)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS wa_outbox_factura_uk ON wa_outbox (factura_id) WHERE estado IN ('PENDIENTE','ENVIANDO','ENVIADO')`);
  await db.query(`INSERT INTO wa_estado (id) VALUES (1) ON CONFLICT DO NOTHING`);
}

let estado = 'CONECTANDO';
let qr = null;
let numero = null;
let sock = null;

async function publicar() {
  await db.query(`UPDATE wa_estado SET estado = $1, qr = $2, numero = $3, latido = now() WHERE id = 1`, [estado, qr, numero]).catch((e) => console.error('latido', e.message));
}

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger: log, browser: ['Imagen Salud', 'Chrome', '1.0'], markOnlineOnConnect: false });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    if (u.qr) {
      qr = await QRCode.toDataURL(u.qr, { width: 320, margin: 1 });
      estado = 'ESPERANDO_QR';
      console.log('Escanea el QR desde el sistema (chip "Vincular WhatsApp").');
    }
    if (u.connection === 'open') {
      estado = 'CONECTADO'; qr = null; numero = sock.user?.id?.split(':')[0] ?? null;
      console.log('WhatsApp conectado:', numero);
    }
    if (u.connection === 'close') {
      const codigo = u.lastDisconnect?.error?.output?.statusCode;
      const sesionCerrada = codigo === DisconnectReason.loggedOut;
      estado = 'CONECTANDO'; qr = null;
      console.log('Conexión cerrada', codigo ?? '');
      if (sesionCerrada) {
        console.error('Sesión cerrada desde el teléfono. Borra la carpeta ./auth y reinicia para vincular de nuevo.');
        estado = 'APAGADO'; await publicar(); process.exit(1);
      }
      setTimeout(() => conectar().catch((e) => console.error(e)), 3000);
    }
    await publicar();
  });
}

async function adjuntoDe(m) {
  if (!m.adjunto_url || !/^https?:\/\//i.test(m.adjunto_url)) return null;
  const r = await fetch(m.adjunto_url);
  if (!r.ok) throw new Error('No se pudo descargar el adjunto (' + r.status + ')');
  return { buffer: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') ?? 'application/octet-stream' };
}

async function procesarCola() {
  for (;;) {
    if (estado !== 'CONECTADO' || !sock) return;
    const { rows } = await db.query(
      `UPDATE wa_outbox SET estado = 'ENVIANDO', intentos = intentos + 1
        WHERE id = (SELECT id FROM wa_outbox WHERE estado = 'PENDIENTE' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING *`);
    const m = rows[0];
    if (!m) return;
    try {
      const jid = m.telefono + '@s.whatsapp.net';
      const [chk] = await sock.onWhatsApp(jid);
      if (!chk?.exists) throw new Error('El número no tiene WhatsApp');
      const adj = await adjuntoDe(m);
      if (adj) await sock.sendMessage(jid, { document: adj.buffer, mimetype: adj.mime, fileName: m.adjunto_nombre ?? 'resultado', caption: m.mensaje });
      else await sock.sendMessage(jid, { text: m.mensaje });
      const c = await db.connect();
      try {
        await c.query('BEGIN');
        await c.query(`UPDATE wa_outbox SET estado = 'ENVIADO', enviado = now(), error = NULL WHERE id = $1`, [m.id]);
        await c.query(`UPDATE facturas_caja SET whatsapp_enviado = TRUE, whatsapp_fecha_envio = now(), telefono_paciente = COALESCE(NULLIF(telefono_paciente, ''), $2) WHERE id = $1`, [m.factura_id, m.telefono]);
        await c.query('COMMIT');
      } catch (err) { await c.query('ROLLBACK').catch(() => {}); throw err; } finally { c.release(); }
      console.log('Enviado factura', m.factura_id);
    } catch (e) {
      const definitivo = /no tiene whatsapp/i.test(e.message) || m.intentos >= MAX_INTENTOS;
      await db.query(`UPDATE wa_outbox SET estado = $2, error = $3 WHERE id = $1`, [m.id, definitivo ? 'FALLIDO' : 'PENDIENTE', String(e.message).slice(0, 300)]);
      console.error('Fallo factura', m.factura_id, e.message);
    }
    await pausa(jitter());
  }
}

await asegurarTablas();
// Mensajes que quedaron "ENVIANDO" por una caída vuelven a la cola (la verificación de unicidad evita duplicar facturas).
await db.query(`UPDATE wa_outbox SET estado = 'PENDIENTE' WHERE estado = 'ENVIANDO'`);
await conectar();
setInterval(() => { void publicar(); }, 20000);
let ocupado = false;
setInterval(async () => {
  if (ocupado) return;
  ocupado = true;
  try { await procesarCola(); } catch (e) { console.error('cola', e.message); } finally { ocupado = false; }
}, 5000);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => { estado = 'APAGADO'; qr = null; await publicar(); process.exit(0); });
