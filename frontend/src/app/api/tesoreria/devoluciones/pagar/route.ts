import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';
import { esAnulada } from '@/lib/estados';
import { asegurarDevoluciones } from '@/lib/devoluciones';
import { exigirPinSesion } from '@/lib/pin';

const schema = z.object({
  id: z.coerce.number().int().positive(),
  referencia: z.string().trim().min(3, 'Indique la referencia bancaria de la devolución.').max(100),
  pin: z.string().min(1),
});

/**
 * Paga una devolución pendiente como egreso. Validaciones: clave del usuario, factura realmente anulada, devolución
 * vigente (una sola vez), monto fijado por el sistema (no editable), referencia obligatoria y saldo suficiente.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await parseBody(req, schema);
    exigirPinSesion(req, b.pin);
    const usuario = sesionUsuario(req);
    const { fecha, hora } = fechaHoraLocal();
    await asegurarDevoluciones(pool);

    const out = await withTransaction(async (client) => {
      const dRes = await client.query('SELECT * FROM devoluciones_facturas WHERE id = $1 FOR UPDATE', [b.id]);
      if (dRes.rows.length === 0) throw new ApiError(404, 'Devolución no encontrada.');
      const d = dRes.rows[0];
      if (d.estado !== 'PENDIENTE') throw new ApiError(409, 'Esta devolución ya fue pagada.', 'YA_PAGADA');

      const fRes = await client.query('SELECT estado, nombre_paciente FROM facturas_caja WHERE id = $1', [d.factura_id]);
      if (fRes.rows.length === 0 || !esAnulada(fRes.rows[0].estado)) throw new ApiError(409, 'La factura no está anulada: no procede la devolución.', 'FACTURA_NO_ANULADA');

      const monto = toCents(d.monto_bs);
      let egresoId: number | null = null;
      if (d.afecta_cuenta) {
        const cRes = await client.query('SELECT * FROM cuentas_bancarias WHERE codigo = $1 FOR UPDATE', [d.cuenta_codigo]);
        if (cRes.rows.length === 0) throw new ApiError(400, 'La cuenta de la devolución no existe.');
        const cuenta = cRes.rows[0];
        const saldo = toCents(cuenta.saldo_actual);
        if (saldo < monto) throw new ApiError(400, `Saldo insuficiente en ${cuenta.nombre}. Disponible: ${centsToStr(saldo)}, requerido: ${centsToStr(monto)}.`);
        await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldo - monto), cuenta.id]);
        const concepto = `Devolución factura ${d.factura_id} (${fRes.rows[0].nombre_paciente}) por ${d.medio === 'PAGO_MOVIL' ? 'pago móvil' : 'punto de venta'}`;
        const e = await client.query(
          `INSERT INTO egresos_operativos (cuenta_id, categoria, concepto_libre, monto_neto, comision_bancaria, total_debitado, moneda, referencia, descripcion, proveedor_beneficiario, fecha, hora, usuario)
           VALUES ($1,'Devolución de factura',$2,$3,0,$3,'BS',$4,$2,$5,$6,$7,$8) RETURNING id`,
          [cuenta.id, concepto, centsToStr(monto), b.referencia, fRes.rows[0].nombre_paciente || 'Paciente', fecha, hora, usuario],
        );
        egresoId = e.rows[0].id as number;
        await client.query(
          `INSERT INTO transacciones_bancarias (cuenta_id, tipo_transaccion, concepto, monto_debito, monto_credito, saldo_posterior, moneda, referencia, beneficiario, categoria, es_comision, egreso_id, fecha, hora, usuario)
           VALUES ($1,'EGRESO_OPERATIVO',$2,$3,0,$4,'BS',$5,$6,'Devolución de factura',false,$7,$8,$9,$10)`,
          [cuenta.id, concepto, centsToStr(monto), centsToStr(saldo - monto), b.referencia, fRes.rows[0].nombre_paciente || 'Paciente', egresoId, fecha, hora, usuario],
        );
      }
      await client.query(
        `UPDATE devoluciones_facturas SET estado = 'PAGADA', egreso_id = $2, referencia = $3, pagada_en = now(), pagada_por = $4 WHERE id = $1`,
        [b.id, egresoId, b.referencia, usuario],
      );
      return { monto, egresoId, afecta: d.afecta_cuenta as boolean };
    });

    return NextResponse.json({ ok: true, mensaje: 'Devolución pagada y registrada como egreso.', monto_bs: centsToStr(out.monto), egreso_id: out.egresoId });
  } catch (err) {
    return errorResponse(err);
  }
}
