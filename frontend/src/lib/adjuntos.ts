import { randomBytes, randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '@/lib/apiHelpers';

type Db = Pick<Pool | PoolClient, 'query'>;

export const BUCKET = 'resultados';
/** Vercel limita el cuerpo de una función a 4,5 MB; el cliente comprime las imágenes antes de subir. */
export const MAX_BYTES = 4 * 1024 * 1024;
export const TIPOS_PERMITIDOS: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const extension = (nombre: string) => nombre.split('.').pop()?.toLowerCase() ?? '';

export function nombreSeguro(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'archivo';
}

export function resumenAdjuntos(nombres: string[]): string | null {
  if (nombres.length === 0) return null;
  return nombres.length === 1 ? nombres[0] : `${nombres.length} archivos`;
}

export async function asegurarTablasAdjuntos(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS factura_adjuntos (
      id SERIAL PRIMARY KEY,
      factura_id INT NOT NULL,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL,
      tamano INT NOT NULL DEFAULT 0,
      ruta TEXT NOT NULL,
      creado TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await db.query(`CREATE INDEX IF NOT EXISTS factura_adjuntos_factura_idx ON factura_adjuntos (factura_id)`);
  await db.query(`ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS adjunto_token TEXT`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS facturas_caja_adjunto_token_uk ON facturas_caja (adjunto_token) WHERE adjunto_token IS NOT NULL`);
}

/** Enlace público (no adivinable) de los resultados de una factura; se crea una sola vez. */
export async function tokenDe(db: Db, facturaId: number): Promise<string> {
  await db.query(`UPDATE facturas_caja SET adjunto_token = $2 WHERE id = $1 AND adjunto_token IS NULL`, [facturaId, randomBytes(18).toString('base64url')]);
  const r = await db.query(`SELECT adjunto_token FROM facturas_caja WHERE id = $1`, [facturaId]);
  if (!r.rows[0]?.adjunto_token) throw new ApiError(404, 'Factura no encontrada.');
  return r.rows[0].adjunto_token as string;
}

let cliente: SupabaseClient | null = null;
let bucketListo = false;

export async function almacen() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new ApiError(503, 'Almacenamiento de archivos no configurado (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).', 'ALMACEN_NO_CONFIGURADO');
  }
  cliente ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!bucketListo) {
    const { error } = await cliente.storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists|duplicate/i.test(error.message)) throw new ApiError(502, 'No se pudo preparar el almacenamiento: ' + error.message);
    bucketListo = true;
  }
  return cliente.storage.from(BUCKET);
}

export const nuevaRuta = (facturaId: number, nombre: string) => `${facturaId}/${randomUUID()}-${nombreSeguro(nombre)}`;

/**
 * Base pública de los enlaces. Prioriza APP_URL y luego el dominio de producción de Vercel
 * (las URLs de despliegue/preview suelen exigir inicio de sesión en Vercel; la de producción no).
 */
export function baseUrl(origen: string): string {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.APP_URL ?? (prod ? `https://${prod}` : origen)).replace(/\/$/, '');
}

export const urlResultados = (origen: string, token: string) => `${baseUrl(origen)}/resultados/${token}`;
export const urlApiResultados = (origen: string, token: string) => `${baseUrl(origen)}/api/resultados/${token}`;
