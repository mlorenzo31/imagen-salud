import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import pool from '@/lib/db';
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
  adjunto_url: string | null;
  whatsapp_enviado: boolean | null;
}

/**
 * Encola resultados para el bot de WhatsApp. Si el bot está apagado responde modo "manual"
 * (el cliente conserva el enlace wa.me como respaldo) sin escribir nada.
 */
export async function POST(req: NextRequest) {
  try {
    const { factura_ids, telefono } = await parseBody(req, Schema);
    const bot = await leerEstadoBot(pool);
    if (!bot.activo) return NextResponse.json({ modo: 'manual', encolados: 0, omitidos: [] });

    const { rows } = await pool.query<FilaFactura>(
      `SELECT id, nombre_paciente, estudio, telefono_paciente, adjunto_nombre, adjunto_url, whatsapp_enviado
         FROM facturas_caja WHERE id = ANY($1::int[])`,
      [factura_ids],
    );
    if (rows.length === 0) throw new ApiError(404, 'Facturas no encontradas.');

    let encolados = 0;
    const omitidos: { id: number; motivo: string }[] = [];
    for (const f of rows) {
      if (f.whatsapp_enviado) { omitidos.push({ id: f.id, motivo: 'Ya enviado' }); continue; }
      if (!f.adjunto_nombre) { omitidos.push({ id: f.id, motivo: 'Sin adjunto' }); continue; }
      const tel = normalizarTelefono(telefono && factura_ids.length === 1 ? telefono : f.telefono_paciente);
      if (!tel) { omitidos.push({ id: f.id, motivo: 'Teléfono inválido' }); continue; }
      const r = await pool.query(
        `INSERT INTO wa_outbox (factura_id, telefono, mensaje, adjunto_url, adjunto_nombre)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [f.id, tel, construirMensaje(f.nombre_paciente ?? '', f.estudio ?? '', f.adjunto_nombre), f.adjunto_url, f.adjunto_nombre],
      );
      if (r.rowCount) encolados++; else omitidos.push({ id: f.id, motivo: 'Ya en cola' });
    }
    return NextResponse.json({ modo: 'bot', encolados, omitidos });
  } catch (err) {
    return errorResponse(err);
  }
}
