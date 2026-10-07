import type { NextRequest } from 'next/server';
import { ApiError } from '@/lib/apiHelpers';
import { verificarClave } from '@/lib/clave';
import { buscarUsuarioPorId } from '@/lib/usuariosDb';

const fallos = new Map<string, { n: number; hasta: number }>();
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

/** Exige la contraseña del usuario de la sesión para acciones sensibles (p. ej. cerrar caja). */
export async function exigirPinSesion(req: NextRequest, pin: unknown, buscar = buscarUsuarioPorId): Promise<void> {
  const uid = Number(req.headers.get('x-session-uid'));
  const clave = `uid:${uid}`;
  const e = fallos.get(clave);
  if (e && e.hasta > Date.now() && e.n >= MAX_FALLOS) throw new ApiError(429, 'Demasiados intentos. Intente más tarde.');
  const u = Number.isInteger(uid) && uid > 0 ? await buscar(uid) : null;
  if (!u || !u.activo) throw new ApiError(401, 'Sesión no válida. Inicie sesión de nuevo.');
  if (typeof pin !== 'string' || !pin || !verificarClave(pin, u.password_hash)) {
    const v = e && e.hasta > Date.now() ? e : { n: 0, hasta: Date.now() + VENTANA_MS };
    fallos.set(clave, { n: v.n + 1, hasta: v.hasta });
    throw new ApiError(401, 'Clave incorrecta.');
  }
  fallos.delete(clave);
}
