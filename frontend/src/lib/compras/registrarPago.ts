import type { PoolClient } from 'pg';
import { ApiError } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';
import type { Moneda } from './calculos';
import { estadoFactura, montoAplicado, validarPago } from './pagos';

export interface PagoCompra {
  facturaId: number; cuentaId: number; montoCuenta: number; tasa: number;
  fecha: string; hora: string; referencia?: string | null; usuario: string;
}

/** Lo ya pagado (vigente) de una factura, en su moneda. */
export async function pagadoFactura(client: PoolClient, facturaId: number): Promise<number> {
  const r = await client.query('SELECT COALESCE(SUM(monto_aplicado), 0)::text AS t FROM pagos_compra WHERE factura_id = $1 AND NOT reversado', [facturaId]);
  return toCents(r.rows[0].t);
}

/**
 * Registra un pago de compra dentro de la transacción: bloquea factura y cuenta, valida, descuenta la cuenta, guarda el
 * pago, el movimiento de tesorería PAGO_COMPRA y el nuevo estado de la factura.
 */
export async function registrarPagoCompra(client: PoolClient, p: PagoCompra): Promise<{ pagoId: number; estado: string; aplicado: number }> {
  const fr = await client.query(
    `SELECT f.*, pr.razon_social FROM facturas_compra f JOIN proveedores pr ON pr.id = f.proveedor_id WHERE f.id = $1 FOR UPDATE OF f`,
    [p.facturaId]
  );
  if (fr.rows.length === 0) throw new ApiError(404, 'Factura de compra no encontrada.');
  const f = fr.rows[0];
  if (f.estado === 'ANULADA') throw new ApiError(409, 'La factura está anulada.');
  const cr = await client.query('SELECT * FROM cuentas_bancarias WHERE id = $1 FOR UPDATE', [p.cuentaId]);
  if (cr.rows.length === 0) throw new ApiError(404, 'Cuenta no encontrada.');
  const cuenta = cr.rows[0];

  const neto = toCents(f.neto_a_pagar);
  const pagado = await pagadoFactura(client, f.id);
  let aplicado: number;
  try {
    aplicado = montoAplicado(p.montoCuenta, cuenta.moneda as Moneda, f.moneda as Moneda, p.tasa);
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
  const saldoAnt = toCents(cuenta.saldo_actual);
  const error = validarPago(aplicado, neto - pagado, saldoAnt, p.montoCuenta);
  if (error) throw new ApiError(400, error);
  aplicado = Math.min(aplicado, neto - pagado); // el céntimo de tolerancia no deja saldo negativo

  const saldoPost = saldoAnt - p.montoCuenta;
  await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoPost), cuenta.id]);
  const pago = await client.query(
    `INSERT INTO pagos_compra (factura_id, cuenta_id, monto_cuenta, tasa, monto_aplicado, fecha, referencia, usuario)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [f.id, cuenta.id, centsToStr(p.montoCuenta), cuenta.moneda === f.moneda ? null : p.tasa, centsToStr(aplicado), p.fecha, p.referencia || null, p.usuario]
  );
  const pagoId: number = pago.rows[0].id;
  const conversion = cuenta.moneda === f.moneda ? '' : ` (tasa ${p.tasa}; aplicado ${f.moneda === 'USD' ? '$' : 'Bs. '}${centsToStr(aplicado)})`;
  await client.query(
    `INSERT INTO movimientos_tesoreria
     (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, fecha, hora, usuario)
     VALUES ($1, 'PAGO_COMPRA', $2, $3, 0, $2, $4, $5, $6, $7, $8, $9, $10)`,
    [cuenta.id, centsToStr(p.montoCuenta), cuenta.moneda, centsToStr(saldoAnt), centsToStr(saldoPost), p.referencia || `COMPRA-${f.id}-${pagoId}`,
     `Pago factura N° ${f.numero_factura} a ${f.razon_social}${conversion}`, p.fecha, p.hora, p.usuario]
  );
  const estado = estadoFactura(neto, pagado + aplicado);
  await client.query('UPDATE facturas_compra SET estado = $1 WHERE id = $2', [estado, f.id]);
  return { pagoId, estado, aplicado };
}
