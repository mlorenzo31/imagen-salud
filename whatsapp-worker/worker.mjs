// Bot de WhatsApp (Baileys). Debe ejecutarse en un equipo siempre encendido.
// Lee la cola wa_outbox, envía los resultados (y campañas) y marca facturas_caja.whatsapp_enviado.
// Uso: DATABASE_URL=... APP_URL=https://tu-sistema.vercel.app node worker.mjs   (ver README.md)
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { rmSync } from 'node:fs';
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
const jitterCampana = () => 20000 + Math.floor(Math.random() * 20000); // 20–40 s entre mensajes de campaña
const VERSION = 2; // 2 = campañas (espaciado, tope diario y bajas)
const MAX_CAMPANA_DIA = Number(process.env.WA_MAX_CAMPANA_DIA ?? 150); // tope de mensajes de campaña por día

async function asegurarTablas() {
  await db.query(`CREATE TABLE IF NOT EXISTS wa_estado (id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), estado TEXT NOT NULL DEFAULT 'APAGADO', qr TEXT, numero TEXT, latido TIMESTAMPTZ)`);
  await db.query(`CREATE TABLE IF NOT EXISTS wa_outbox (id SERIAL PRIMARY KEY, factura_id INT NOT NULL, telefono TEXT NOT NULL, mensaje TEXT NOT NULL, adjunto_url TEXT, adjunto_nombre TEXT, token TEXT, estado TEXT NOT NULL DEFAULT 'PENDIENTE', intentos INT NOT NULL DEFAULT 0, error TEXT, creado TIMESTAMPTZ NOT NULL DEFAULT now(), enviado TIMESTAMPTZ)`);
  await db.query(`ALTER TABLE wa_outbox ADD COLUMN IF NOT EXISTS token TEXT`);
  await db.query(`CREATE INDEX IF NOT EXISTS wa_outbox_pend_idx ON wa_outbox (estado, id)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS wa_outbox_factura_uk ON wa_outbox (factura_id) WHERE estado IN ('PENDIENTE','ENVIANDO','ENVIADO')`);
  await db.query(`ALTER TABLE wa_estado ADD COLUMN IF NOT EXISTS comando TEXT`);
  await db.query(`ALTER TABLE wa_estado ADD COLUMN IF NOT EXISTS version INT`);
  await db.query(`ALTER TABLE wa_outbox ALTER COLUMN factura_id DROP NOT NULL`);
  await db.query(`ALTER TABLE wa_outbox ADD COLUMN IF NOT EXISTS campana_id INT`);
  await db.query(`CREATE TABLE IF NOT EXISTS wa_baja (telefono TEXT PRIMARY KEY, creado TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await db.query(`INSERT INTO wa_estado (id) VALUES (1) ON CONFLICT DO NOTHING`);
}

let estado = 'CONECTANDO';
let qr = null;
let numero = null;
let sock = null;

async function publicar() {
  await db.query(`UPDATE wa_estado SET estado = $1, qr = $2, numero = $3, latido = now(), version = $4 WHERE id = 1`, [estado, qr, numero, VERSION]).catch((e) => console.error('latido', e.message));
}

let generacion = 0; // cada conexión nueva invalida los eventos de la anterior

/** Borra la sesión guardada y abre una conexión limpia: genera un QR nuevo para vincular otro dispositivo. */
async function reiniciarVinculo(cerrarSesion) {
  generacion++;
  estado = 'CONECTANDO'; qr = null; numero = null;
  await publicar();
  try {
    if (cerrarSesion && sock) await sock.logout();
  } catch (e) { console.error('logout', e.message); }
  try { sock?.end?.(undefined); } catch { /* ya cerrado */ }
  rmSync('./auth', { recursive: true, force: true });
  await conectar();
}

async function conectar() {
  const mia = ++generacion;
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger: log, browser: ['Imagen Salud', 'Chrome', '1.0'], markOnlineOnConnect: false });
  sock.ev.on('creds.update', saveCreds);
  // Baja de campañas: el paciente responde BAJA/STOP y no vuelve a recibir mensajes promocionales.
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue;
        const texto = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
        if (!/^(baja|stop|no m[aá]s)$/i.test(texto)) continue;
        const jid = msg.key.senderPn || msg.key.remoteJidAlt || msg.key.remoteJid || '';
        if (!jid.endsWith('@s.whatsapp.net')) { console.warn('BAJA recibida desde un identificador no resoluble:', jid); continue; }
        const t10 = jid.split('@')[0].replace(/\D/g, '').slice(-10);
        await db.query(`INSERT INTO wa_baja (telefono) VALUES ($1) ON CONFLICT DO NOTHING`, [t10]);
        await db.query(`UPDATE wa_outbox SET estado = 'FALLIDO', error = 'Baja solicitada' WHERE estado = 'PENDIENTE' AND factura_id IS NULL AND right(telefono, 10) = $1`, [t10]);
        await sock.sendMessage(jid, { text: 'Listo, no recibirá más mensajes promocionales de Imagen Salud. Sus resultados médicos se seguirán enviando con normalidad.' });
        console.log('Baja registrada:', t10);
      } catch (e) { console.error('baja', e.message); }
    }
  });
  sock.ev.on('connection.update', async (u) => {
    if (mia !== generacion) return; // evento de una conexión ya reemplazada
    if (u.qr) {
      qr = await QRCode.toDataURL(u.qr, { width: 320, margin: 1 });
      estado = 'ESPERANDO_QR';
      console.log('Escanea el QR desde el sistema (chip "WhatsApp").');
    }
    if (u.connection === 'open') {
      estado = 'CONECTADO'; qr = null; numero = sock.user?.id?.split(':')[0] ?? null;
      console.log('WhatsApp conectado:', numero);
    }
    if (u.connection === 'close') {
      const codigo = u.lastDisconnect?.error?.output?.statusCode;
      console.log('Conexión cerrada', codigo ?? '');
      if (codigo === DisconnectReason.loggedOut) {
        // Se quitó la vinculación desde el teléfono: se limpia la sesión y se ofrece un QR nuevo, sin intervención manual.
        console.log('Sesión cerrada desde el teléfono: generando un QR nuevo.');
        await reiniciarVinculo(false).catch((e) => console.error(e));
        return;
      }
      estado = 'CONECTANDO'; qr = null;
      await publicar();
      setTimeout(() => { if (mia === generacion) conectar().catch((e) => console.error(e)); }, 3000);
      return;
    }
    await publicar();
  });
}

/** Órdenes desde el sistema (administrador): DESVINCULAR cierra la sesión del teléfono; REVINCULAR pide un QR nuevo. */
async function atenderComandos() {
  const { rows } = await db.query(`WITH previo AS (SELECT comando FROM wa_estado WHERE id = 1 AND comando IS NOT NULL FOR UPDATE)
     UPDATE wa_estado SET comando = NULL FROM previo WHERE wa_estado.id = 1 RETURNING previo.comando`);
  const c = rows[0]?.comando;
  if (c === 'DESVINCULAR') await reiniciarVinculo(true);
  else if (c === 'REVINCULAR') await reiniciarVinculo(false);
}

const { APP_URL } = process.env;

/** Archivos del enlace de resultados (la web de la clínica los sirve por token). */
async function archivosDe(m) {
  if (!m.token) return [];
  // La URL viene en la cola (la fija el sistema); APP_URL solo se usa para filas antiguas sin URL.
  const base = m.adjunto_url || (APP_URL ? APP_URL.replace(/\/$/, '') + '/api/resultados/' + m.token : null);
  if (!base) return [];
  const r = await fetch(base);
  if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) {
    throw new Error('El sistema no entregó el listado de resultados (' + r.status + '). Si pide acceso de Vercel, desactive la protección del despliegue de producción.');
  }
  const { archivos } = await r.json();
  const out = [];
  for (const a of archivos) {
    const f = await fetch(base + '/' + a.id + '?descargar=1');
    if (!f.ok) throw new Error('No se pudo descargar ' + a.nombre + ' (' + f.status + ')');
    out.push({ nombre: a.nombre, tipo: a.tipo, buffer: Buffer.from(await f.arrayBuffer()) });
  }
  return out;
}

async function procesarCola() {
  for (;;) {
    if (estado !== 'CONECTADO' || !sock) return;
    // Resultados primero; las campañas solo mientras no se alcance el tope diario (el resto sigue al día siguiente).
    const { rows: [hoy] } = await db.query(
      `SELECT COUNT(*)::int AS n FROM wa_outbox WHERE factura_id IS NULL AND estado = 'ENVIADO'
          AND (enviado AT TIME ZONE 'America/Caracas')::date = (now() AT TIME ZONE 'America/Caracas')::date`);
    const permitirCampana = hoy.n < MAX_CAMPANA_DIA;
    const { rows } = await db.query(
      `UPDATE wa_outbox SET estado = 'ENVIANDO', intentos = intentos + 1
        WHERE id = (SELECT id FROM wa_outbox WHERE estado = 'PENDIENTE' AND (factura_id IS NOT NULL OR $1::boolean)
                     ORDER BY (factura_id IS NULL), id FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING *`, [permitirCampana]);
    const m = rows[0];
    if (!m) return;
    try {
      const jid = m.telefono + '@s.whatsapp.net';
      if (m.factura_id === null) {
        const baja = await db.query(`SELECT 1 FROM wa_baja WHERE telefono = right($1, 10)`, [m.telefono]);
        if (baja.rowCount) {
          await db.query(`UPDATE wa_outbox SET estado = 'FALLIDO', error = 'Baja solicitada' WHERE id = $1`, [m.id]);
          continue;
        }
      }
      const [chk] = await sock.onWhatsApp(jid);
      if (!chk?.exists) throw new Error('El número no tiene WhatsApp');
      if (m.factura_id === null) { // campaña: solo texto, sin tocar facturas
        await sock.sendMessage(jid, { text: m.mensaje });
        await db.query(`UPDATE wa_outbox SET estado = 'ENVIADO', enviado = now(), error = NULL WHERE id = $1`, [m.id]);
        console.log('Campaña enviada', m.campana_id, m.telefono);
        await pausa(jitterCampana());
        continue;
      }
      const archivos = await archivosDe(m); // se descargan antes de enviar nada: si falla, no queda a medias
      await sock.sendMessage(jid, { text: m.mensaje });
      for (const a of archivos) {
        await pausa(1500);
        if (a.tipo.startsWith('image/')) await sock.sendMessage(jid, { image: a.buffer, mimetype: a.tipo, caption: a.nombre });
        else await sock.sendMessage(jid, { document: a.buffer, mimetype: a.tipo, fileName: a.nombre });
      }
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
      console.error('Fallo', m.factura_id ?? 'campaña ' + m.campana_id, e.message);
    }
    await pausa(jitter());
  }
}

await asegurarTablas();
// Mensajes que quedaron "ENVIANDO" por una caída vuelven a la cola (la verificación de unicidad evita duplicar facturas).
await db.query(`UPDATE wa_outbox SET estado = 'PENDIENTE' WHERE estado = 'ENVIANDO'`);
await conectar();
setInterval(() => { void publicar(); }, 20000);
let atendiendo = false;
setInterval(async () => {
  if (atendiendo) return;
  atendiendo = true;
  try { await atenderComandos(); } catch (e) { console.error('comando', e.message); } finally { atendiendo = false; }
}, 3000);
let ocupado = false;
setInterval(async () => {
  if (ocupado) return;
  ocupado = true;
  try { await procesarCola(); } catch (e) { console.error('cola', e.message); } finally { ocupado = false; }
}, 5000);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => { estado = 'APAGADO'; qr = null; await publicar(); process.exit(0); });
