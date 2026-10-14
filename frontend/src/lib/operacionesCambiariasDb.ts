import pool from '@/lib/db';

let listo: Promise<void> | null = null;

/**
 * Prepara (idempotente) la venta de divisas y las transferencias: tipo/destino/neto en operaciones_cambiarias
 * y la tabla transferencias_cuentas. Se llama ANTES de abrir la transacción (el DDL no debe correr con filas bloqueadas).
 */
export function asegurarOperacionesCambiarias(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      // Consulta de catálogo, sin bloqueos: si ya está todo (RLS es el último paso), no se ejecuta DDL.
      const ya = await pool.query(
        `SELECT (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('transferencias_cuentas')) AS rls,
                EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'operaciones_cambiarias' AND column_name = 'monto_bs_neto') AS col`
      );
      if (ya.rows[0]?.rls === true && ya.rows[0]?.col === true) return;
      await pool.query(`ALTER TABLE operaciones_cambiarias
        ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) NOT NULL DEFAULT 'COMPRA',
        ADD COLUMN IF NOT EXISTS cuenta_destino_id INTEGER,
        ADD COLUMN IF NOT EXISTS monto_bs_neto NUMERIC`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transferencias_cuentas (
          id                SERIAL PRIMARY KEY,
          cuenta_origen_id  INTEGER NOT NULL,
          cuenta_destino_id INTEGER NOT NULL,
          monto             NUMERIC(14,2) NOT NULL CHECK (monto > 0),
          comision          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (comision >= 0),
          referencia        VARCHAR(100),
          notas             TEXT,
          fecha             DATE NOT NULL,
          usuario           VARCHAR(100),
          creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      await pool.query('ALTER TABLE transferencias_cuentas ENABLE ROW LEVEL SECURITY'); // sin acceso por la API pública de Supabase
    })().catch((err) => { listo = null; throw err; });
  }
  return listo;
}
