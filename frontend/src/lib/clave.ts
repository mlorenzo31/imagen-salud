import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

const N = 16384;
const LARGO = 64;

export const CLAVE_MIN = 8;

/** Contraseña con scrypt y sal propia: `scrypt$sal$hash` (base64). Solo para el servidor Node. */
export function hashClave(clave: string): string {
  const sal = randomBytes(16);
  const h = scryptSync(clave, sal, LARGO, { N });
  return `scrypt$${sal.toString('base64')}$${h.toString('base64')}`;
}

export function verificarClave(clave: string, guardado: string): boolean {
  const [alg, sal, hash] = guardado.split('$');
  if (alg !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const h = scryptSync(clave, Buffer.from(sal, 'base64'), esperado.length, { N });
  return h.length === esperado.length && timingSafeEqual(h, esperado);
}

/** Devuelve el motivo si la clave no cumple la política, o null si es válida. */
export function validarPoliticaClave(clave: string): string | null {
  if (clave.length < CLAVE_MIN) return `La clave debe tener al menos ${CLAVE_MIN} caracteres.`;
  if (clave.length > 100) return 'La clave es demasiado larga.';
  if (!/[A-Za-z]/.test(clave) || !/\d/.test(clave)) return 'La clave debe combinar letras y números.';
  return null;
}

/** Código numérico de 6 dígitos para recuperar la clave. */
export const generarCodigo = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** El código se guarda con HMAC (nunca en claro). */
export function hashCodigo(codigo: string, usuarioId: number): string {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto || secreto.length < 32) throw new Error('AUTH_SECRET no definida o menor a 32 caracteres.');
  return createHmac('sha256', secreto).update(`${usuarioId}:${codigo}`).digest('hex');
}

export function codigoCoincide(codigo: string, usuarioId: number, guardado: string): boolean {
  const a = Buffer.from(hashCodigo(codigo, usuarioId));
  const b = Buffer.from(guardado);
  return a.length === b.length && timingSafeEqual(a, b);
}
