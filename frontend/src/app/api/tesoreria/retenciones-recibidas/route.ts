import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody, sesionUsuario } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';
import { asegurarFiscal } from '@/lib/fiscal/fiscalDb';
import { retencionRecibidaSchema, validarContraFactura } from '@/lib/fiscal/retencionRecibida';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Retenciones recibidas (?desde, ?hasta por fecha del comprobante), con la factura de la clínica que afectan. */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const desde = q.get('desde'), hasta = q.get('hasta');
    if ((desde && !ISO.test(desde)) || (hasta && !ISO.test(hasta))) throw new ApiError(400, 'Rango de fechas inválido.');
    await asegurarFiscal();
    const r = await pool.query(
      `SELECT r.id, r.agente_rif, r.agente_razon_social, r.numero_comprobante, to_char(r.fecha_comprobante, 'YYYY-MM-DD') AS fecha_comprobante,
              r.periodo, r.iva_retenido, r.islr_retenido, r.observacion, r.usuario, r.anulada_en IS NOT NULL AS anulada, r.motivo_anulacion,
              d.serie, d.numero AS factura_numero, d.numero_control, to_char(d.fecha_emision, 'YYYY-MM-DD') AS factura_fecha, d.total_bs, d.total_iva_bs
       FROM retenciones_recibidas r JOIN documentos_fiscales d ON d.id = r.documento_id
       WHERE ($1::date IS NULL OR r.fecha_comprobante >= $1) AND ($2::date IS NULL OR r.fecha_comprobante <= $2)
       ORDER BY r.fecha_comprobante DESC, r.id DESC LIMIT 500`,
      [desde, hasta]
    );
    return NextResponse.json(r.rows);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Registra el comprobante que entregó el agente de retención, validado contra la factura fiscal de la clínica. */
export async function POST(req: NextRequest) {
  try {
    const b = await parseBody(req, retencionRecibidaSchema);
    await asegurarFiscal();
    const f = await pool.query(
      `SELECT d.id, d.estado, d.receptor_documento, d.total_iva_bs, (d.total_bs - d.total_iva_bs - d.total_igtf_bs) AS base_bs,
              EXISTS (SELECT 1 FROM documentos_fiscales n WHERE n.doc_referencia_id = d.id AND n.tipo = 'NOTA_CREDITO'
                      AND n.estado <> 'ERROR' AND n.total_usd >= d.total_usd) AS anulada,
              (SELECT COALESCE(SUM(x.iva_retenido), 0) FROM retenciones_recibidas x WHERE x.documento_id = d.id AND x.anulada_en IS NULL) AS iva_previo,
              (SELECT COALESCE(SUM(x.islr_retenido), 0) FROM retenciones_recibidas x WHERE x.documento_id = d.id AND x.anulada_en IS NULL) AS islr_previo
       FROM documentos_fiscales d WHERE d.tipo = 'FACTURA' AND d.serie = $1 AND d.numero = $2`,
      [b.facturaSerie, b.facturaNumero]
    );
    const fac = f.rows[0];
    if (!fac) throw new ApiError(404, `No existe la factura fiscal ${b.facturaSerie ? `serie ${b.facturaSerie} ` : ''}N° ${b.facturaNumero}.`);
    const error = validarContraFactura(
      { ivaRetenido: b.ivaRetenido, islrRetenido: b.islrRetenido, agenteRif: b.agenteRif },
      { ivaBs: toCents(fac.total_iva_bs), baseBs: toCents(fac.base_bs), receptorDocumento: fac.receptor_documento, anulada: fac.anulada || fac.estado === 'ERROR',
        ivaPrevio: toCents(fac.iva_previo), islrPrevio: toCents(fac.islr_previo) },
    );
    if (error) throw new ApiError(400, error);
    const r = await pool.query(
      `INSERT INTO retenciones_recibidas (documento_id, agente_rif, agente_razon_social, numero_comprobante, fecha_comprobante, periodo,
         iva_retenido, islr_retenido, observacion, usuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [fac.id, b.agenteRif, b.agenteRazonSocial.toUpperCase(), b.numeroComprobante, b.fechaComprobante, b.fechaComprobante.slice(0, 7),
        centsToStr(b.ivaRetenido), centsToStr(b.islrRetenido), b.observacion || null, sesionUsuario(req)]
    ).catch((e: { code?: string }) => {
      if (e.code === '23505') throw new ApiError(409, `El comprobante ${b.numeroComprobante} de ${b.agenteRif} ya está registrado.`);
      throw e;
    });
    return NextResponse.json({ id: r.rows[0].id });
  } catch (err) {
    return errorResponse(err);
  }
}
