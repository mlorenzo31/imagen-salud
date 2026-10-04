import type { Pool, PoolClient } from 'pg';

/** Medios cuyo cobro queda "en tránsito" hasta cerrar el día y conciliarlo con el banco; el resto se acredita al facturar. */
export const MEDIOS_TRANSITO = {
  PUNTO: { cuenta: 'PUNTO_VENTA_BS', etiqueta: 'Punto de venta', tipoMovimiento: 'CONCILIACION_TARJETA' },
  PAGO_MOVIL: { cuenta: 'PAGO_MOVIL_BS', etiqueta: 'Pago móvil', tipoMovimiento: 'CONCILIACION_PAGO_MOVIL' },
} as const;
export type MedioTransito = keyof typeof MEDIOS_TRANSITO;
export const medioValido = (m: unknown): MedioTransito => (m === 'PAGO_MOVIL' ? 'PAGO_MOVIL' : 'PUNTO');

let listo: Promise<void> | null = null;

/** Agrega (idempotente) la columna que distingue el medio de cada cobro en tránsito. Lo existente queda como PUNTO. */
export function asegurarMedioTransito(db: Pick<Pool | PoolClient, 'query'>): Promise<void> {
  if (!listo) {
    listo = db.query("ALTER TABLE transacciones_tarjetas_transito ADD COLUMN IF NOT EXISTS medio VARCHAR(20) NOT NULL DEFAULT 'PUNTO'")
      .then(() => undefined)
      .catch((err) => { listo = null; throw err; });
  }
  return listo;
}
