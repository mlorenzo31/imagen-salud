import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToStr, centsToNumber, toCents } from '@/lib/money';
import { exigirJornadaAlDia, marcarCierreModificado } from '@/lib/cierre';
import { camposFechaOperacion, resolverFechaOperacion } from '@/lib/fechaOperacion';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT e.*, c.nombre as cuenta_nombre, c.codigo as cuenta_codigo 
      FROM egresos_operativos e
      JOIN cuentas_bancarias c ON e.cuenta_id = c.id
      ORDER BY e.id DESC
      LIMIT 100
    `);
    return NextResponse.json(result.rows);
  } catch (err) {
    return errorResponse(err);
  }
}

const num = z.union([z.string(), z.number()]);
const schema = z.object({
  cuenta_id: z.coerce.number().int().positive(),
  categoria: z.string().min(1).max(100),
  concepto_libre: z.string().max(200).nullish(),
  monto_neto: num,
  comision_bancaria: num.optional(),
  referencia: z.string().max(100).nullish(),
  descripcion: z.string().max(500).nullish(),
  proveedor_beneficiario: z.string().max(200).nullish(),
  ...camposFechaOperacion,
});

export async function POST(req: NextRequest) {
  try {
    await exigirJornadaAlDia(req.headers.get('x-session-role') === 'admin');
    const b = await parseBody(req, schema);
    const usuario = sesionUsuario(req);
    const neto = toCents(b.monto_neto);
    const comision = toCents(b.comision_bancaria);
    if (neto <= 0) throw new ApiError(400, 'El monto neto del egreso debe ser mayor a 0.');
    if (comision < 0) throw new ApiError(400, 'La comisión bancaria no puede ser negativa.');
    const totalDebitado = neto + comision;
    const { fecha, hora, nota, diaCerrado, motivo } = await resolverFechaOperacion(b, req.headers.get('x-session-role') === 'admin');

    const out = await withTransaction(async (client) => {
      const cuentaRes = await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1 FOR UPDATE', [b.cuenta_id]);
      if (cuentaRes.rows.length === 0) throw new ApiError(400, 'La cuenta bancaria seleccionada no existe.');
      const cuenta = cuentaRes.rows[0];
      const saldoActual = toCents(cuenta.saldo_actual);
      if (saldoActual < totalDebitado) {
        throw new ApiError(400, `Saldo insuficiente en ${cuenta.nombre}. Disponible: ${centsToStr(saldoActual)} ${cuenta.moneda}, Requerido: ${centsToStr(totalDebitado)} ${cuenta.moneda}`);
      }
      const nuevoSaldo = saldoActual - totalDebitado;
      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2', [centsToStr(nuevoSaldo), b.cuenta_id]);

      const referencia = b.referencia || `EGR-${Date.now().toString().slice(-6)}`;
      const beneficiario = b.proveedor_beneficiario || 'Beneficiario General';
      const egresoRes = await client.query(
        `INSERT INTO egresos_operativos
           (cuenta_id, categoria, concepto_libre, monto_neto, comision_bancaria, total_debitado, moneda, referencia, descripcion, proveedor_beneficiario, fecha, hora, usuario)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [b.cuenta_id, b.categoria, b.concepto_libre || null, centsToStr(neto), centsToStr(comision), centsToStr(totalDebitado), cuenta.moneda,
         referencia, ((b.descripcion || '') + nota) || null, beneficiario, fecha, hora, usuario]
      );
      const egreso = egresoRes.rows[0];

      const conceptoPrincipal = `Egreso Operativo [${b.categoria}]: ${b.concepto_libre || b.descripcion || 'Gasto Operativo'} - Beneficiario: ${b.proveedor_beneficiario || 'General'}${nota}`;
      await client.query(
        `INSERT INTO transacciones_bancarias
           (cuenta_id, tipo_transaccion, concepto, monto_debito, monto_credito, saldo_posterior, moneda, referencia, beneficiario, categoria, es_comision, egreso_id, fecha, hora, usuario)
         VALUES ($1,'EGRESO_OPERATIVO',$2,$3,0,$4,$5,$6,$7,$8,false,$9,$10,$11,$12)`,
        [b.cuenta_id, conceptoPrincipal, centsToStr(neto), centsToStr(saldoActual - neto), cuenta.moneda, referencia,
         b.proveedor_beneficiario || 'General', b.categoria, egreso.id, fecha, hora, usuario]
      );
      if (comision > 0) {
        await client.query(
          `INSERT INTO transacciones_bancarias
             (cuenta_id, tipo_transaccion, concepto, monto_debito, monto_credito, saldo_posterior, moneda, referencia, beneficiario, categoria, es_comision, egreso_id, fecha, hora, usuario)
           VALUES ($1,'COMISION_BANCARIA',$2,$3,0,$4,$5,$6,'Banco Emisor','Gasto Financiero',true,$7,$8,$9,$10)`,
          [b.cuenta_id, `Gasto por Comisión Bancaria - Pago Móvil Ref: ${b.referencia || egreso.id}`, centsToStr(comision), centsToStr(nuevoSaldo),
           cuenta.moneda, b.referencia || null, egreso.id, fecha, hora, usuario]
        );
      }
      if (diaCerrado) await marcarCierreModificado(client, fecha, motivo, usuario);
      return { egreso, nuevoSaldo };
    });

    return NextResponse.json({
      mensaje: 'Egreso operativo registrado exitosamente.',
      egreso: out.egreso,
      saldoActualizado: centsToNumber(out.nuevoSaldo),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
