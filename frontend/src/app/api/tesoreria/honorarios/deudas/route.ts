import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse } from '@/lib/apiHelpers';
import { deudasPorMedico } from '@/lib/deudasHonorariosDb';

/** Deuda de cada médico (honorarios pagados de facturas anuladas, menos lo descontado o devuelto) y sus movimientos. */
export async function GET(request: NextRequest) {
  try {
    const medico = request.nextUrl.searchParams.get('medico')?.trim() || undefined;
    return NextResponse.json(await deudasPorMedico(medico));
  } catch (err) {
    return errorResponse(err);
  }
}
