import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal, parseBody, withTransaction } from '@/lib/apiHelpers';
import { hashClave, validarPoliticaClave } from '@/lib/clave';
import { actorSesion, registrarBitacora } from '@/lib/bitacora';
import { asegurarUsuarios } from '@/lib/usuariosDb';
import { normalizarTelefono } from '@/lib/whatsapp';

const ROLES = ['admin', 'asistente', 'cajero'] as const;
const COLUMNAS = 'id, usuario, nombre, rol, telefono, email, activo, bloqueado_hasta, to_char(creado_en, \'YYYY-MM-DD\') AS creado';

const telefono = z.string().trim().max(20).nullish().transform((v, ctx) => {
  if (!v) return null;
  const n = normalizarTelefono(v);
  if (!n) { ctx.addIssue({ code: 'custom', message: 'Teléfono inválido (ej. 04141234567).' }); return z.NEVER; }
  return n;
});
const email = z.string().trim().toLowerCase().max(120).email('Correo inválido.').nullish().or(z.literal('').transform(() => null));

const crearSchema = z.object({
  usuario: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, 'Usuario: 3 a 40 caracteres (letras, números, punto, guion).'),
  nombre: z.string().trim().min(3).max(100),
  rol: z.enum(ROLES),
  telefono,
  email,
  clave: z.string().min(1).max(100),
});

const editarSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string().trim().min(3).max(100).optional(),
  rol: z.enum(ROLES).optional(),
  telefono: telefono.optional(),
  email: email.optional(),
  activo: z.boolean().optional(),
  nuevaClave: z.string().min(1).max(100).optional(),
});

/** Gestión de usuarios (solo administrador; ver lib/auth.ts). Nunca se devuelve el hash. */
export async function GET() {
  try {
    await asegurarUsuarios();
    const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM usuarios ORDER BY activo DESC, rol, usuario`);
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await asegurarUsuarios();
    const b = await parseBody(req, crearSchema);
    const motivo = validarPoliticaClave(b.clave);
    if (motivo) throw new ApiError(400, motivo);
    const out = await withTransaction(async (client) => {
      const dup = await client.query('SELECT 1 FROM usuarios WHERE usuario = $1', [b.usuario]);
      if (dup.rowCount) throw new ApiError(409, 'Ya existe un usuario con ese nombre de acceso.');
      const r = await client.query(
        `INSERT INTO usuarios (usuario, nombre, rol, password_hash, telefono, email) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLUMNAS}`,
        [b.usuario, b.nombre, b.rol, hashClave(b.clave), b.telefono, b.email ?? null],
      );
      await registrarBitacora(client, {
        tipo: 'USUARIO', fechaAfectada: fechaHoraLocal().fecha, ...actorSesion(req),
        descripcion: `Usuario "${b.usuario}" creado con rol ${b.rol}.`,
      });
      return r.rows[0];
    });
    return NextResponse.json(out, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await asegurarUsuarios();
    const b = await parseBody(req, editarSchema);
    const yo = Number(req.headers.get('x-session-uid'));
    if (b.nuevaClave !== undefined) {
      const motivo = validarPoliticaClave(b.nuevaClave);
      if (motivo) throw new ApiError(400, motivo);
    }
    const out = await withTransaction(async (client) => {
      // Bloquea a los administradores activos para que dos cambios simultáneos no dejen el sistema sin ninguno.
      const admins = await client.query<{ id: number }>("SELECT id FROM usuarios WHERE rol = 'admin' AND activo ORDER BY id FOR UPDATE");
      const actual = await client.query<{ usuario: string; rol: string; activo: boolean }>('SELECT usuario, rol, activo FROM usuarios WHERE id = $1 FOR UPDATE', [b.id]);
      const u = actual.rows[0];
      if (!u) throw new ApiError(404, 'Usuario no encontrado.');
      const rolFinal = b.rol ?? u.rol;
      const activoFinal = b.activo ?? u.activo;
      if (b.id === yo && (!activoFinal || rolFinal !== 'admin')) throw new ApiError(409, 'No puede desactivarse ni quitarse el rol de administrador a sí mismo.');
      const quedaAdmin = admins.rows.filter((a) => a.id !== b.id).length + (rolFinal === 'admin' && activoFinal ? 1 : 0);
      if (quedaAdmin < 1) throw new ApiError(409, 'Debe quedar al menos un administrador activo.');

      const sets: string[] = [];
      const vals: unknown[] = [];
      const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
      if (b.nombre !== undefined) add('nombre', b.nombre);
      if (b.rol !== undefined) add('rol', b.rol);
      if (b.telefono !== undefined) add('telefono', b.telefono);
      if (b.email !== undefined) add('email', b.email);
      if (b.activo !== undefined) add('activo', b.activo);
      if (b.nuevaClave !== undefined) { add('password_hash', hashClave(b.nuevaClave)); sets.push('intentos_fallidos = 0', 'bloqueado_hasta = NULL'); }
      if (!sets.length) throw new ApiError(400, 'No hay cambios.');
      vals.push(b.id);
      const r = await client.query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING ${COLUMNAS}`, vals);
      const cambios = [b.nombre !== undefined && 'nombre', b.rol !== undefined && `rol→${b.rol}`, b.telefono !== undefined && 'teléfono', b.email !== undefined && 'correo',
        b.activo !== undefined && (b.activo ? 'activado' : 'desactivado'), b.nuevaClave !== undefined && 'clave restablecida'].filter(Boolean).join(', ');
      await registrarBitacora(client, {
        tipo: 'USUARIO', fechaAfectada: fechaHoraLocal().fecha, ...actorSesion(req),
        descripcion: `Usuario "${u.usuario}" modificado: ${cambios}.`,
      });
      return r.rows[0];
    });
    return NextResponse.json(out);
  } catch (err) {
    return errorResponse(err);
  }
}
