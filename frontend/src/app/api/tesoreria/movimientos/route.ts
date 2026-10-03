import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const values: string[] = [];
    let query = `
      SELECT m.*, c.nombre as cuenta_nombre, c.codigo as cuenta_codigo
      FROM movimientos_tesoreria m
      JOIN cuentas_bancarias c ON m.cuenta_id = c.id
      WHERE 1=1`;
    const filtros: [string, string][] = [['desde', 'm.fecha >='], ['hasta', 'm.fecha <='], ['cuenta_id', 'm.cuenta_id ='], ['tipo', 'm.tipo =']];
    for (const [param, cond] of filtros) {
      const v = sp.get(param);
      if (v) {
        values.push(v);
        query += ` AND ${cond} $${values.length}`;
      }
    }
    query += ' ORDER BY m.id DESC';
    const result = await pool.query(query, values);
    return NextResponse.json(result.rows);
  } catch (err) {
    return errorResponse(err);
  }
}
