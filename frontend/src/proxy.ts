import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, isAllowed, verifySession } from '@/lib/auth';

const PUBLICAS = ['/api/auth/login', '/api/bcv'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLICAS.includes(pathname)) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  if (!isAllowed(session.role, pathname, request.method)) {
    return NextResponse.json({ error: 'Acceso denegado para su rol.' }, { status: 403 });
  }

  // El rol se propaga solo desde la sesión firmada; se descarta cualquier valor enviado por el cliente.
  const headers = new Headers(request.headers);
  headers.delete('x-user-rol');
  headers.delete('x-user-role');
  headers.set('x-session-role', session.role);
  headers.set('x-session-user', encodeURIComponent(session.nombre));
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: '/api/:path*' };
