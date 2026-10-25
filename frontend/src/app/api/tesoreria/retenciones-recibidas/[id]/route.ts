import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import { asegurarFiscal } from '@/lib/fiscal/fiscalDb';

const schema = z.object({ motivo: z.string().trim().min(5, 'Indique el motivo (mínimo 5 caracteres).').max(300) });

/** Anula el registro de una retención recibida (p. ej. el agente anuló su comprobante). Se conserva con su motivo. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Id inválido.');
    const b = await parseBody(req, schema);
    await asegurarFiscal();
    const r = await pool.query(
      'UPDATE retenciones_recibidas SET anulada_en = now(), motivo_anulacion = $2 WHERE id = $1 AND anulada_en IS NULL RETURNING id',
      [id, b.motivo]
    );
    if (r.rows.length === 0) throw new ApiError(404, 'Retención no encontrada o ya anulada.');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
