import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';

export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM cuentas_bancarias ORDER BY id ASC');
    return NextResponse.json(result.rows);
  } catch (err) {
    return errorResponse(err);
  }
}
