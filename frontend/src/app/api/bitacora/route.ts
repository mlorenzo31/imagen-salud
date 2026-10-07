import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { asegurarBitacora } from '@/lib/bitacora';

/** Bitácora de hechos administrativos (solo administrador; ver lib/auth.ts). */
export async function GET(req: NextRequest) {
  try {
    await asegurarBitacora();
    const sp = new URL(req.url).searchParams;
    const soloDestiempo = sp.get('destiempo') === '1';
    const limitParam = parseInt(sp.get('limit') || '200', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 200;
    const { rows } = await pool.query(
      `SELECT id, creado_en, tipo, to_char(fecha_afectada, 'YYYY-MM-DD') AS fecha_afectada, a_destiempo, usuario, rol, descripcion, detalle
         FROM bitacora ${soloDestiempo ? 'WHERE a_destiempo' : ''} ORDER BY creado_en DESC, id DESC LIMIT $1`,
      [limit],
    );
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}
