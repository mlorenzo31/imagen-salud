import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const values: string[] = [];
    let query = `
      SELECT h.*, f.tasa_bcv
      FROM honorarios_medicos_pendientes h
      JOIN facturas_caja f ON h.factura_id = f.id
      WHERE h.estado = 'PENDIENTE'`;
    const medico = sp.get('medico');
    if (medico && medico !== 'TODOS') {
      values.push(medico);
      query += ` AND h.medico = $${values.length}`;
    }
    const filtros: [string, string][] = [['fecha', '='], ['fecha_desde', '>='], ['fecha_hasta', '<=']];
    for (const [param, op] of filtros) {
      const v = sp.get(param);
      if (v) {
        values.push(v);
        query += ` AND h.fecha_servicio ${op} $${values.length}`;
      }
    }
    query += ' ORDER BY h.fecha_servicio ASC, h.id ASC';
    const result = await pool.query(query, values);
    return NextResponse.json(result.rows);
  } catch (err) {
    return errorResponse(err);
  }
}
