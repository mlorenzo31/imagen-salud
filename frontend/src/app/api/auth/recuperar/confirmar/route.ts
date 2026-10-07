import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal, parseBody } from '@/lib/apiHelpers';
import { codigoCoincide, hashClave, validarPoliticaClave } from '@/lib/clave';
import { buscarUsuario } from '@/lib/usuariosDb';
import { registrarBitacora } from '@/lib/bitacora';
import { CODIGO_MAX_INTENTOS } from '@/lib/recuperacion';

const schema = z.object({
  usuario: z.string().trim().min(1).max(40),
  codigo: z.string().trim().regex(/^\d{6}$/, 'El código tiene 6 dígitos.'),
  clave: z.string().min(1).max(100),
});

const porIp = new Map<string, { n: number; hasta: number }>();

/** Paso 2: valida el código (vigente, máx. 5 intentos, un solo uso) y fija la nueva clave. */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    const e = porIp.get(ip);
    if (e && e.hasta > Date.now() && e.n >= 10) throw new ApiError(429, 'Demasiados intentos. Intente más tarde.');
    porIp.set(ip, e && e.hasta > Date.now() ? { n: e.n + 1, hasta: e.hasta } : { n: 1, hasta: Date.now() + 15 * 60 * 1000 });

    const { usuario, codigo, clave } = await parseBody(req, schema);
    const motivo = validarPoliticaClave(clave);
    if (motivo) throw new ApiError(400, motivo);

    const invalido = new ApiError(400, 'Código inválido o vencido. Solicite uno nuevo.');
    const u = await buscarUsuario(usuario);
    if (!u || !u.activo) throw invalido;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query<{ id: number; codigo_hash: string; intentos: number }>(
        `SELECT id, codigo_hash, intentos FROM recuperacion_clave
          WHERE usuario_id = $1 AND NOT usado AND expira > now() ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [u.id],
      );
      const fila = r.rows[0];
      if (!fila || fila.intentos >= CODIGO_MAX_INTENTOS) throw invalido;
      if (!codigoCoincide(codigo, u.id, fila.codigo_hash)) {
        await client.query('UPDATE recuperacion_clave SET intentos = intentos + 1 WHERE id = $1', [fila.id]);
        await client.query('COMMIT');
        throw invalido;
      }
      await client.query('UPDATE recuperacion_clave SET usado = TRUE WHERE id = $1', [fila.id]);
      await client.query('UPDATE usuarios SET password_hash = $2, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1', [u.id, hashClave(clave)]);
      await registrarBitacora(client, {
        tipo: 'RECUPERACION_CLAVE', fechaAfectada: fechaHoraLocal().fecha, usuario: u.nombre, rol: u.rol,
        descripcion: `${u.nombre} (${u.usuario}) restableció su clave con un código enviado por WhatsApp.`,
      });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    return NextResponse.json({ ok: true, mensaje: 'Clave actualizada. Ya puede iniciar sesión.' });
  } catch (err) {
    return errorResponse(err);
  }
}
