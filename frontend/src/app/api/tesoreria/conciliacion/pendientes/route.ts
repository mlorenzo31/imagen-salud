import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { asegurarMedioTransito } from '@/lib/transito';
import { centsToNumber, toCents } from '@/lib/money';

export async function GET() {
  try {
    await asegurarMedioTransito(pool);
    const result = await pool.query(`
      SELECT * FROM transacciones_tarjetas_transito
      WHERE estado = 'PENDIENTE'
      ORDER BY fecha_transaccion ASC, id ASC`);
    const totalCents = result.rows.reduce((acc, r) => acc + toCents(r.monto_bruto_bs), 0);
    return NextResponse.json({
      totalPendienteBs: centsToNumber(totalCents),
      cantidadPendiente: result.rows.length,
      transacciones: result.rows,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
