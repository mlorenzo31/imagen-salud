import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { asegurarMedioTransito } from '@/lib/transito';
import { centsToNumber, toCents } from '@/lib/money';

/**
 * Lotes de punto de venta: los cobros con tarjeta de cada día (transacciones en tránsito) agrupados por fecha.
 * Incluye todo lo pendiente y lo conciliado de los últimos 90 días.
 */
export async function GET() {
  try {
    await asegurarMedioTransito(pool);
    const r = await pool.query(`
      SELECT to_char(fecha_transaccion, 'YYYY-MM-DD') AS fecha, medio,
             COUNT(*)::int AS cantidad,
             COALESCE(SUM(monto_bruto_bs), 0) AS bruto,
             COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::int AS pendientes,
             COALESCE(SUM(monto_bruto_bs) FILTER (WHERE estado = 'PENDIENTE'), 0) AS bruto_pendiente,
             COALESCE(SUM(monto_neto_acreditado_bs) FILTER (WHERE estado = 'CONCILIADO'), 0) AS neto,
             COALESCE(SUM(comision_bancaria_bs) FILTER (WHERE estado = 'CONCILIADO'), 0) AS comision,
             COALESCE(array_agg(id ORDER BY id) FILTER (WHERE estado = 'PENDIENTE'), '{}') AS ids_pendientes,
             MAX(referencia_bancaria) FILTER (WHERE estado = 'CONCILIADO') AS referencia,
             MAX(conciliado_por) FILTER (WHERE estado = 'CONCILIADO') AS conciliado_por
      FROM transacciones_tarjetas_transito
      WHERE estado IN ('PENDIENTE', 'CONCILIADO')
        AND (estado = 'PENDIENTE' OR fecha_transaccion >= CURRENT_DATE - 90)
      GROUP BY 1, 2
      ORDER BY 1 DESC, 2`);
    const lotes = r.rows.map((x) => ({
      fecha: x.fecha as string,
      medio: x.medio as string,
      cantidad: x.cantidad as number,
      bruto: centsToNumber(toCents(x.bruto)),
      pendientes: x.pendientes as number,
      bruto_pendiente: centsToNumber(toCents(x.bruto_pendiente)),
      neto: centsToNumber(toCents(x.neto)),
      comision: centsToNumber(toCents(x.comision)),
      ids_pendientes: x.ids_pendientes as number[],
      referencia: (x.referencia as string | null) ?? null,
      conciliado_por: (x.conciliado_por as string | null) ?? null,
      estado: (x.pendientes as number) > 0 ? 'PENDIENTE' : 'CONCILIADO',
    }));
    return NextResponse.json(lotes);
  } catch (err) {
    return errorResponse(err);
  }
}
