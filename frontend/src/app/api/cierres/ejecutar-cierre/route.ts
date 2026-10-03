import { NextRequest, NextResponse } from 'next/server';
import { ApiError, errorResponse, fechaHoraLocal, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { consolidarCierre, evaluarDia } from '@/lib/cierre';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fechaIn = String(body.fecha || body.fecha_cierre || '');
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaIn) ? fechaIn : fechaHoraLocal().fecha;
    const usuario = sesionUsuario(req);
    const observaciones = typeof body.observaciones === 'string' && body.observaciones ? body.observaciones : 'Cierre auditado conforme';

    // No se cierra con pacientes en espera/atención ni con resultados pendientes de envío.
    const dia = await evaluarDia(fecha);
    if (dia.pacientesPendientes.length > 0) {
      throw new ApiError(400, `Aún existen pacientes pendientes de resolución para esta fecha (${dia.pacientesPendientes.length} pendientes).`);
    }
    if (dia.pacientesWhatsAppPendientes.length > 0) {
      throw new ApiError(400, `Hay ${dia.pacientesWhatsAppPendientes.length} resultado(s) pendientes de envío por WhatsApp para esta fecha.`);
    }

    const out = await withTransaction((client) => consolidarCierre(client, fecha, usuario, observaciones));
    return NextResponse.json({
      mensaje: 'Cierre diario consolidado exitosamente.',
      fecha_cierre: fecha,
      cierre: { ...out.fila, ...out.tot, usuario_responsable: usuario },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
