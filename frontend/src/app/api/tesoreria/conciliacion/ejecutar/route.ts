import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, fechaHoraLocal, parseBody, sesionUsuario, withTransaction, errorResponse } from '@/lib/apiHelpers';
import { centsToNumber, centsToStr, toCents } from '@/lib/money';

const schema = z.object({
  transaccion_ids: z.array(z.coerce.number().int().positive()).min(1, 'Debe seleccionar al menos una transacción para conciliar.'),
  monto_neto_acreditado_bs: z.union([z.string(), z.number()]).optional(),
  comision_bancaria_bs: z.union([z.string(), z.number()]).optional(),
  fecha_acreditacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referencia: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request, schema);
    const usuario = sesionUsuario(request);
    const { fecha, hora } = fechaHoraLocal();

    const out = await withTransaction(async (client) => {
      const trans = await client.query(
        `SELECT id, monto_bruto_bs FROM transacciones_tarjetas_transito
         WHERE id = ANY($1::int[]) AND estado = 'PENDIENTE' FOR UPDATE`,
        [body.transaccion_ids]
      );
      if (trans.rows.length === 0) {
        throw new ApiError(400, 'Las transacciones seleccionadas ya fueron conciliadas o no existen.');
      }

      const brutoCents = trans.rows.reduce((acc, r) => acc + toCents(r.monto_bruto_bs), 0);
      const netoIn = toCents(body.monto_neto_acreditado_bs);
      const comIn = toCents(body.comision_bancaria_bs);
      // Mismo criterio previo: si se informa neto, la comisión es la diferencia; si no, neto = bruto - comisión.
      const netoCents = netoIn > 0 ? netoIn : brutoCents - comIn;
      const comisionCents = comIn > 0 ? comIn : brutoCents - netoCents;
      if (netoCents < 0 || comisionCents < 0 || netoCents + comisionCents !== brutoCents) {
        throw new ApiError(400, 'Neto + comisión debe ser igual al monto bruto de las transacciones.');
      }
      const fechaAcred = body.fecha_acreditacion || fecha;

      await client.query(
        `UPDATE transacciones_tarjetas_transito
         SET estado = 'CONCILIADO', monto_neto_acreditado_bs = $1, comision_bancaria_bs = $2,
             fecha_acreditacion = $3, referencia_bancaria = $4, conciliado_por = $5, conciliado_en = NOW()
         WHERE id = ANY($6::int[])`,
        [centsToStr(netoCents), centsToStr(comisionCents), fechaAcred, body.referencia || 'CONCILIACION', usuario, body.transaccion_ids]
      );

      const cuenta = await client.query(
        "SELECT id, saldo_actual, saldo_transito FROM cuentas_bancarias WHERE codigo = 'PUNTO_VENTA_BS' FOR UPDATE"
      );
      if (cuenta.rows.length > 0) {
        const c = cuenta.rows[0];
        const saldoAnt = toCents(c.saldo_actual);
        const nuevoTransito = Math.max(0, toCents(c.saldo_transito) - brutoCents);
        const nuevoActual = saldoAnt + netoCents;
        await client.query(
          'UPDATE cuentas_bancarias SET saldo_transito = $1, saldo_actual = $2, actualizado_en = NOW() WHERE id = $3',
          [centsToStr(nuevoTransito), centsToStr(nuevoActual), c.id]
        );
        await client.query(
          `INSERT INTO movimientos_tesoreria
           (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
           VALUES ($1, 'CONCILIACION_TARJETA', $2, 'BS', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            c.id, centsToStr(brutoCents), centsToStr(comisionCents), centsToStr(netoCents), centsToStr(saldoAnt), centsToStr(nuevoActual),
            body.referencia || 'CONC-POS',
            `Acreditación bancaria neta de ${trans.rows.length} transacciones de tarjeta. Bruto: Bs. ${centsToStr(brutoCents)}, Comisión retenida: Bs. ${centsToStr(comisionCents)}`,
            fechaAcred, hora, usuario,
          ]
        );
      }

      return { count: trans.rows.length, brutoCents, netoCents, comisionCents };
    });

    return NextResponse.json({
      mensaje: 'Conciliación ejecutada exitosamente.',
      transaccionesConciliadas: out.count,
      totalBrutoBs: centsToNumber(out.brutoCents),
      montoNetoAcreditadoBs: centsToNumber(out.netoCents),
      comisionBancariaBs: centsToNumber(out.comisionCents),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
