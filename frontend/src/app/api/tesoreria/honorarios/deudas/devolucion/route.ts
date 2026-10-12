import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { marcarCierreModificado } from '@/lib/cierre';
import { camposFechaOperacion, resolverFechaOperacion } from '@/lib/fechaOperacion';
import { ApiError, parseBody, sesionUsuario, withTransaction, errorResponse } from '@/lib/apiHelpers';
import { centsToNumber, centsToStr, toCents } from '@/lib/money';
import { obtenerTasaBcv } from '@/lib/tasaBcv';
import { usdDeBs, validarDevolucion } from '@/lib/deudasHonorarios';
import { asegurarDeudasHonorarios, bloquearYSaldo, registrarMovDeuda } from '@/lib/deudasHonorariosDb';

const FORMAS = {
  EFECTIVO_USD: { etiqueta: 'Efectivo Divisas', moneda: 'USD' as const },
  EFECTIVO_BS: { etiqueta: 'Efectivo Bolívares', moneda: 'BS' as const },
  PAGO_MOVIL_BS: { etiqueta: 'Pago Móvil', moneda: 'BS' as const },
};

const schema = z.object({
  medico: z.string().trim().min(1),
  forma: z.enum(['EFECTIVO_USD', 'EFECTIVO_BS', 'PAGO_MOVIL_BS']),
  monto: z.union([z.string(), z.number()]),
  referencia: z.string().max(100).optional(),
  observaciones: z.string().max(500).optional(),
  ...camposFechaOperacion,
});

/** El médico devuelve en mano lo que se le pagó de honorarios de facturas anuladas. */
export async function POST(request: NextRequest) {
  try {
    const b = await parseBody(request, schema);
    const usuario = sesionUsuario(request);
    const { fecha, hora, nota, diaCerrado, motivo } = await resolverFechaOperacion(b, request.headers.get('x-session-role') === 'admin');
    const forma = FORMAS[b.forma];
    const montoCents = toCents(b.monto);
    let montoUsd = montoCents;
    let tasaTxt = '';
    if (forma.moneda === 'BS') {
      const tasa = await obtenerTasaBcv();
      if (!tasa) throw new ApiError(503, 'No hay tasa BCV disponible para convertir la devolución.');
      montoUsd = usdDeBs(montoCents, tasa.tasa);
      tasaTxt = ` a tasa ${tasa.tasa}`;
    }

    await asegurarDeudasHonorarios();
    const out = await withTransaction(async (client) => {
      const deuda = await bloquearYSaldo(client, b.medico);
      validarDevolucion(montoUsd, deuda);

      const cuenta = await client.query('SELECT id, saldo_actual FROM cuentas_bancarias WHERE codigo = $1 FOR UPDATE', [b.forma]);
      if (cuenta.rows.length === 0) throw new ApiError(500, `No existe la cuenta ${b.forma} para registrar la devolución.`);
      const c = cuenta.rows[0];
      const saldoAnt = toCents(c.saldo_actual);
      const saldoPost = saldoAnt + montoCents;
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoPost), c.id]);
      const referencia = b.referencia || `DEV-HON-${Date.now()}`;
      const descripcion = `Devolución de honorarios de ${b.medico} (${forma.etiqueta}${tasaTxt}): $${centsToStr(montoUsd)}${b.observaciones ? ` — ${b.observaciones}` : ''}${nota}`;
      const mov = await client.query(
        `INSERT INTO movimientos_tesoreria
         (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
         VALUES ($1, 'DEVOLUCION_HONORARIO', $2, $3, 0, $2, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [c.id, centsToStr(montoCents), forma.moneda, centsToStr(saldoAnt), centsToStr(saldoPost), referencia, descripcion, fecha, hora, usuario]
      );
      await registrarMovDeuda(client, {
        medico: b.medico, tipo: 'ABONO_DEVOLUCION', cents: montoUsd, movimientoId: mov.rows[0].id, fecha, usuario, descripcion,
      });
      if (diaCerrado) await marcarCierreModificado(client, fecha, motivo, usuario);
      return { restante: deuda - montoUsd };
    });

    return NextResponse.json({
      mensaje: `Devolución de ${b.medico} registrada.`,
      montoUsd: centsToNumber(montoUsd),
      saldoRestanteUsd: centsToNumber(out.restante),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
