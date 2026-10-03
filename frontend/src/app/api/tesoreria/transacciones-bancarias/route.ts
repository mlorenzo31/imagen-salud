import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cuenta_id = searchParams.get('cuenta_id');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const tipo = searchParams.get('tipo');
    const es_comision = searchParams.get('es_comision');

    let q = `
      SELECT t.*, c.nombre as cuenta_nombre, c.codigo as cuenta_codigo
      FROM transacciones_bancarias t
      JOIN cuentas_bancarias c ON t.cuenta_id = c.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (cuenta_id) { params.push(parseInt(cuenta_id)); q += ' AND t.cuenta_id = $' + params.length; }
    if (desde) { params.push(desde); q += ' AND t.fecha >= $' + params.length; }
    if (hasta) { params.push(hasta); q += ' AND t.fecha <= $' + params.length; }
    if (tipo) { params.push(tipo); q += ' AND t.tipo_transaccion = $' + params.length; }
    if (es_comision !== null && es_comision !== undefined) { 
      params.push(es_comision === 'true'); 
      q += ' AND t.es_comision = $' + params.length; 
    }
    q += ' ORDER BY t.id DESC LIMIT 100';

    const result = await pool.query(q, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    return errorResponse(err);
  }
}
