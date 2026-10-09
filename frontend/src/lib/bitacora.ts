import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import type { NextRequest } from 'next/server';
import { fechaHoraLocal, sesionUsuario } from '@/lib/apiHelpers';

export type TipoBitacora = 'CIERRE_DIARIO' | 'RESOLUCION_CIERRE' | 'ANULACION_FACTURA' | 'USUARIO' | 'RECUPERACION_CLAVE' | 'REAPERTURA_CIERRE' | 'DESCUENTO' | 'TASA_MANUAL';

export interface EventoBitacora {
  tipo: TipoBitacora;
  /** Fecha de la jornada a la que corresponde el hecho (YYYY-MM-DD). */
  fechaAfectada: string;
  descripcion: string;
  usuario: string;
  rol: string;
  detalle?: Record<string, unknown>;
}

let listo: Promise<void> | null = null;

/** Crea la bitácora si no existe (idempotente). */
export function asegurarBitacora(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bitacora (
          id SERIAL PRIMARY KEY,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
          tipo VARCHAR(40) NOT NULL,
          fecha_afectada DATE,
          a_destiempo BOOLEAN NOT NULL DEFAULT FALSE,
          usuario VARCHAR(100),
          rol VARCHAR(20),
          descripcion TEXT NOT NULL,
          detalle JSONB
        )`);
      await pool.query('CREATE INDEX IF NOT EXISTS ix_bitacora_creado ON bitacora (creado_en DESC)');
      await pool.query('ALTER TABLE bitacora ENABLE ROW LEVEL SECURITY'); // sin acceso por la API pública de Supabase
    })().catch((err) => { listo = null; throw err; });
  }
  return listo;
}

/** Usuario y rol de la sesión firmada (los pone proxy.ts). */
export function actorSesion(req: NextRequest): { usuario: string; rol: string } {
  return { usuario: sesionUsuario(req), rol: req.headers.get('x-session-role') ?? 'desconocido' };
}

/** Un hecho es "a destiempo" cuando corresponde a una jornada anterior a hoy. */
export const esADestiempo = (fechaAfectada: string): boolean => fechaAfectada.slice(0, 10) < fechaHoraLocal().fecha;

/** Registra el evento dentro de la misma transacción del hecho (si el hecho se revierte, el registro también). */
export async function registrarBitacora(client: Pick<PoolClient, 'query'>, e: EventoBitacora): Promise<void> {
  await asegurarBitacora();
  await client.query(
    `INSERT INTO bitacora (tipo, fecha_afectada, a_destiempo, usuario, rol, descripcion, detalle)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7)`,
    [e.tipo, e.fechaAfectada.slice(0, 10), esADestiempo(e.fechaAfectada), e.usuario, e.rol, e.descripcion, e.detalle ? JSON.stringify(e.detalle) : null],
  );
}
