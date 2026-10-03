import { NextResponse } from 'next/server';
import { errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { evaluarDia, jornadaPendiente } from '@/lib/cierre';

/** ¿Hay un día anterior sin cerrar? Si lo hay, la interfaz bloquea la operación hasta cerrarlo. */
export async function GET() {
  try {
    const fecha = await jornadaPendiente();
    const hoy = fechaHoraLocal().fecha;
    if (!fecha) return NextResponse.json({ requiereCierre: false, hoy });
    const dia = await evaluarDia(fecha);
    return NextResponse.json({
      requiereCierre: true, fecha, hoy, puedeCerrar: dia.puedeCerrar,
      pacientesPendientes: dia.pacientesPendientes, pacientesWhatsAppPendientes: dia.pacientesWhatsAppPendientes, resumen: dia.resumen,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
