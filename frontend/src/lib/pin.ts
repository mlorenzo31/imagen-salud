import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { ApiError } from '@/lib/apiHelpers';
import type { UserRole } from '@/types';

export const PIN_ENV: Record<UserRole, string> = {
  admin: 'AUTH_PIN_ADMIN',
  asistente: 'AUTH_PIN_ASISTENTE',
  cajero: 'AUTH_PIN_CAJERO',
};

export function pinCoincide(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const fallos = new Map<string, { n: number; hasta: number }>();
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

/** Exige la clave de inicio de sesión del rol activo para acciones sensibles (p. ej. cerrar caja). */
export function exigirPinSesion(req: NextRequest, pin: unknown): void {
  const rol = req.headers.get('x-session-role') as UserRole | null;
  const clave = `${rol ?? ''}:${req.headers.get('x-session-user') ?? ''}`;
  const e = fallos.get(clave);
  if (e && e.hasta > Date.now() && e.n >= MAX_FALLOS) throw new ApiError(429, 'Demasiados intentos. Intente más tarde.');
  const esperado = rol && rol in PIN_ENV ? process.env[PIN_ENV[rol]] : undefined;
  if (!esperado) throw new ApiError(500, 'Servidor sin configurar la clave de este rol.');
  if (typeof pin !== 'string' || !pinCoincide(pin, esperado)) {
    const v = e && e.hasta > Date.now() ? e : { n: 0, hasta: Date.now() + VENTANA_MS };
    fallos.set(clave, { n: v.n + 1, hasta: v.hasta });
    throw new ApiError(401, 'Clave incorrecta.');
  }
  fallos.delete(clave);
}
