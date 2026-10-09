import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { promosActivas } from '@/lib/descuentosDb';

/** Promociones vigentes en una fecha (por defecto hoy); la usa la pantalla de caja para mostrar el descuento. */
export async function GET(req: NextRequest) {
  try {
    const f = new URL(req.url).searchParams.get('fecha') ?? '';
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : fechaHoraLocal().fecha;
    return NextResponse.json({ promociones: await promosActivas(fecha) });
  } catch (err) {
    return errorResponse(err);
  }
}
