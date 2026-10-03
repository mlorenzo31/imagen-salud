import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from '@/lib/auth';
import type { ModoOperacion, UserRole } from '@/types';

const NOMBRES: Record<UserRole, string> = {
  admin: 'Dr. Director Médico',
  asistente: 'Lcda. Asistente Administrativo',
  cajero: 'Cajero(a) de Turno',
};
const PIN_ENV: Record<UserRole, string> = {
  admin: 'AUTH_PIN_ADMIN',
  asistente: 'AUTH_PIN_ASISTENTE',
  cajero: 'AUTH_PIN_CAJERO',
};

// Limitador en memoria por IP: 5 fallos / 15 min (suficiente para una instancia; usar Redis si se escala).
const intentos = new Map<string, { n: number; hasta: number }>();
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

function pinCoincide(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const estado = intentos.get(ip);
  if (estado && estado.hasta > Date.now() && estado.n >= MAX_FALLOS) {
    return NextResponse.json({ error: 'Demasiados intentos. Intente más tarde.' }, { status: 429 });
  }

  let body: { rol?: unknown; pin?: unknown; modo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const rol = body.rol as UserRole;
  if (!(rol in PIN_ENV)) return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 });
  const modo: ModoOperacion = body.modo === 'vista' ? 'vista' : 'operador';

  const esperado = process.env[PIN_ENV[rol]];
  if (!esperado) {
    return NextResponse.json({ error: `Servidor sin configurar (${PIN_ENV[rol]}).` }, { status: 500 });
  }

  const pin = typeof body.pin === 'string' ? body.pin : '';
  if (!pinCoincide(pin, esperado)) {
    const vigente = estado && estado.hasta > Date.now() ? estado : { n: 0, hasta: Date.now() + VENTANA_MS };
    intentos.set(ip, { n: vigente.n + 1, hasta: vigente.hasta });
    return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });
  }
  intentos.delete(ip);

  const token = await signSession({ role: rol, nombre: NOMBRES[rol], modo });
  const res = NextResponse.json({ role: rol, nombre: NOMBRES[rol], modo });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
