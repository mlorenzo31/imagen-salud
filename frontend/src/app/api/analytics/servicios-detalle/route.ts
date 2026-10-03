import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT d.*, f.fecha, f.nombre_paciente, f.cedula_paciente, f.tasa_bcv
      FROM facturas_servicios_detalle d
      JOIN facturas_caja f ON d.factura_id = f.id
      ORDER BY d.id DESC`);
    return NextResponse.json(result.rows);
  } catch (err) {
    return errorResponse(err);
  }
}
