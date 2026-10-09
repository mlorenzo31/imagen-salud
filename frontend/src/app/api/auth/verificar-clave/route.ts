import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/apiHelpers';
import { exigirPinSesion } from '@/lib/pin';

/** Confirma la clave del usuario de la sesión (con bloqueo por intentos); la usa la pantalla antes de acciones sensibles. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await exigirPinSesion(req, body.pin);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
