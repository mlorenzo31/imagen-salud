import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/apiHelpers';
import pool from '@/lib/db';
import { leerEstadoBot } from '@/lib/whatsapp';

/** Estado del bot. El QR solo se entrega al administrador (vincula el número de la clínica). */
export async function GET(req: NextRequest) {
  try {
    const e = await leerEstadoBot(pool);
    const esAdmin = req.headers.get('x-session-role') === 'admin';
    return NextResponse.json({ ...e, qr: esAdmin ? e.qr : null });
  } catch (err) {
    return errorResponse(err);
  }
}
