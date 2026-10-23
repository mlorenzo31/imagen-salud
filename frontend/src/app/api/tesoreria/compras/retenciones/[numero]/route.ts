import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import { asegurarCompras } from '@/lib/compras/comprasDb';

const schema = z.object({ fecha_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD.') });

/** Art. 18.3: registra la fecha de entrega del comprobante al proveedor (no puede ser anterior a la emisión). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  try {
    const { numero } = await params;
    const b = await parseBody(req, schema);
    await asegurarCompras();
    const r = await pool.query(
      `UPDATE retenciones_compra SET fecha_entrega = $2 WHERE numero = $1 AND $2::date >= fecha RETURNING numero`,
      [numero, b.fecha_entrega]
    );
    if (r.rows.length === 0) {
      const existe = await pool.query('SELECT 1 FROM retenciones_compra WHERE numero = $1', [numero]);
      throw existe.rows.length ? new ApiError(400, 'La fecha de entrega no puede ser anterior a la emisión.') : new ApiError(404, 'Comprobante no encontrado.');
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
