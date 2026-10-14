import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToNumber, centsToStr, toCents } from '@/lib/money';
import { exigirJornadaAlDia, marcarCierreModificado } from '@/lib/cierre';
import { camposFechaOperacion, resolverFechaOperacion } from '@/lib/fechaOperacion';
import { validarTransferencia } from '@/lib/operacionesCambiarias';
import { asegurarOperacionesCambiarias } from '@/lib/operacionesCambiariasDb';

const num = z.union([z.string(), z.number()]);
const schema = z.object({
  cuenta_origen_id: z.coerce.number().int().positive(),
  cuenta_destino_id: z.coerce.number().int().positive(),
  monto: num,
  comision: num.optional(),
  referencia: z.string().max(100).nullish(),
  notas: z.string().max(500).nullish(),
  ...camposFechaOperacion,
});

/** Transferencia entre cuentas en Bs (p. ej. depositar el efectivo en la cuenta del pago móvil). Solo admin. */
export async function POST(req: NextRequest) {
  try {
    await exigirJornadaAlDia(req.headers.get('x-session-role') === 'admin');
    const b = await parseBody(req, schema);
    const usuario = sesionUsuario(req);
    const { fecha, hora, nota, diaCerrado, motivo } = await resolverFechaOperacion(b, req.headers.get('x-session-role') === 'admin');
    const monto = toCents(b.monto);
    const comision = toCents(b.comision);

    await asegurarOperacionesCambiarias();
    const out = await withTransaction(async (client) => {
      // Se bloquean en orden de id para que dos transferencias cruzadas no se esperen mutuamente.
      const res = await client.query('SELECT * FROM cuentas_bancarias WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [[b.cuenta_origen_id, b.cuenta_destino_id]]);
      const origen = res.rows.find((c) => c.id === b.cuenta_origen_id);
      const destino = res.rows.find((c) => c.id === b.cuenta_destino_id);
      if (!origen || !destino) throw new ApiError(404, 'Cuenta no encontrada.');
      const saldoOrigenAnt = toCents(origen.saldo_actual);
      const saldoDestinoAnt = toCents(destino.saldo_actual);
      validarTransferencia(
        { id: origen.id, moneda: origen.moneda, saldo: saldoOrigenAnt, nombre: origen.nombre },
        { id: destino.id, moneda: destino.moneda, saldo: saldoDestinoAnt, nombre: destino.nombre },
        monto, comision,
      );

      const t = await client.query(
        `INSERT INTO transferencias_cuentas (cuenta_origen_id, cuenta_destino_id, monto, comision, referencia, notas, fecha, usuario)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [origen.id, destino.id, centsToStr(monto), centsToStr(comision), b.referencia || null, (b.notas || '') + nota || null, fecha, usuario]
      );
      const id: number = t.rows[0].id;
      const ref = b.referencia || `TRF-${id}`;
      const saldoOrigenPost = saldoOrigenAnt - monto - comision;
      const saldoDestinoPost = saldoDestinoAnt + monto;
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoOrigenPost), origen.id]);
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoDestinoPost), destino.id]);
      await client.query(
        `INSERT INTO movimientos_tesoreria
         (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
         VALUES ($1,'TRANSFERENCIA_SALIDA',$2,'BS',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [origen.id, centsToStr(monto), centsToStr(comision), centsToStr(monto + comision), centsToStr(saldoOrigenAnt), centsToStr(saldoOrigenPost), ref,
         `Transferencia ${id} a ${destino.nombre}. Comisión: Bs. ${centsToStr(comision)}${b.notas ? ` — ${b.notas}` : ''}${nota}`, fecha, hora, usuario]
      );
      await client.query(
        `INSERT INTO movimientos_tesoreria
         (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
         VALUES ($1,'TRANSFERENCIA_ENTRADA',$2,'BS',0,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [destino.id, centsToStr(monto), centsToStr(saldoDestinoAnt), centsToStr(saldoDestinoPost), ref,
         `Transferencia ${id} desde ${origen.nombre}${b.notas ? ` — ${b.notas}` : ''}${nota}`, fecha, hora, usuario]
      );
      if (diaCerrado) await marcarCierreModificado(client, fecha, motivo, usuario);
      return { id, saldoOrigenPost, saldoDestinoPost, origen: origen.nombre, destino: destino.nombre };
    });

    return NextResponse.json({
      mensaje: `Transferencia de Bs. ${centsToStr(monto)} de ${out.origen} a ${out.destino} registrada.`,
      id: out.id,
      nuevoSaldoOrigen: centsToNumber(out.saldoOrigenPost),
      nuevoSaldoDestino: centsToNumber(out.saldoDestinoPost),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
