import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';
import { asegurarCompras } from '@/lib/compras/comprasDb';
import { filasLibroCompras, type FacturaLibro } from '@/lib/compras/reporte';

/** Libro de Compras del mes (?mes=AAAA-MM), en Bs: una fila por alícuota y totales por alícuota. */
export async function GET(req: NextRequest) {
  try {
    const mes = new URL(req.url).searchParams.get('mes') ?? '';
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new ApiError(400, 'Indique el mes como AAAA-MM.');
    await asegurarCompras();
    const r = await pool.query(
      `SELECT to_char(f.fecha,'YYYY-MM-DD') fecha, pr.rif, pr.razon_social, f.numero_factura, f.numero_control, f.estado, f.moneda,
              f.tasa::text tasa, f.base_exenta::text base_exenta, f.total::text total, f.iva_retenido::text iva_retenido,
              f.comprobante_retencion, f.detalle_iva
       FROM facturas_compra f JOIN proveedores pr ON pr.id = f.proveedor_id
       WHERE to_char(f.fecha, 'YYYY-MM') = $1 ORDER BY f.fecha, f.id`,
      [mes]
    );
    const facturas: FacturaLibro[] = r.rows.map((f) => ({
      fecha: f.fecha, rif: f.rif, razon_social: f.razon_social, numero_factura: f.numero_factura, numero_control: f.numero_control,
      estado: f.estado, moneda: f.moneda, tasa: Number(f.tasa), base_exenta: toCents(f.base_exenta), total: toCents(f.total),
      iva_retenido: toCents(f.iva_retenido), comprobante: f.comprobante_retencion, detalle_iva: f.detalle_iva ?? [],
    }));
    return NextResponse.json({ mes, ...filasLibroCompras(facturas) });
  } catch (err) {
    return errorResponse(err);
  }
}
