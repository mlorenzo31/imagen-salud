import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';
import { asegurarCompras } from '@/lib/compras/comprasDb';
import { montosComprobante } from '@/lib/compras/comprobante';
import { pdfComprobanteRetencion } from '@/lib/compras/comprobantePdf';
import { asegurarFiscal, leerConfigEmisor } from '@/lib/fiscal/fiscalDb';

/** Comprobante de retención en PDF (art. 18). El agente de retención es la clínica (Catálogos > Datos fiscales). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  try {
    const { numero } = await params;
    await Promise.all([asegurarCompras(), asegurarFiscal()]);
    const emisor = await leerConfigEmisor();
    if (!emisor.razonSocial || !emisor.rif || !emisor.domicilioFiscal) throw new ApiError(409, 'Configure los datos fiscales de la clínica (Catálogos > Datos fiscales).');
    const r = await pool.query(
      `SELECT r.numero, to_char(r.fecha, 'YYYY-MM-DD') AS fecha, r.periodo_imposicion, to_char(r.fecha_entrega, 'YYYY-MM-DD') AS fecha_entrega,
              r.iva_retenido, r.islr_retenido, f.numero_factura, f.numero_control, to_char(f.fecha, 'YYYY-MM-DD') AS fecha_factura,
              f.moneda, f.tasa, f.estado, f.total, f.total_base, f.base_exenta, f.total_iva, p.razon_social, p.rif, p.direccion, p.correo
       FROM retenciones_compra r JOIN facturas_compra f ON f.id = r.factura_id JOIN proveedores p ON p.id = f.proveedor_id
       WHERE r.numero = $1`,
      [numero]
    );
    const x = r.rows[0];
    if (!x) throw new ApiError(404, 'Comprobante no encontrado.');
    const pdf = pdfComprobanteRetencion({
      numero: x.numero, fechaEmision: x.fecha, fechaEntrega: x.fecha_entrega, periodoImposicion: x.periodo_imposicion,
      agente: { razonSocial: emisor.razonSocial, rif: emisor.rif, domicilio: emisor.domicilioFiscal },
      proveedor: { razonSocial: x.razon_social, rif: x.rif, domicilio: x.direccion, correo: x.correo },
      factura: { numero: x.numero_factura, numeroControl: x.numero_control, fecha: x.fecha_factura },
      montos: montosComprobante({
        moneda: x.moneda, tasa: x.tasa, total: toCents(x.total), base: toCents(x.total_base), iva: toCents(x.total_iva),
        ivaRetenido: toCents(x.iva_retenido), islrRetenido: toCents(x.islr_retenido),
      }),
      leyenda: emisor.leyendaProvidencia,
      anulado: x.estado === 'ANULADA',
    });
    return new NextResponse(Buffer.from(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="comprobante_retencion_${x.numero}.pdf"` },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
