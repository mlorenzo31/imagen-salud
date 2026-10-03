import { NextResponse } from 'next/server';
import { obtenerTasaBcv } from '@/lib/tasaBcv';

export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await obtenerTasaBcv();
  if (t) return NextResponse.json(t);
  return NextResponse.json({ tasa: null, fuente: 'Sin proveedores ni historial de tasa', fecha: new Date().toISOString(), exito: false });
}
