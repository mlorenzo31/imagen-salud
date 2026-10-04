import type { Pool, PoolClient } from 'pg';
import { ApiError } from '@/lib/apiHelpers';

/** Medios cuyo cobro queda "en tránsito" hasta cerrar el día y conciliarlo con el banco; el resto se acredita al facturar. */
export const MEDIOS_TRANSITO = {
  PUNTO: { cuenta: 'PUNTO_VENTA_BS', etiqueta: 'Punto de venta', tipoMovimiento: 'CONCILIACION_TARJETA' },
  PAGO_MOVIL: { cuenta: 'PAGO_MOVIL_BS', etiqueta: 'Pago móvil', tipoMovimiento: 'CONCILIACION_PAGO_MOVIL' },
} as const;
export type MedioTransito = keyof typeof MEDIOS_TRANSITO;
export const medioValido = (m: unknown): MedioTransito => (m === 'PAGO_MOVIL' ? 'PAGO_MOVIL' : 'PUNTO');

let listo: Promise<void> | null = null;

/**
 * Garantiza (idempotente) la columna que distingue el medio de cada cobro en tránsito; lo existente queda como PUNTO.
 * Primero consulta el catálogo (sin bloqueos) y solo altera la tabla si falta; si no puede, dice exactamente por qué.
 */
export function asegurarMedioTransito(db: Pick<Pool | PoolClient, 'query'>): Promise<void> {
  if (!listo) {
    listo = (async () => {
      const r = await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'transacciones_tarjetas_transito' AND column_name = 'medio'");
      if (r.rows.length > 0) return;
      try {
        await db.query("ALTER TABLE transacciones_tarjetas_transito ADD COLUMN IF NOT EXISTS medio VARCHAR(20) NOT NULL DEFAULT 'PUNTO'");
      } catch (err) {
        console.error('No se pudo agregar transacciones_tarjetas_transito.medio:', err);
        throw new ApiError(500, `No se pudo preparar el registro de pagos en tránsito (${err instanceof Error ? err.message : 'error de base de datos'}).`);
      }
    })().catch((err) => { listo = null; throw err; });
  }
  return listo;
}
