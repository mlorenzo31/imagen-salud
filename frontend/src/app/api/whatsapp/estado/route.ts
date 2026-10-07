import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import { exigirPinSesion } from '@/lib/pin';
import pool from '@/lib/db';
import { asegurarTablasWhatsapp, leerEstadoBot } from '@/lib/whatsapp';

/** Estado del bot. El QR solo se entrega al administrador (vincula el número de la clínica). */
export async function GET(req: NextRequest) {
  try {
    const e = await leerEstadoBot(pool);
    const esAdmin = req.headers.get('x-session-role') === 'admin';
    return NextResponse.json({ ...e, qr: esAdmin ? e.qr : null });
  } catch (err) {
    return errorResponse(err);
  }
}

const Schema = z.object({ accion: z.enum(['DESVINCULAR', 'REVINCULAR']), pin: z.string().min(1) });

/**
 * Vincula o desvincula el WhatsApp de la clínica desde el sistema (solo administrador, con su clave).
 * DESVINCULAR cierra la sesión en el teléfono y deja un QR nuevo; REVINCULAR descarta la sesión y pide un QR nuevo
 * (útil si se quitó la vinculación desde el teléfono). El bot atiende la orden en pocos segundos.
 */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-session-role') !== 'admin') throw new ApiError(403, 'Solo el administrador puede vincular o desvincular WhatsApp.');
    const b = await parseBody(req, Schema);
    await exigirPinSesion(req, b.pin);
    await asegurarTablasWhatsapp(pool);
    const e = await leerEstadoBot(pool);
    if (e.estado === 'APAGADO') throw new ApiError(409, 'El bot de WhatsApp no está en ejecución en el equipo de la clínica. Inícielo (npm start en whatsapp-worker) y vuelva a intentar.', 'BOT_APAGADO');
    await pool.query('UPDATE wa_estado SET comando = $1 WHERE id = 1', [b.accion]);
    return NextResponse.json({ ok: true, mensaje: b.accion === 'DESVINCULAR' ? 'Desvinculando… en unos segundos aparecerá un QR nuevo.' : 'Generando un QR nuevo…' });
  } catch (err) {
    return errorResponse(err);
  }
}
