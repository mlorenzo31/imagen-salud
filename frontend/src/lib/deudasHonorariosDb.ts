import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { centsToNumber, centsToStr } from '@/lib/money';
import { claveMedico, exigirSaldoValido, saldoDeuda, type TipoMovDeuda } from '@/lib/deudasHonorarios';

let listo: Promise<void> | null = null;

/** Crea (idempotente) el libro de deudas de honorarios. */
export function asegurarDeudasHonorarios(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      // Consulta de catálogo, sin bloqueos: si la tabla ya existe con RLS (el último paso), no se ejecuta DDL.
      const ya = await pool.query("SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('deudas_honorarios')");
      if (ya.rows[0]?.relrowsecurity === true) return;
      await pool.query(`
        CREATE TABLE IF NOT EXISTS deudas_honorarios (
          id                SERIAL PRIMARY KEY,
          medico            TEXT NOT NULL,
          tipo              VARCHAR(20)  NOT NULL CHECK (tipo IN ('CARGO', 'ABONO_LIQUIDACION', 'ABONO_DEVOLUCION')),
          monto_usd         NUMERIC(12,2) NOT NULL CHECK (monto_usd > 0),
          honorario_id      INTEGER,
          factura_id        INTEGER,
          pago_honorario_id INTEGER,
          movimiento_id     INTEGER,
          descripcion       TEXT,
          usuario           VARCHAR(100),
          fecha             DATE NOT NULL,
          creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS deudas_honorarios_cargo_unico ON deudas_honorarios (honorario_id) WHERE tipo = 'CARGO'");
      await pool.query('CREATE INDEX IF NOT EXISTS deudas_honorarios_medico ON deudas_honorarios (upper(trim(medico)))');
      await pool.query('ALTER TABLE deudas_honorarios ENABLE ROW LEVEL SECURITY'); // sin acceso por la API pública de Supabase
    })().catch((err) => { listo = null; throw err; });
  }
  return listo;
}

/** Toma el candado del médico (hasta el fin de la transacción) y devuelve su deuda en centavos. */
export async function bloquearYSaldo(client: PoolClient, medico: string): Promise<number> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('deuda:' || upper(trim($1))))", [medico]);
  const r = await client.query('SELECT tipo, monto_usd FROM deudas_honorarios WHERE upper(trim(medico)) = upper(trim($1))', [medico]);
  return exigirSaldoValido(saldoDeuda(r.rows));
}

export interface MovDeuda {
  medico: string; tipo: TipoMovDeuda; cents: number; fecha: string; usuario: string; descripcion: string;
  honorarioId?: number; facturaId?: number; pagoHonorarioId?: number; movimientoId?: number;
}

/** Registra un movimiento; un honorario solo genera un CARGO (índice único), así que repetir no duplica. */
export async function registrarMovDeuda(client: PoolClient, m: MovDeuda): Promise<void> {
  if (m.cents <= 0) return;
  await client.query(
    `INSERT INTO deudas_honorarios (medico, tipo, monto_usd, honorario_id, factura_id, pago_honorario_id, movimiento_id, descripcion, usuario, fecha)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
    [m.medico, m.tipo, centsToStr(m.cents), m.honorarioId ?? null, m.facturaId ?? null, m.pagoHonorarioId ?? null,
     m.movimientoId ?? null, m.descripcion, m.usuario, m.fecha]
  );
}

export interface MovDeudaFila {
  id: number; tipo: TipoMovDeuda; monto_usd: string; fecha: string; descripcion: string | null; usuario: string | null;
  factura_id: number | null; pago_honorario_id: number | null;
}
export interface DeudaMedico { medico: string; saldoUsd: number; movimientos: MovDeudaFila[] }

/** Deudas agrupadas por médico (solo los que tienen movimientos), con el nombre del movimiento más reciente. */
export async function deudasPorMedico(medico?: string): Promise<DeudaMedico[]> {
  await asegurarDeudasHonorarios();
  const r = await pool.query(
    `SELECT id, medico, tipo, monto_usd::text AS monto_usd, to_char(fecha, 'YYYY-MM-DD') AS fecha, descripcion, usuario, factura_id, pago_honorario_id
     FROM deudas_honorarios ${medico ? 'WHERE upper(trim(medico)) = upper(trim($1))' : ''}
     ORDER BY creado_en DESC, id DESC`,
    medico ? [medico] : []
  );
  const grupos = new Map<string, DeudaMedico>();
  for (const f of r.rows) {
    const k = claveMedico(f.medico);
    if (!grupos.has(k)) grupos.set(k, { medico: f.medico, saldoUsd: 0, movimientos: [] });
    grupos.get(k)!.movimientos.push({
      id: f.id, tipo: f.tipo, monto_usd: f.monto_usd, fecha: f.fecha, descripcion: f.descripcion, usuario: f.usuario,
      factura_id: f.factura_id, pago_honorario_id: f.pago_honorario_id,
    });
  }
  for (const g of grupos.values()) g.saldoUsd = centsToNumber(saldoDeuda(g.movimientos));
  return [...grupos.values()];
}
