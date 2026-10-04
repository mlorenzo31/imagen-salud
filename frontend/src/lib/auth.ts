import type { ModoOperacion, UserRole } from '@/types';

export const SESSION_COOKIE = 'imagen_salud_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export interface SessionPayload {
  role: UserRole;
  nombre: string;
  modo: ModoOperacion;
  exp: number; // epoch segundos
}

const enc = new TextEncoder();

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET no definida o menor a 32 caracteres (ver .env.example).');
  }
  return secret;
}

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(getSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function signSession(data: Omit<SessionPayload, 'exp'>): Promise<string> {
  const payload: SessionPayload = { ...data, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey('sign'), enc.encode(body));
  return `${body}.${toB64Url(new Uint8Array(sig))}`;
}

const ROLES: readonly UserRole[] = ['admin', 'asistente', 'cajero'];

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey('verify'), fromB64Url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64Url(body))) as SessionPayload;
    if (!ROLES.includes(payload.role) || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Prefijos de API por rol. El admin tiene acceso total. */
const CAJERO_API = ['/api/facturas', '/api/pacientes', '/api/medicos', '/api/bcv', '/api/cierres/verificar-estado-diario', '/api/cierres/estado-jornada', '/api/catalogo', '/api/auth', '/api/whatsapp', '/api/sala'];
const SOLO_ADMIN = [
  '/api/tesoreria/cambio-divisa',
  '/api/tesoreria/conciliacion/ejecutar',
  '/api/tesoreria/honorarios/liquidar',
  '/api/admin',
  '/api/excel',
  '/api/cierres/ejecutar-cierre',
];

const matches = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(p + '/'));

export function isAllowed(role: UserRole, path: string, method: string = 'GET'): boolean {
  if (role === 'admin') return true;
  if (matches(path, SOLO_ADMIN)) return false;
  // El catálogo se consulta libremente, pero solo el administrador lo modifica.
  if (matches(path, ['/api/catalogo']) && method !== 'GET') return false;
  if (path === '/api/pacientes' && method === 'PUT') return false;
  if (role === 'cajero') return matches(path, CAJERO_API);
  // Asistente: lectura de tesorería permitida; cualquier escritura en tesorería queda reservada al admin.
  if (matches(path, ['/api/tesoreria']) && method !== 'GET') return false;
  return true;
}
