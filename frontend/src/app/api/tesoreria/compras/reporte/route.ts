import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { mulRate, toCents } from '@/lib/money';
import { rangoValido } from '@/lib/resumenPeriodo';
import { asegurarCompras } from '@/lib/compras/comprasDb';
import { armarReporte, type LineaReporte, type MovCaja } from '@/lib/compras/reporte';

/** Tasa del día para operaciones que no la guardan: la de las facturas de pacientes de ese día o del anterior más cercano. */
const TASA_DIA = (fecha: string) =>
  `(SELECT tasa_bcv FROM facturas_caja WHERE fecha <= ${fecha} AND tasa_bcv > 0 ORDER BY fecha DESC, id DESC LIMIT 1)`;

/** Equivalentes en Bs y $ (centavos) de un monto en su moneda a la tasa dada. */
function equivalentes(monto: number, moneda: string, tasa: number): { bs: number; usd: number } {
  if (!(tasa > 0)) return moneda === 'USD' ? { bs: 0, usd: monto } : { bs: monto, usd: 0 };
  return moneda === 'USD' ? { bs: mulRate(monto, tasa), usd: monto } : { bs: monto, usd: Math.round(monto / tasa) };
}

/** Egresos reales (caja) contra ingresos del período, con detalle por proveedor, categoría y producto. */
export async function GET(req: NextRequest) {
  try {
    const q = new URL(req.url).searchParams;
    const desde = q.get('desde') || fechaHoraLocal().fecha;
    const hasta = q.get('hasta') || desde;
    const error = rangoValido(desde, hasta);
    if (error) throw new ApiError(400, error);
    await asegurarCompras();
    const rango = [desde, hasta];

    const [fact, extra, pagos, gastos, hon, com, porPagarQ, lineasQ] = await Promise.all([
      pool.query(`SELECT to_char(fecha,'YYYY-MM-DD') f, (COALESCE(pago_punto,0)+COALESCE(pago_movil,0)+COALESCE(pago_efectivo_bs,0))::text bs, COALESCE(pago_divisas,0)::text dv, tasa_bcv::text tasa
                  FROM facturas_caja WHERE fecha BETWEEN $1 AND $2 AND estado NOT IN ('ANULADA','ANULADA_SALA')`, rango),
      pool.query(`SELECT to_char(i.fecha,'YYYY-MM-DD') f, i.monto::text monto, i.moneda, ${TASA_DIA('i.fecha')}::text tasa
                  FROM ingresos_extraordinarios i WHERE i.fecha BETWEEN $1 AND $2`, rango),
      pool.query(`SELECT to_char(p.fecha,'YYYY-MM-DD') f, p.monto_cuenta::text monto, c.moneda, COALESCE(p.tasa, ${TASA_DIA('p.fecha')}, f.tasa)::text tasa, pr.razon_social
                  FROM pagos_compra p JOIN cuentas_bancarias c ON c.id = p.cuenta_id JOIN facturas_compra f ON f.id = p.factura_id
                  JOIN proveedores pr ON pr.id = f.proveedor_id WHERE NOT p.reversado AND p.fecha BETWEEN $1 AND $2`, rango),
      pool.query(`SELECT to_char(e.fecha,'YYYY-MM-DD') f, e.total_debitado::text monto, e.moneda, e.categoria, e.concepto_libre, e.proveedor_beneficiario, ${TASA_DIA('e.fecha')}::text tasa
                  FROM egresos_operativos e WHERE e.fecha BETWEEN $1 AND $2`, rango),
      pool.query(`SELECT to_char(fecha_pago,'YYYY-MM-DD') f, (pago_movil_bs+comision_pago_movil_bs+efectivo_bs)::text bs, efectivo_usd::text usd, tasa_cambio_bcv::text tasa
                  FROM pagos_honorarios WHERE fecha_pago BETWEEN $1 AND $2`, rango),
      pool.query(`SELECT to_char(m.fecha,'YYYY-MM-DD') f, m.comision::text monto, m.moneda, ${TASA_DIA('m.fecha')}::text tasa
                  FROM movimientos_tesoreria m WHERE m.fecha BETWEEN $1 AND $2 AND m.comision > 0
                    AND m.tipo IN ('CAMBIO_DIVISA_EGRESO','VENTA_DIVISA_INGRESO','TRANSFERENCIA_SALIDA')`, rango),
      // Comprometido al cierre del período: facturas hasta `hasta` menos lo pagado hasta esa fecha (no el estado de hoy).
      pool.query(`SELECT * FROM (
                    SELECT pr.razon_social, f.moneda, f.tasa::text tasa,
                           f.neto_a_pagar - COALESCE((SELECT SUM(monto_aplicado) FROM pagos_compra p
                                                      WHERE p.factura_id = f.id AND NOT p.reversado AND p.fecha <= $1), 0) AS pend
                    FROM facturas_compra f JOIN proveedores pr ON pr.id = f.proveedor_id
                    WHERE f.estado <> 'ANULADA' AND f.fecha <= $1) x WHERE pend > 0.01`, [hasta]),
      pool.query(`SELECT to_char(f.fecha,'YYYY-MM-DD') fecha, f.numero_factura, pr.razon_social, f.moneda, f.tasa::text tasa, l.descripcion, l.cantidad::text cantidad,
                         l.precio_unitario::text precio, l.alicuota, l.subtotal::text subtotal,
                         COALESCE(pc.nombre, l.descripcion) producto, COALESCE(pc.categoria, 'Sin categoría') categoria
                  FROM facturas_compra_lineas l JOIN facturas_compra f ON f.id = l.factura_id JOIN proveedores pr ON pr.id = f.proveedor_id
                  LEFT JOIN productos_compra pc ON pc.id = l.producto_id
                  WHERE f.fecha BETWEEN $1 AND $2 AND f.estado <> 'ANULADA' ORDER BY f.fecha, f.id, l.id`, rango),
    ]);

    const movs: MovCaja[] = [];
    for (const r of fact.rows) {
      const tasa = Number(r.tasa); const bs = toCents(r.bs); const dv = toCents(r.dv);
      movs.push({ fecha: r.f, tipo: 'INGRESO_FACTURA', bs: bs + (tasa > 0 ? mulRate(dv, tasa) : 0), usd: dv + (tasa > 0 ? Math.round(bs / tasa) : 0) });
    }
    for (const r of extra.rows) movs.push({ fecha: r.f, tipo: 'INGRESO_EXTRA', ...equivalentes(toCents(r.monto), r.moneda, Number(r.tasa)) });
    for (const r of pagos.rows) movs.push({ fecha: r.f, tipo: 'PAGO_COMPRA', proveedor: r.razon_social, ...equivalentes(toCents(r.monto), r.moneda, Number(r.tasa)) });
    for (const r of gastos.rows) movs.push({ fecha: r.f, tipo: 'GASTO_MENOR', categoria: r.categoria || 'Gastos menores', ...equivalentes(toCents(r.monto), r.moneda, Number(r.tasa)) });
    for (const r of hon.rows) {
      const tasa = Number(r.tasa); const bs = toCents(r.bs); const usd = toCents(r.usd);
      movs.push({ fecha: r.f, tipo: 'HONORARIOS', bs: bs + (tasa > 0 ? mulRate(usd, tasa) : 0), usd: usd + (tasa > 0 ? Math.round(bs / tasa) : 0) });
    }
    for (const r of com.rows) movs.push({ fecha: r.f, tipo: 'COMISION', ...equivalentes(toCents(r.monto), r.moneda, Number(r.tasa)) });

    const porPagar = porPagarQ.rows.map((r) => ({ proveedor: r.razon_social as string, ...equivalentes(toCents(r.pend), r.moneda, Number(r.tasa)) }));
    const lineas: LineaReporte[] = lineasQ.rows.map((r) => ({
      producto: r.producto, categoria: r.categoria, cantidad: Math.round(Number(r.cantidad) * 1000),
      ...equivalentes(toCents(r.subtotal), r.moneda, Number(r.tasa)),
    }));

    return NextResponse.json({
      desde, hasta,
      ...armarReporte(movs, porPagar, lineas, desde, hasta),
      detalleCompras: lineasQ.rows,
      detalleGastos: gastos.rows.map((r) => ({ fecha: r.f, categoria: r.categoria, concepto: r.concepto_libre, beneficiario: r.proveedor_beneficiario, monto: r.monto, moneda: r.moneda })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
