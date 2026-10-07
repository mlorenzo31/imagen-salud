import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import { generarCodigo, hashCodigo } from '@/lib/clave';
import { buscarUsuario } from '@/lib/usuariosDb';
import { asegurarTablasWhatsapp, normalizarTelefono } from '@/lib/whatsapp';
import { CODIGO_VIGENCIA_MIN, MENSAJE_GENERICO, VERSION_WORKER_SISTEMA, mensajeCodigo } from '@/lib/recuperacion';

const schema = z.object({ usuario: z.string().trim().min(1).max(40) });

// Por IP: 5 solicitudes por hora (el código solo se envía al WhatsApp registrado del usuario).
const porIp = new Map<string, { n: number; hasta: number }>();

/** Paso 1 de "Olvidé mi clave": envía un código de 6 dígitos al WhatsApp registrado. La respuesta no revela si el usuario existe. */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    const e = porIp.get(ip);
    if (e && e.hasta > Date.now() && e.n >= 5) throw new ApiError(429, 'Demasiadas solicitudes. Intente más tarde.');
    porIp.set(ip, e && e.hasta > Date.now() ? { n: e.n + 1, hasta: e.hasta } : { n: 1, hasta: Date.now() + 60 * 60 * 1000 });

    const { usuario } = await parseBody(req, schema);

    await asegurarTablasWhatsapp(pool);
    const bot = await pool.query<{ version: number | null; vivo: boolean; estado: string }>(
      `SELECT version, estado, (latido IS NOT NULL AND latido > now() - interval '90 seconds') AS vivo FROM wa_estado WHERE id = 1`,
    );
    const b = bot.rows[0];
    if (!b?.vivo || b.estado !== 'CONECTADO' || (b.version ?? 1) < VERSION_WORKER_SISTEMA) {
      throw new ApiError(503, 'La recuperación por WhatsApp no está disponible en este momento. Solicite a un administrador que restablezca su clave.');
    }

    const u = await buscarUsuario(usuario);
    const tel = normalizarTelefono(u?.telefono);
    if (u && u.activo && tel) {
      const reciente = await pool.query(`SELECT 1 FROM recuperacion_clave WHERE usuario_id = $1 AND creado_en > now() - interval '60 seconds'`, [u.id]);
      if (!reciente.rowCount) {
        const codigo = generarCodigo();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('UPDATE recuperacion_clave SET usado = TRUE WHERE usuario_id = $1 AND NOT usado', [u.id]);
          await client.query(
            `INSERT INTO recuperacion_clave (usuario_id, codigo_hash, expira) VALUES ($1, $2, now() + make_interval(mins => $3))`,
            [u.id, hashCodigo(codigo, u.id), CODIGO_VIGENCIA_MIN],
          );
          // Mensaje del sistema: sin factura ni campaña (el bot lo envía primero y de inmediato).
          await client.query(`INSERT INTO wa_outbox (factura_id, telefono, mensaje, estado) VALUES (NULL, $1, $2, 'PENDIENTE')`, [tel, mensajeCodigo(codigo)]);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      }
    }
    return NextResponse.json({ ok: true, mensaje: MENSAJE_GENERICO });
  } catch (err) {
    return errorResponse(err);
  }
}
