import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, fechaHoraLocal, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';
import { asegurarCompras } from '@/lib/compras/comprasDb';
import { estadoFactura } from '@/lib/compras/pagos';
import { pagadoFactura } from '@/lib/compras/registrarPago';

const schema = z.object({ motivo: z.string().trim().min(3, 'Indique el motivo del reverso.').max(300) });

/** Reversa un pago de compra: devuelve el monto a su cuenta (REVERSO_PAGO_COMPRA) y recalcula el estado de la factura. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseInt((await params).id, 10);
    const { motivo } = await parseBody(req, schema);
    const usuario = sesionUsuario(req);
    const { fecha, hora } = fechaHoraLocal();
    await asegurarCompras();
    const out = await withTransaction(async (client) => {
      const pr = await client.query('SELECT * FROM pagos_compra WHERE id = $1 FOR UPDATE', [id]);
      if (pr.rows.length === 0) throw new ApiError(404, 'Pago no encontrado.');
      const pago = pr.rows[0];
      if (pago.reversado) throw new ApiError(409, 'El pago ya fue reversado.');
      const f = (await client.query('SELECT * FROM facturas_compra WHERE id = $1 FOR UPDATE', [pago.factura_id])).rows[0];
      const cuenta = (await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1 FOR UPDATE', [pago.cuenta_id])).rows[0];
      const monto = toCents(pago.monto_cuenta);
      const saldoAnt = toCents(cuenta.saldo_actual);
      const saldoPost = saldoAnt + monto;
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoPost), cuenta.id]);
      await client.query('UPDATE pagos_compra SET reversado = true WHERE id = $1', [id]);
      await client.query(
        `INSERT INTO movimientos_tesoreria
         (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
         VALUES ($1, 'REVERSO_PAGO_COMPRA', $2, $3, 0, $2, $4, $5, $6, $7, $8, $9, $10)`,
        [cuenta.id, centsToStr(monto), cuenta.moneda, centsToStr(saldoAnt), centsToStr(saldoPost), `REV-COMPRA-${f.id}-${id}`,
         `Reverso del pago ${id} de la factura N° ${f.numero_factura}: ${motivo}`, fecha, hora, usuario]
      );
      const estado = f.estado === 'ANULADA' ? 'ANULADA' : estadoFactura(toCents(f.neto_a_pagar), await pagadoFactura(client, f.id));
      await client.query('UPDATE facturas_compra SET estado = $1 WHERE id = $2', [estado, f.id]);
      return { estado };
    });
    return NextResponse.json({ mensaje: 'Pago reversado: el dinero volvió a su cuenta.', ...out });
  } catch (err) {
    return errorResponse(err);
  }
}
