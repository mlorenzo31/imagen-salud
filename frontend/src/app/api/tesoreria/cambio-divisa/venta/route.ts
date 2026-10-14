import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToNumber, centsToStr, toCents } from '@/lib/money';
import { exigirJornadaAlDia, marcarCierreModificado } from '@/lib/cierre';
import { camposFechaOperacion, resolverFechaOperacion } from '@/lib/fechaOperacion';
import { calcularVenta } from '@/lib/operacionesCambiarias';
import { asegurarOperacionesCambiarias } from '@/lib/operacionesCambiariasDb';

const num = z.union([z.string(), z.number()]);
const schema = z.object({
  cuenta_destino_id: z.coerce.number().int().positive(),
  monto_usd: num,
  tasa_cambio_manual: num,
  comision_bancaria_bs: num.optional(),
  referencia: z.string().max(100).nullish(),
  notas: z.string().max(500).nullish(),
  ...camposFechaOperacion,
});

/** Venta de divisas (P2P) a la tasa de mercado pactada: sale de Efectivo Divisas y entra a una cuenta en Bs. */
export async function POST(req: NextRequest) {
  try {
    await exigirJornadaAlDia(req.headers.get('x-session-role') === 'admin');
    const b = await parseBody(req, schema);
    const usuario = sesionUsuario(req);
    const { fecha, hora, nota, diaCerrado, motivo } = await resolverFechaOperacion(b, req.headers.get('x-session-role') === 'admin');

    const usd = toCents(b.monto_usd);
    const comision = toCents(b.comision_bancaria_bs);
    const tasa = Number(String(b.tasa_cambio_manual).replace(',', '.'));
    const { brutoBs, netoBs } = calcularVenta(usd, tasa, comision);

    await asegurarOperacionesCambiarias();
    const out = await withTransaction(async (client) => {
      const origenRes = await client.query("SELECT * FROM cuentas_bancarias WHERE codigo = 'EFECTIVO_USD' FOR UPDATE");
      if (origenRes.rows.length === 0) throw new ApiError(500, "Cuenta 'Efectivo Divisas ($)' no encontrada.");
      const origen = origenRes.rows[0];
      const saldoOrigenAnt = toCents(origen.saldo_actual);
      if (saldoOrigenAnt < usd) {
        throw new ApiError(400, `Saldo insuficiente en ${origen.nombre}. Disponible: $${centsToStr(saldoOrigenAnt)}, a vender: $${centsToStr(usd)}`);
      }
      const destinoRes = await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1 FOR UPDATE', [b.cuenta_destino_id]);
      if (destinoRes.rows.length === 0) throw new ApiError(404, 'Cuenta destino no encontrada.');
      const destino = destinoRes.rows[0];
      if (destino.moneda !== 'BS') throw new ApiError(400, 'La cuenta destino debe estar en bolívares.');
      const saldoDestinoAnt = toCents(destino.saldo_actual);

      // monto_total_debitado_bs / monto_usd_ingreso conservan su sentido de compra; en una venta se usan los campos de venta.
      const opRes = await client.query(
        `INSERT INTO operaciones_cambiarias
         (tipo, cuenta_origen_id, cuenta_destino_id, monto_bs_base, tasa_cambio_manual, comision_bancaria_bs, monto_total_debitado_bs, monto_usd_ingreso,
          monto_bs_neto, fecha, referencia, notas, usuario)
         VALUES ('VENTA', $1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [origen.id, destino.id, centsToStr(brutoBs), tasa, centsToStr(comision), centsToStr(usd), centsToStr(netoBs), fecha,
         b.referencia || 'VENTA-USD', (b.notas || '') + nota, usuario]
      );
      const op = opRes.rows[0];

      const saldoOrigenPost = saldoOrigenAnt - usd;
      const saldoDestinoPost = saldoDestinoAnt + netoBs;
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoOrigenPost), origen.id]);
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoDestinoPost), destino.id]);

      const ref = b.referencia || `VENTA-${op.id}`;
      await client.query(
        `INSERT INTO movimientos_tesoreria
         (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, operacion_cambiaria_id, fecha, hora, usuario)
         VALUES ($1,'VENTA_DIVISA_EGRESO',$2,'USD',0,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [origen.id, centsToStr(usd), centsToStr(saldoOrigenAnt), centsToStr(saldoOrigenPost), ref,
         `Venta de $${centsToStr(usd)} a tasa ${tasa} Bs/$ (destino: ${destino.nombre})${nota}`, op.id, fecha, hora, usuario]
      );
      await client.query(
        `INSERT INTO movimientos_tesoreria
         (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, operacion_cambiaria_id, fecha, hora, usuario)
         VALUES ($1,'VENTA_DIVISA_INGRESO',$2,'BS',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [destino.id, centsToStr(brutoBs), centsToStr(comision), centsToStr(netoBs), centsToStr(saldoDestinoAnt), centsToStr(saldoDestinoPost), ref,
         `Ingreso por venta de $${centsToStr(usd)} a tasa ${tasa} Bs/$. Comisión bancaria: Bs. ${centsToStr(comision)}`, op.id, fecha, hora, usuario]
      );
      if (diaCerrado) await marcarCierreModificado(client, fecha, motivo, usuario);
      return { op, saldoOrigenPost, saldoDestinoPost };
    });

    return NextResponse.json({
      mensaje: 'Venta de divisas registrada.',
      operacion: out.op,
      usdVendidos: centsToNumber(usd),
      bsRecibidos: centsToNumber(netoBs),
      nuevoSaldoUsd: centsToNumber(out.saldoOrigenPost),
      nuevoSaldoBs: centsToNumber(out.saldoDestinoPost),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
