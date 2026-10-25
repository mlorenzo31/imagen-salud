import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse } from '@/lib/apiHelpers';
import { asegurarCompras } from '@/lib/compras/comprasDb';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Comprobantes de retención emitidos a proveedores (art. 18), por fecha de emisión (?desde, ?hasta). */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const desde = q.get('desde'), hasta = q.get('hasta');
    if ((desde && !ISO.test(desde)) || (hasta && !ISO.test(hasta))) throw new ApiError(400, 'Rango de fechas inválido.');
    await asegurarCompras();
    const r = await pool.query(
      `SELECT r.numero, to_char(r.fecha, 'YYYY-MM-DD') AS fecha, r.periodo_imposicion, to_char(r.fecha_entrega, 'YYYY-MM-DD') AS fecha_entrega,
              r.iva_retenido, r.islr_retenido, f.id AS factura_id, f.numero_factura, f.numero_control, f.moneda, f.estado,
              p.razon_social, p.rif, p.correo
       FROM retenciones_compra r JOIN facturas_compra f ON f.id = r.factura_id JOIN proveedores p ON p.id = f.proveedor_id
       WHERE ($1::date IS NULL OR r.fecha >= $1) AND ($2::date IS NULL OR r.fecha <= $2)
       ORDER BY r.numero DESC LIMIT 500`,
      [desde, hasta]
    );
    return NextResponse.json(r.rows);
  } catch (err) {
    return errorResponse(err);
  }
}
