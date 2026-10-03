import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, fechaHoraLocal, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToNumber, centsToStr, toCents } from '@/lib/money';

const num = z.union([z.string(), z.number()]);
const schema = z.object({
  cuenta_origen_id: z.coerce.number().int().positive(),
  monto_bs_base: num,
  tasa_cambio_manual: num,
  comision_bancaria_bs: num.optional(),
  referencia: z.string().max(100).nullish(),
  notas: z.string().max(500).nullish(),
});

export async function POST(req: NextRequest) {
  try {
    const b = await parseBody(req, schema);
    const usuario = sesionUsuario(req);
    const { fecha, hora } = fechaHoraLocal();

    const bsBase = toCents(b.monto_bs_base);
    const comision = toCents(b.comision_bancaria_bs);
    const tasa = Number(String(b.tasa_cambio_manual).replace(',', '.'));
    if (bsBase <= 0) throw new ApiError(400, 'Monto base en Bs inválido.');
    if (!Number.isFinite(tasa) || tasa <= 0) throw new ApiError(400, 'Tasa de cambio inválida.');
    if (comision < 0) throw new ApiError(400, 'La comisión bancaria no puede ser negativa.');

    const totalDebitar = bsBase + comision;
    // USD adquiridos = Bs / tasa, redondeado half-up al centavo (aritmética entera).
    const usdCents = Math.round(bsBase / tasa);

    const out = await withTransaction(async (client) => {
      const origenRes = await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1 FOR UPDATE', [b.cuenta_origen_id]);
      if (origenRes.rows.length === 0) throw new ApiError(404, 'Cuenta origen no encontrada.');
      const origen = origenRes.rows[0];
      if (origen.moneda !== 'BS') throw new ApiError(400, 'La cuenta origen debe estar en bolívares.');
      const saldoOrigenAnt = toCents(origen.saldo_actual);
      if (saldoOrigenAnt < totalDebitar) {
        throw new ApiError(400, `Saldo insuficiente en ${origen.nombre}. Disponible: ${centsToStr(saldoOrigenAnt)} Bs, Requerido: ${centsToStr(totalDebitar)} Bs`);
      }

      const destinoRes = await client.query("SELECT * FROM cuentas_bancarias WHERE codigo = 'EFECTIVO_USD' FOR UPDATE");
      if (destinoRes.rows.length === 0) throw new ApiError(500, "Cuenta 'Efectivo Divisas ($)' no encontrada.");
      const destino = destinoRes.rows[0];
      const saldoDestinoAnt = toCents(destino.saldo_actual);

      const opRes = await client.query(
        `INSERT INTO operaciones_cambiarias
         (cuenta_origen_id, monto_bs_base, tasa_cambio_manual, comision_bancaria_bs, monto_total_debitado_bs, monto_usd_ingreso, fecha, referencia, notas, usuario)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [origen.id, centsToStr(bsBase), tasa, centsToStr(comision), centsToStr(totalDebitar), centsToStr(usdCents), fecha, b.referencia || 'CAMBIO-USD', b.notas || '', usuario]
      );
      const op = opRes.rows[0];

      const saldoOrigenPost = saldoOrigenAnt - totalDebitar;
      const saldoDestinoPost = saldoDestinoAnt + usdCents;
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoOrigenPost), origen.id]);
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoDestinoPost), destino.id]);

      const ref = b.referencia || `CAMBIO-${op.id}`;
      await client.query(
        `INSERT INTO movimientos_tesoreria
         (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, operacion_cambiaria_id, fecha, hora, usuario)
         VALUES ($1,'CAMBIO_DIVISA_EGRESO',$2,'BS',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [origen.id, centsToStr(bsBase), centsToStr(comision), centsToStr(totalDebitar), centsToStr(saldoOrigenAnt), centsToStr(saldoOrigenPost), ref,
         `Compra de $${centsToStr(usdCents)} USD a tasa ${tasa} Bs/$. Comisión bancaria: Bs. ${centsToStr(comision)}`, op.id, fecha, hora, usuario]
      );
      await client.query(
        `INSERT INTO movimientos_tesoreria
         (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, operacion_cambiaria_id, fecha, hora, usuario)
         VALUES ($1,'CAMBIO_DIVISA_INGRESO',$2,'USD',0,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [destino.id, centsToStr(usdCents), centsToStr(saldoDestinoAnt), centsToStr(saldoDestinoPost), ref,
         `Ingreso por compra de divisas de cobertura cambiaria (Origen: ${origen.nombre})`, op.id, fecha, hora, usuario]
      );
      return { op, saldoOrigenPost, saldoDestinoPost };
    });

    return NextResponse.json({
      mensaje: 'Operación cambiaria completada exitosamente.',
      operacion: out.op,
      totalDebitadoBs: centsToNumber(totalDebitar),
      totalAcreditadoUsd: centsToNumber(usdCents),
      nuevoSaldoBs: centsToNumber(out.saldoOrigenPost),
      nuevoSaldoUsd: centsToNumber(out.saldoDestinoPost),
      saldoOrigenActualizado: centsToNumber(out.saldoOrigenPost),
      saldoDivisasActualizado: centsToNumber(out.saldoDestinoPost),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
