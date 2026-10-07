import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from '@/lib/auth';
import { verificarClave } from '@/lib/clave';
import pool from '@/lib/db';
import { buscarUsuario } from '@/lib/usuariosDb';
import type { ModoOperacion } from '@/types';

// Limitador en memoria por IP: 5 fallos / 15 min (suficiente para una instancia; usar Redis si se escala).
const intentos = new Map<string, { n: number; hasta: number }>();
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const BLOQUEO_USUARIO_MIN = 15;

async function iniciarSesion(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const estado = intentos.get(ip);
  if (estado && estado.hasta > Date.now() && estado.n >= MAX_FALLOS) {
    return NextResponse.json({ error: 'Demasiados intentos. Intente más tarde.' }, { status: 429 });
  }

  let body: { usuario?: unknown; clave?: unknown; modo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const usuario = typeof body.usuario === 'string' ? body.usuario.trim().toLowerCase() : '';
  const clave = typeof body.clave === 'string' ? body.clave : '';
  const modo: ModoOperacion = body.modo === 'vista' ? 'vista' : 'operador';
  if (!usuario || !clave) return NextResponse.json({ error: 'Ingrese usuario y clave.' }, { status: 400 });

  const fallar = () => {
    const vigente = estado && estado.hasta > Date.now() ? estado : { n: 0, hasta: Date.now() + VENTANA_MS };
    intentos.set(ip, { n: vigente.n + 1, hasta: vigente.hasta });
    return NextResponse.json({ error: 'Usuario o clave incorrectos.' }, { status: 401 });
  };

  const u = await buscarUsuario(usuario);
  if (!u || !u.activo) return fallar();
  if (u.bloqueado_hasta && new Date(u.bloqueado_hasta).getTime() > Date.now()) {
    return NextResponse.json({ error: `Usuario bloqueado por intentos fallidos. Intente en ${BLOQUEO_USUARIO_MIN} minutos o recupere su clave.` }, { status: 423 });
  }
  if (!verificarClave(clave, u.password_hash)) {
    await pool.query(
      `UPDATE cuentas_usuario SET intentos_fallidos = intentos_fallidos + 1,
              bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE bloqueado_hasta END
        WHERE id = $1`,
      [u.id, MAX_FALLOS, BLOQUEO_USUARIO_MIN],
    );
    return fallar();
  }
  intentos.delete(ip);
  await pool.query('UPDATE cuentas_usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1', [u.id]);

  const token = await signSession({ uid: u.id, role: u.rol, nombre: u.nombre, modo });
  const res = NextResponse.json({ role: u.rol, nombre: u.nombre, modo });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

export async function POST(request: NextRequest) {
  try {
    return await iniciarSesion(request);
  } catch (err) {
    console.error('Error en login:', err);
    return NextResponse.json({ error: 'No se pudo iniciar sesión por un error del servidor. Intente de nuevo.' }, { status: 500 });
  }
}
