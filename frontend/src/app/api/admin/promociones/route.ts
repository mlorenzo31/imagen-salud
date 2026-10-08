import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, parseBody, sesionUsuario } from '@/lib/apiHelpers';
import { guardarPromo, listarPromos } from '@/lib/descuentosDb';
import { promoEntradaSchema } from '@/lib/promociones';

/** Promociones (solo admin, por el prefijo /api/admin): listar, crear y editar/activar. */
export async function GET() {
  try {
    return NextResponse.json({ promociones: await listarPromos() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const promo = await guardarPromo(await parseBody(req, promoEntradaSchema), sesionUsuario(req));
    return NextResponse.json({ promocion: promo });
  } catch (err) {
    return errorResponse(err);
  }
}

const edicionSchema = z.object({ id: z.number().int().positive(), promo: promoEntradaSchema });

export async function PUT(req: NextRequest) {
  try {
    const { id, promo } = await parseBody(req, edicionSchema);
    const r = await guardarPromo(promo, sesionUsuario(req), id);
    if (!r) throw new ApiError(404, 'Promoción no encontrada.');
    return NextResponse.json({ promocion: r });
  } catch (err) {
    return errorResponse(err);
  }
}
