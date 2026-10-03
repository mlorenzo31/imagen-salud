import { NextResponse, type NextRequest } from 'next/server';
import type { PoolClient } from 'pg';
import type { ZodType } from 'zod';
import pool from '@/lib/db';

/** Usuario autenticado, tomado del encabezado que establece proxy.ts a partir de la sesión firmada. */
export function sesionUsuario(request: NextRequest): string {
  const raw = request.headers.get('x-session-user');
  try {
    return raw ? decodeURIComponent(raw) : 'Sistema';
  } catch {
    return 'Sistema';
  }
}

export function fechaHoraLocal(): { fecha: string; hora: string } {
  const now = new Date();
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(now);
  const hora = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
  return { fecha, hora };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function parseBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError(400, 'Cuerpo JSON inválido.');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'cuerpo'}: ${i.message}`).join('; ');
    throw new ApiError(400, msg);
  }
  return parsed.data;
}

/** Ejecuta `fn` dentro de una transacción; ApiError → su status, otros errores → 500 sin filtrar detalles internos. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(err);
  return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
}
