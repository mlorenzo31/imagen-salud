import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, parseBody, sesionUsuario } from '@/lib/apiHelpers';
import { configEmisorSchema } from '@/lib/fiscal/configEmisor';
import { asegurarFiscal, guardarConfigEmisor, leerConfigEmisor } from '@/lib/fiscal/fiscalDb';

/** Datos fiscales del emisor (clínica) para la facturación por imprenta digital. Solo admin (prefijo /api/admin). */
export async function GET() {
  try {
    await asegurarFiscal();
    return NextResponse.json(await leerConfigEmisor());
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const valor = await parseBody(req, configEmisorSchema);
    await asegurarFiscal();
    await guardarConfigEmisor(valor, sesionUsuario(req));
    return NextResponse.json(valor);
  } catch (err) {
    return errorResponse(err);
  }
}
