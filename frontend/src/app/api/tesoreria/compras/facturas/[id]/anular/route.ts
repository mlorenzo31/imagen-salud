import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { asegurarCompras } from '@/lib/compras/comprasDb';

const schema = z.object({ motivo: z.string().trim().min(3, 'Indique el motivo de la anulación.').max(300) });

/** Anula una factura de compra sin pagos vigentes (los pagos se reversan antes). Queda en el Libro de Compras como anulada. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseInt((await params).id, 10);
    const { motivo } = await parseBody(req, schema);
    const usuario = sesionUsuario(req);
    await asegurarCompras();
    await withTransaction(async (client) => {
      const f = await client.query('SELECT estado FROM facturas_compra WHERE id = $1 FOR UPDATE', [id]);
      if (f.rows.length === 0) throw new ApiError(404, 'Factura de compra no encontrada.');
      if (f.rows[0].estado === 'ANULADA') throw new ApiError(409, 'La factura ya está anulada.');
      const pagos = await client.query("SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, monto_cuenta::text AS monto FROM pagos_compra WHERE factura_id = $1 AND NOT reversado", [id]);
      if (pagos.rows.length > 0) {
        throw new ApiError(409, `La factura tiene ${pagos.rows.length} pago(s) vigente(s): reverse los pagos antes de anularla.`, 'PAGOS_VIGENTES', { pagos: pagos.rows });
      }
      await client.query(
        "UPDATE facturas_compra SET estado = 'ANULADA', notas = COALESCE(notas || ' | ', '') || $1 WHERE id = $2",
        [`Anulada por ${usuario}: ${motivo}`, id]
      );
    });
    return NextResponse.json({ mensaje: 'Factura de compra anulada.' });
  } catch (err) {
    return errorResponse(err);
  }
}
