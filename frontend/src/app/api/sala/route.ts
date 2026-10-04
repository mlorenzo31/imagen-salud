import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { SELECT_SALA, sincronizarSala } from '@/lib/salaDb';

/** Turnos activos por servicio (cada estudio es un turno con su sala). */
export async function GET() {
  try {
    await sincronizarSala(pool);
    const { rows } = await pool.query(`${SELECT_SALA} ORDER BY s.retorno DESC, (f.prioridad = 'ALTA') DESC NULLS LAST, s.orden_cola, s.idx`);
    return NextResponse.json({ servicios: rows });
  } catch (err) {
    return errorResponse(err);
  }
}
