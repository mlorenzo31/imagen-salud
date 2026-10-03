import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';

const schema = z.object({
  cuenta_id: z.coerce.number().int().positive(),
  categoria: z.string().min(1).max(100),
  concepto_libre: z.string().max(200).nullish(),
  monto: z.union([z.string(), z.number()]),
  referencia: z.string().max(100).nullish(),
  descripcion: z.string().max(500).nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const b = await parseBody(request, schema);
    const usuario = sesionUsuario(request);
    const montoCents = toCents(b.monto);
    if (montoCents <= 0) throw new ApiError(400, 'El monto del ingreso extraordinario debe ser mayor a 0.');
    const { fecha, hora } = fechaHoraLocal();

    const out = await withTransaction(async (client) => {
      const cuentaRes = await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1 FOR UPDATE', [b.cuenta_id]);
      if (cuentaRes.rows.length === 0) throw new ApiError(404, 'Cuenta bancaria no encontrada.');
      const cuenta = cuentaRes.rows[0];
      const saldoAnt = toCents(cuenta.saldo_actual);
      const saldoPost = saldoAnt + montoCents;

      await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoPost), b.cuenta_id]);
      const ing = await client.query(
        `INSERT INTO ingresos_extraordinarios
         (cuenta_id, categoria, concepto_libre, monto, moneda, referencia, descripcion, fecha, hora, usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [b.cuenta_id, b.categoria, b.concepto_libre || null, centsToStr(montoCents), cuenta.moneda, b.referencia || null, b.descripcion || null, fecha, hora, usuario]
      );
      const concepto = `Ingreso Extraordinario [${b.categoria}]` + (b.concepto_libre ? `: ${b.concepto_libre}` : '');
      await client.query(
        `INSERT INTO movimientos_tesoreria
         (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
         VALUES ($1, 'INGRESO_EXTRAORDINARIO', $2, $3, 0, $2, $4, $5, $6, $7, $8, $9, $10)`,
        [b.cuenta_id, centsToStr(montoCents), cuenta.moneda, centsToStr(saldoAnt), centsToStr(saldoPost), b.referencia || `ING-EXT-${ing.rows[0].id}`, concepto, fecha, hora, usuario]
      );
      return { ingreso: ing.rows[0], saldoPost };
    });

    return NextResponse.json({
      mensaje: 'Ingreso extraordinario registrado exitosamente.',
      ingreso: out.ingreso,
      saldoActualizado: Number(centsToStr(out.saldoPost)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const params: string[] = [];
    let q = `
      SELECT i.*, c.nombre as cuenta_nombre, c.codigo as cuenta_codigo
      FROM ingresos_extraordinarios i
      JOIN cuentas_bancarias c ON i.cuenta_id = c.id
      WHERE 1=1`;
    const filtros: [string, string][] = [['desde', 'i.fecha >='], ['hasta', 'i.fecha <='], ['cuenta_id', 'i.cuenta_id =']];
    for (const [param, cond] of filtros) {
      const v = sp.get(param);
      if (v) {
        params.push(v);
        q += ` AND ${cond} $${params.length}`;
      }
    }
    q += ' ORDER BY i.id DESC';
    const result = await pool.query(q, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    return errorResponse(err);
  }
}
