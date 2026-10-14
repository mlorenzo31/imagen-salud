import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';
import { exigirJornadaAlDia, marcarCierreModificado } from '@/lib/cierre';
import { camposFechaOperacion, resolverFechaOperacion } from '@/lib/fechaOperacion';
import { asegurarCompras } from '@/lib/compras/comprasDb';
import { registrarPagoCompra } from '@/lib/compras/registrarPago';

const num = z.union([z.string(), z.number()]);
const schema = z.object({
  factura_id: z.number().int().positive(),
  cuenta_id: z.number().int().positive(),
  monto: num,
  tasa: num.optional(),
  referencia: z.string().max(100).nullish(),
  ...camposFechaOperacion,
});

/** Pagos de una factura (?factura_id=). */
export async function GET(req: NextRequest) {
  try {
    await asegurarCompras();
    const id = Number(new URL(req.url).searchParams.get('factura_id'));
    if (!id) throw new ApiError(400, 'Indique la factura.');
    const r = await pool.query(
      `SELECT p.*, to_char(p.fecha, 'YYYY-MM-DD') AS fecha, c.nombre AS cuenta, c.moneda AS moneda_cuenta
       FROM pagos_compra p JOIN cuentas_bancarias c ON c.id = p.cuenta_id WHERE p.factura_id = $1 ORDER BY p.id`,
      [id]
    );
    return NextResponse.json(r.rows);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Pago (completo o parcial) de una factura de compra a crédito, desde cualquier cuenta. */
export async function POST(req: NextRequest) {
  try {
    const esAdmin = req.headers.get('x-session-role') === 'admin';
    await exigirJornadaAlDia(esAdmin);
    const b = await parseBody(req, schema);
    const usuario = sesionUsuario(req);
    const { fecha, hora, diaCerrado, motivo } = await resolverFechaOperacion(b, esAdmin);
    await asegurarCompras();
    const out = await withTransaction(async (client) => {
      const r = await registrarPagoCompra(client, {
        facturaId: b.factura_id, cuentaId: b.cuenta_id, montoCuenta: toCents(b.monto),
        tasa: b.tasa === undefined ? 0 : Number(String(b.tasa).replace(',', '.')), fecha, hora, referencia: b.referencia, usuario,
      });
      if (diaCerrado) await marcarCierreModificado(client, fecha, motivo, usuario);
      return r;
    });
    return NextResponse.json({ mensaje: out.estado === 'PAGADA' ? 'Pago registrado: la factura quedó pagada.' : 'Pago parcial registrado.', ...out });
  } catch (err) {
    return errorResponse(err);
  }
}
