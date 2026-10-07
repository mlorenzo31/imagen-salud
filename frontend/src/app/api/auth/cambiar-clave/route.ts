import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import { hashClave, validarPoliticaClave } from '@/lib/clave';
import { exigirPinSesion } from '@/lib/pin';

const schema = z.object({ actual: z.string().min(1).max(100), nueva: z.string().min(1).max(100) });

/** El usuario cambia su propia clave (exige la actual). */
export async function POST(req: NextRequest) {
  try {
    const b = await parseBody(req, schema);
    const motivo = validarPoliticaClave(b.nueva);
    if (motivo) throw new ApiError(400, motivo);
    await exigirPinSesion(req, b.actual);
    await pool.query('UPDATE usuarios SET password_hash = $2 WHERE id = $1', [Number(req.headers.get('x-session-uid')), hashClave(b.nueva)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
