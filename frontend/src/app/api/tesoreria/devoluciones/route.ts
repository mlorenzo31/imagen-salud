import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { asegurarDevoluciones } from '@/lib/devoluciones';

/** Devoluciones de facturas anuladas (pendientes primero) con datos de la factura. */
export async function GET() {
  try {
    await asegurarDevoluciones(pool);
    const r = await pool.query(`
      SELECT d.id, d.factura_id, d.medio, d.cuenta_codigo, d.monto_bs, d.afecta_cuenta, d.estado, d.referencia, d.pagada_por, d.pagada_en,
             f.nombre_paciente, f.cedula_paciente, f.turno_num
      FROM devoluciones_facturas d LEFT JOIN facturas_caja f ON f.id = d.factura_id
      ORDER BY (d.estado = 'PENDIENTE') DESC, d.id DESC LIMIT 100`);
    return NextResponse.json(r.rows);
  } catch (err) {
    return errorResponse(err);
  }
}
