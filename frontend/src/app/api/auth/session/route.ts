import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const s = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  return NextResponse.json({ role: s.role, nombre: s.nombre, modo: s.modo });
}
