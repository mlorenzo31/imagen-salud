import { NextRequest, NextResponse } from 'next/server';
import { ApiError, errorResponse, fechaHoraLocal, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { consolidarCierre, evaluarDia, leerConteo } from '@/lib/cierre';
import { centsToStr } from '@/lib/money';
import { exigirPinSesion } from '@/lib/pin';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    exigirPinSesion(req, body.pin);
    const fechaIn = String(body.fecha || body.fecha_cierre || '');
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaIn) ? fechaIn : fechaHoraLocal().fecha;
    const usuario = sesionUsuario(req);
    const observaciones = typeof body.observaciones === 'string' && body.observaciones ? body.observaciones : 'Cierre auditado conforme';

    const conteo = leerConteo(body.arqueo);

    // No se cierra con pacientes en espera/atención ni con resultados pendientes de envío.
    const dia = await evaluarDia(fecha);
    if (dia.pacientesPendientes.length > 0) {
      throw new ApiError(400, `Aún existen pacientes pendientes de resolución para esta fecha (${dia.pacientesPendientes.length} pendientes).`);
    }
    if (dia.pacientesWhatsAppPendientes.length > 0) {
      throw new ApiError(400, `Hay ${dia.pacientesWhatsAppPendientes.length} resultado(s) pendientes de envío por WhatsApp para esta fecha.`);
    }

    const out = await withTransaction(async (client) => {
      const r = await consolidarCierre(client, fecha, usuario, observaciones, conteo);
      // Con sobrante o faltante el cierre exige una nota que lo explique (se revierte todo si falta).
      if (r.arqueo.some((l) => l.diferencia !== 0) && !(typeof body.observaciones === 'string' && body.observaciones.trim())) {
        throw new ApiError(400, 'Hay sobrante o faltante en el arqueo: escriba en observaciones la explicación.');
      }
      return r;
    });
    const hayDiferencia = out.arqueo.some((l) => l.diferencia !== 0);
    return NextResponse.json({
      mensaje: 'Cierre diario consolidado exitosamente.',
      fecha_cierre: fecha,
      cierre: { ...out.fila, ...out.tot, usuario_responsable: usuario },
      arqueo: out.arqueo.map((l) => ({ metodo: l.metodo, esperado: centsToStr(l.esperado), contado: centsToStr(l.contado), diferencia: centsToStr(l.diferencia) })),
      hay_diferencia: hayDiferencia,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
