import type { Pool, PoolClient } from 'pg';

type Db = Pick<Pool | PoolClient, 'query'>;

let listo: Promise<void> | null = null;

/**
 * Devoluciones de facturas anuladas pagadas con punto de venta o pago móvil: la anulación solo las registra
 * (PENDIENTE) y la salida del dinero se hace después como egreso validado.
 */
export function asegurarDevoluciones(db: Db): Promise<void> {
  if (!listo) {
    listo = db.query(`
      CREATE TABLE IF NOT EXISTS devoluciones_facturas (
        id SERIAL PRIMARY KEY,
        factura_id INTEGER NOT NULL,
        medio VARCHAR(20) NOT NULL,
        cuenta_codigo VARCHAR(50) NOT NULL,
        monto_bs NUMERIC(14,2) NOT NULL CHECK (monto_bs > 0),
        afecta_cuenta BOOLEAN NOT NULL DEFAULT TRUE,
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
        egreso_id INTEGER,
        referencia VARCHAR(100),
        creado_en TIMESTAMPTZ DEFAULT now(),
        pagada_en TIMESTAMPTZ,
        pagada_por VARCHAR(100),
        UNIQUE (factura_id, medio)
      )`).then(() => undefined).catch((err) => { listo = null; throw err; });
  }
  return listo;
}

/** Registra (idempotente) la devolución pendiente de un cobro. afectaCuenta=false si el dinero nunca llegó a la cuenta. */
export async function registrarDevolucion(db: Db, facturaId: number, medio: string, cuentaCodigo: string, montoBs: string, afectaCuenta: boolean): Promise<void> {
  await asegurarDevoluciones(db);
  await db.query(
    `INSERT INTO devoluciones_facturas (factura_id, medio, cuenta_codigo, monto_bs, afecta_cuenta) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (factura_id, medio) DO NOTHING`,
    [facturaId, medio, cuentaCodigo, montoBs, afectaCuenta],
  );
}
