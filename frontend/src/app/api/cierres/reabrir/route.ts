import { NextRequest, NextResponse } from 'next/server';
import { ApiError, errorResponse, withTransaction } from '@/lib/apiHelpers';
import { reabrirCierre } from '@/lib/cierre';
import { exigirPinSesion } from '@/lib/pin';
import { actorSesion, registrarBitacora } from '@/lib/bitacora';

/** Reabre una caja ya cerrada (solo administrador, con clave y motivo). El día vuelve a quedar pendiente de cierre. */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-session-role') !== 'admin') throw new ApiError(403, 'Solo el administrador puede reabrir una caja cerrada.');
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await exigirPinSesion(req, body.pin);
    const fecha = String(body.fecha ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ApiError(400, 'Fecha inválida.');
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : '';
    if (motivo.length < 10) throw new ApiError(400, 'Explique el motivo de la reapertura (mínimo 10 caracteres).');

    await withTransaction(async (client) => {
      const actor = actorSesion(req);
      await reabrirCierre(client, fecha, motivo, actor.usuario);
      await registrarBitacora(client, {
        tipo: 'REAPERTURA_CIERRE', fechaAfectada: fecha, ...actor,
        descripcion: `Se reabrió la caja del ${fecha}. Motivo: ${motivo}`,
        detalle: { motivo },
      });
    });
    return NextResponse.json({ mensaje: `Caja del ${fecha} reabierta. Debe cerrarse de nuevo.`, fecha });
  } catch (err) {
    return errorResponse(err);
  }
}
