import type { Pool, PoolClient } from 'pg';

type Db = Pick<Pool | PoolClient, 'query'>;

/** Segundos sin latido tras los cuales el bot se considera apagado. */
export const LATIDO_MAX_SEG = 90;

/** Normaliza a formato internacional sin '+' (Venezuela por defecto). null si no es válido. */
export function normalizarTelefono(crudo: string | null | undefined): string | null {
  const d = (crudo ?? '').replace(/\D/g, '');
  if (/^0\d{10}$/.test(d)) return '58' + d.slice(1);
  if (/^\d{10}$/.test(d)) return '58' + d;
  if (/^58\d{10}$/.test(d)) return d;
  if (/^[1-9]\d{10,14}$/.test(d)) return d;
  return null;
}

export function construirMensaje(nombre: string, estudio: string, adjunto: string | null, enlace?: string | null): string {
  const doc = adjunto ? `\n📎 *Documento adjunto:* ${adjunto}` : '';
  const link = enlace ? `\n\n🔗 Ver y descargar sus resultados:\n${enlace}` : '';
  return (
    '🏥 *IMAGEN SALUD - Notificación de Resultados*\n\n' +
    `Estimado(a) *${nombre}*:\n` +
    `Le informamos que los resultados de su estudio *${estudio || 'médico'}* ya están listos y validados.${doc}${link}\n\n` +
    '_Centro Clínico Imagen Salud, C.A._'
  );
}

/** Tablas propias del bot (idempotente). Prefijo wa_ para no chocar con tablas heredadas. */
export async function asegurarTablasWhatsapp(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS wa_estado (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      estado TEXT NOT NULL DEFAULT 'APAGADO',
      qr TEXT,
      numero TEXT,
      latido TIMESTAMPTZ
    )`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS wa_outbox (
      id SERIAL PRIMARY KEY,
      factura_id INT NOT NULL,
      telefono TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      adjunto_url TEXT,
      adjunto_nombre TEXT,
      token TEXT,
      estado TEXT NOT NULL DEFAULT 'PENDIENTE',
      intentos INT NOT NULL DEFAULT 0,
      error TEXT,
      creado TIMESTAMPTZ NOT NULL DEFAULT now(),
      enviado TIMESTAMPTZ
    )`);
  await db.query(`ALTER TABLE wa_estado ADD COLUMN IF NOT EXISTS comando TEXT`);
  await db.query(`INSERT INTO wa_estado (id) VALUES (1) ON CONFLICT DO NOTHING`);
  await db.query(`ALTER TABLE wa_outbox ADD COLUMN IF NOT EXISTS token TEXT`);
  await db.query(`CREATE INDEX IF NOT EXISTS wa_outbox_pend_idx ON wa_outbox (estado, id)`);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS wa_outbox_factura_uk ON wa_outbox (factura_id)
    WHERE estado IN ('PENDIENTE','ENVIANDO','ENVIADO')`);
}

export interface EstadoBot {
  activo: boolean;
  estado: string;
  qr: string | null;
  numero: string | null;
  pendientes: number;
}

export async function leerEstadoBot(db: Db): Promise<EstadoBot> {
  await asegurarTablasWhatsapp(db);
  const e = await db.query(
    `SELECT estado, qr, numero, (latido IS NOT NULL AND latido > now() - make_interval(secs => $1)) AS vivo FROM wa_estado WHERE id = 1`,
    [LATIDO_MAX_SEG],
  );
  const p = await db.query(`SELECT COUNT(*)::int AS n FROM wa_outbox WHERE estado IN ('PENDIENTE','ENVIANDO')`);
  const row = e.rows[0] as { estado: string; qr: string | null; numero: string | null; vivo: boolean } | undefined;
  const vivo = Boolean(row?.vivo);
  return {
    activo: vivo && row?.estado === 'CONECTADO',
    estado: vivo ? row!.estado : 'APAGADO',
    qr: vivo ? row!.qr : null,
    numero: row?.numero ?? null,
    pendientes: p.rows[0].n as number,
  };
}
