import { ApiError } from '@/lib/apiHelpers';
import { verificarClave } from '@/lib/clave';
import { TOPE_DESCUENTO_CAJERO_BP } from '@/lib/descuento';
import { buscarUsuario } from '@/lib/usuariosDb';

export interface Autorizador { usuario: string; clave: string }

const fallos = new Map<string, { n: number; hasta: number }>();
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

/**
 * Un cajero no puede dar más del tope sin que un admin o asistente lo autorice con su usuario y clave.
 * Devuelve el usuario que autorizó, o null si no hizo falta autorización.
 */
export async function exigirAutorizacionDescuento(a: {
  rol: string; porcentajeBp: number; autorizador?: Autorizador | null; buscar?: typeof buscarUsuario;
}): Promise<string | null> {
  if (a.rol !== 'cajero' || a.porcentajeBp <= TOPE_DESCUENTO_CAJERO_BP) return null;
  const topePct = TOPE_DESCUENTO_CAJERO_BP / 100;
  const aut = a.autorizador;
  if (!aut || !aut.usuario?.trim() || !aut.clave) {
    throw new ApiError(403, `Un descuento mayor a ${topePct} % requiere la autorización de un administrador o asistente.`, 'DESCUENTO_REQUIERE_AUTORIZACION');
  }
  const llave = aut.usuario.trim().toLowerCase();
  const e = fallos.get(llave);
  if (e && e.hasta > Date.now() && e.n >= MAX_FALLOS) throw new ApiError(429, 'Demasiados intentos. Intente más tarde.');
  const cuenta = await (a.buscar ?? buscarUsuario)(aut.usuario);
  if (!cuenta || !cuenta.activo || !verificarClave(aut.clave, cuenta.password_hash)) {
    const v = e && e.hasta > Date.now() ? e : { n: 0, hasta: Date.now() + VENTANA_MS };
    fallos.set(llave, { n: v.n + 1, hasta: v.hasta });
    throw new ApiError(401, 'Usuario o clave del autorizador incorrectos.');
  }
  if (cuenta.rol !== 'admin' && cuenta.rol !== 'asistente') {
    throw new ApiError(403, 'Solo un administrador o asistente puede autorizar descuentos.');
  }
  fallos.delete(llave);
  return cuenta.usuario;
}
