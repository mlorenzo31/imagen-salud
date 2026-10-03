import { NextResponse, type NextRequest } from 'next/server';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { ApiError, fechaHoraLocal, parseBody, sesionUsuario, withTransaction, errorResponse } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';

const monto = z.union([z.string(), z.number()]).optional();
const schema = z.object({
  medico: z.string().min(1),
  honorarios_ids: z.array(z.coerce.number().int().positive()).min(1, 'Debe seleccionar al menos un honorario para liquidar.'),
  dias_liquidados: z.string().optional(),
  tasa_cambio_bcv: z.union([z.string(), z.number()]),
  pago_movil_bs: monto,
  comision_pago_movil_bs: monto,
  efectivo_bs: monto,
  efectivo_usd: monto,
  referencia: z.string().max(100).optional(),
  observaciones: z.string().max(500).optional(),
});

interface Debito { codigo: string; etiqueta: string; simbolo: string; cents: number; tipo: string; moneda: 'BS' | 'USD'; comision: number; descripcion: string }

async function debitar(client: PoolClient, d: Debito, ctx: { pagoId: number; referencia: string; fecha: string; hora: string; usuario: string }) {
  const res = await client.query('SELECT id, saldo_actual FROM cuentas_bancarias WHERE codigo = $1 FOR UPDATE', [d.codigo]);
  if (res.rows.length === 0) throw new ApiError(400, `Cuenta ${d.codigo} no configurada.`);
  const cuenta = res.rows[0];
  const saldoAnt = toCents(cuenta.saldo_actual);
  if (saldoAnt < d.cents) {
    throw new ApiError(400, `Saldo insuficiente en ${d.etiqueta}. Saldo actual: ${d.simbolo}${centsToStr(saldoAnt)}, Requerido: ${d.simbolo}${centsToStr(d.cents)}`);
  }
  const saldoPost = saldoAnt - d.cents;
  await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoPost), cuenta.id]);
  await client.query(
    `INSERT INTO movimientos_tesoreria
     (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, pago_honorario_id, fecha, hora, usuario)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [cuenta.id, d.tipo, centsToStr(d.cents - d.comision), d.moneda, centsToStr(d.comision), centsToStr(d.cents),
     centsToStr(saldoAnt), centsToStr(saldoPost), ctx.referencia, d.descripcion, ctx.pagoId, ctx.fecha, ctx.hora, ctx.usuario]
  );
}

export async function POST(request: NextRequest) {
  try {
    const b = await parseBody(request, schema);
    const usuario = sesionUsuario(request);
    const { fecha, hora } = fechaHoraLocal();
    const pm = toCents(b.pago_movil_bs);
    const comPm = toCents(b.comision_pago_movil_bs);
    const efBs = toCents(b.efectivo_bs);
    const efUsd = toCents(b.efectivo_usd);
    if ([pm, comPm, efBs, efUsd].some((v) => v < 0)) throw new ApiError(400, 'Los montos no pueden ser negativos.');
    const tasa = Number(b.tasa_cambio_bcv);
    if (!Number.isFinite(tasa) || tasa <= 0) throw new ApiError(400, 'Debe indicar una tasa BCV válida.');

    const out = await withTransaction(async (client) => {
      const hon = await client.query(
        `SELECT id, monto_usd FROM honorarios_medicos_pendientes
         WHERE id = ANY($1::int[]) AND estado = 'PENDIENTE' FOR UPDATE`,
        [b.honorarios_ids]
      );
      if (hon.rows.length === 0) throw new ApiError(400, 'Los honorarios seleccionados ya fueron pagados o no existen.');
      const sumaUsd = hon.rows.reduce((acc, r) => acc + toCents(r.monto_usd), 0);

      // Cuadre: lo entregado (Bs convertidos a la tasa informada + USD) debe igualar lo adeudado; la comisión no cuenta.
      const entregadoUsd = Math.round((pm + efBs) / tasa) + efUsd;
      if (Math.abs(entregadoUsd - sumaUsd) > 2) {
        throw new ApiError(400, `El pago no cubre la liquidación: entregado $${centsToStr(entregadoUsd)} vs adeudado $${centsToStr(sumaUsd)}.`);
      }

      const referencia = b.referencia || `HON-${Date.now()}`;
      const pagoRes = await client.query(
        `INSERT INTO pagos_honorarios
         (medico, fecha_pago, dias_liquidados, total_usd_liquidado, tasa_cambio_bcv, pago_movil_bs, comision_pago_movil_bs, efectivo_bs, efectivo_usd, referencia, observaciones, usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [b.medico, fecha, b.dias_liquidados || '', centsToStr(sumaUsd), tasa, centsToStr(pm), centsToStr(comPm),
         centsToStr(efBs), centsToStr(efUsd), referencia, b.observaciones || '', usuario]
      );
      const pago = pagoRes.rows[0];
      await client.query(
        `UPDATE honorarios_medicos_pendientes SET estado = 'PAGADO', pago_id = $1 WHERE id = ANY($2::int[])`,
        [pago.id, hon.rows.map((r) => r.id)]
      );

      const ctx = { pagoId: pago.id as number, referencia, fecha, hora, usuario };
      if (pm > 0 || comPm > 0) {
        await debitar(client, { codigo: 'PAGO_MOVIL_BS', etiqueta: 'Pago Móvil', simbolo: 'Bs. ', cents: pm + comPm, tipo: 'PAGO_HONORARIOS_PM', moneda: 'BS', comision: comPm,
          descripcion: `Pago honorarios Dr(a). ${b.medico} vía Pago Móvil. Comisión: Bs. ${centsToStr(comPm)}` }, ctx);
      }
      if (efBs > 0) {
        await debitar(client, { codigo: 'EFECTIVO_BS', etiqueta: 'Efectivo Bolívares', simbolo: 'Bs. ', cents: efBs, tipo: 'PAGO_HONORARIOS_EF_BS', moneda: 'BS', comision: 0,
          descripcion: `Pago honorarios Dr(a). ${b.medico} en Efectivo Bolívares` }, ctx);
      }
      if (efUsd > 0) {
        await debitar(client, { codigo: 'EFECTIVO_USD', etiqueta: 'Efectivo Divisas', simbolo: '$', cents: efUsd, tipo: 'PAGO_HONORARIOS_EF_USD', moneda: 'USD', comision: 0,
          descripcion: `Pago honorarios Dr(a). ${b.medico} en Efectivo Divisas ($)` }, ctx);
      }
      return { pago, count: hon.rows.length, sumaUsd };
    });

    return NextResponse.json({
      mensaje: `Liquidación de honorarios a Dr(a). ${b.medico} ejecutada exitosamente.`,
      pago: out.pago,
      honorariosLiquidados: out.count,
      totalUsd: Number(centsToStr(out.sumaUsd)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
