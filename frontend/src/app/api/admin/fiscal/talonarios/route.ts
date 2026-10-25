import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { getErrorMessage } from '@/lib/utils';
import { talonarioSchema } from '@/lib/fiscal/contingencia';
import { activarTalonario, crearTalonario, listarTalonarios } from '@/lib/fiscal/contingenciaDb';
import { asegurarFiscal } from '@/lib/fiscal/fiscalDb';

/** Talonarios de contingencia autorizados (arts. 11 y 27). Solo admin (prefijo /api/admin). */
export async function GET() {
  try {
    await asegurarFiscal();
    return NextResponse.json({ talonarios: await listarTalonarios(pool) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const t = await parseBody(req, talonarioSchema);
    await asegurarFiscal();
    const id = await withTransaction(async (client) => {
      try {
        return await crearTalonario(client, t, sesionUsuario(req));
      } catch (err) {
        throw new ApiError(400, getErrorMessage(err));
      }
    });
    return NextResponse.json({ id });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Activa o retira un talonario (agotado, dañado o con datos del emisor desactualizados, arts. 23-24). */
export async function PATCH(req: NextRequest) {
  try {
    const b = await parseBody(req, z.object({ id: z.number().int().positive(), activo: z.boolean() }));
    await asegurarFiscal();
    await activarTalonario(pool, b.id, b.activo).catch((err) => { throw new ApiError(404, getErrorMessage(err)); });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
