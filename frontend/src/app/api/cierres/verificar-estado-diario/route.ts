import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { evaluarDia } from '@/lib/cierre';

export async function GET(req: NextRequest) {
  try {
    // El cajero solo ve el día de hoy.
    const fechaParam = req.headers.get('x-session-role') === 'cajero' ? fechaHoraLocal().fecha : new URL(req.url).searchParams.get('fecha');
    const dia = await evaluarDia(fechaParam);
    return NextResponse.json({
      puedeCerrar: dia.puedeCerrar,
      cierre_pendiente: !dia.puedeCerrar,
      fecha_evaluada: fechaParam || fechaHoraLocal().fecha,
      pacientesPendientes: dia.pacientesPendientes,
      pacientesWhatsAppPendientes: dia.pacientesWhatsAppPendientes,
      totalWhatsAppPendientes: dia.pacientesWhatsAppPendientes.length,
      resumen: dia.resumen,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
