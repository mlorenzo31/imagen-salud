import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import pool from '@/lib/db';
import { asegurarTablasAdjuntos, tokenDe, urlApiResultados, urlResultados } from '@/lib/adjuntos';
import { construirMensaje, leerEstadoBot, normalizarTelefono } from '@/lib/whatsapp';

const Schema = z.object({
  factura_ids: z.array(z.number().int().positive()).min(1).max(200),
  telefono: z.string().max(50).optional(),
});

interface FilaFactura {
  id: number;
  nombre_paciente: string | null;
  estudio: string | null;
  telefono_paciente: string | null;
  adjunto_nombre: string | null;
  whatsapp_enviado: boolean | null;
  archivos: number;
}

/**
 * Encola resultados para el bot de WhatsApp (mensaje con enlace + archivos). Si el bot está apagado
 * responde modo "manual" con el enlace de cada factura para armar el mensaje wa.me; no escribe en la cola.
 */
export async function POST(req: NextRequest) {
  try {
    const { factura_ids, telefono } = await parseBody(req, Schema);
    const bot = await leerEstadoBot(pool);
    await asegurarTablasAdjuntos(pool);

    const { rows } = await pool.query<FilaFactura>(
      `SELECT f.id, f.nombre_paciente, f.estudio, f.telefono_paciente, f.adjunto_nombre, f.whatsapp_enviado,
              (SELECT COUNT(*)::int FROM factura_adjuntos a WHERE a.factura_id = f.id) AS archivos
         FROM facturas_caja f WHERE f.id = ANY($1::int[])`,
      [factura_ids],
    );
    if (rows.length === 0) throw new ApiError(404, 'Facturas no encontradas.');

    const origen = req.nextUrl.origin;
    const enlaces: Record<number, string> = {};
    const tokens: Record<number, string> = {};
    for (const f of rows) {
      if (f.archivos > 0) {
        tokens[f.id] = await tokenDe(pool, f.id);
        enlaces[f.id] = urlResultados(origen, tokens[f.id]);
      }
    }
    if (!bot.activo) return NextResponse.json({ modo: 'manual', encolados: 0, omitidos: [], enlaces });

    let encolados = 0;
    const omitidos: { id: number; motivo: string }[] = [];
    for (const f of rows) {
      if (f.whatsapp_enviado) { omitidos.push({ id: f.id, motivo: 'Ya enviado' }); continue; }
      if (!f.adjunto_nombre) { omitidos.push({ id: f.id, motivo: 'Sin adjunto' }); continue; }
      const tel = normalizarTelefono(telefono && factura_ids.length === 1 ? telefono : f.telefono_paciente);
      if (!tel) { omitidos.push({ id: f.id, motivo: 'Teléfono inválido' }); continue; }
      const r = await pool.query(
        `INSERT INTO wa_outbox (factura_id, telefono, mensaje, adjunto_nombre, token, adjunto_url)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [f.id, tel, construirMensaje(f.nombre_paciente ?? '', f.estudio ?? '', f.adjunto_nombre, enlaces[f.id]), f.adjunto_nombre, tokens[f.id] ?? null, tokens[f.id] ? urlApiResultados(origen, tokens[f.id]) : null],
      );
      if (r.rowCount) encolados++; else omitidos.push({ id: f.id, motivo: 'Ya en cola' });
    }
    return NextResponse.json({ modo: 'bot', encolados, omitidos, enlaces });
  } catch (err) {
    return errorResponse(err);
  }
}
