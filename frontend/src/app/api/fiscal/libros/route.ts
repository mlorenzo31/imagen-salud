import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';
import { asegurarFiscal } from '@/lib/fiscal/fiscalDb';
import { libroVentas, type DocLibro } from '@/lib/fiscal/libroVentas';
import { cumplimientoEnvio, MOTIVOS_CONTINGENCIA, type MotivoContingencia } from '@/lib/fiscal/contingencia';
import type { DocumentoFiscal } from '@/lib/fiscal/factura';

/**
 * Libros y reportes fiscales del mes (?mes=AAAA-MM): libro de ventas, documentos aún sin N° de control,
 * anulaciones por nota de crédito (originales conservados, art. 21) y contingencias (art. 7). Admin y asistente.
 */
export async function GET(req: NextRequest) {
  try {
    const mes = req.nextUrl.searchParams.get('mes') ?? '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new ApiError(400, 'Indique el mes como AAAA-MM.');
    await asegurarFiscal();
    const [docs, pendientes, anulados, contingencias] = await Promise.all([
      pool.query(
        `SELECT d.id, d.tipo, d.serie, d.numero, d.numero_control, to_char(d.fecha_emision, 'YYYY-MM-DD') AS fecha, d.medio,
                d.receptor_nombre, d.receptor_documento, d.payload,
                COALESCE((SELECT SUM(x.iva_retenido) FROM retenciones_recibidas x WHERE x.documento_id = d.id AND x.anulada_en IS NULL), 0) AS iva_retenido,
                (SELECT string_agg(x.numero_comprobante, ', ') FROM retenciones_recibidas x WHERE x.documento_id = d.id AND x.anulada_en IS NULL AND x.iva_retenido > 0) AS comprobantes
         FROM documentos_fiscales d
         WHERE to_char(d.fecha_emision, 'YYYY-MM') = $1 AND d.estado IN ('EMITIDO', 'CONTINGENCIA')`,
        [mes]
      ),
      pool.query(
        `SELECT id, tipo, numero, to_char(fecha_emision, 'YYYY-MM-DD') AS fecha, estado, receptor_nombre, ultimo_error
         FROM documentos_fiscales WHERE to_char(fecha_emision, 'YYYY-MM') = $1 AND estado IN ('PENDIENTE', 'ENVIANDO') ORDER BY id`,
        [mes]
      ),
      pool.query(
        `SELECT to_char(nc.fecha_emision, 'YYYY-MM-DD') AS fecha, nc.numero AS nota, nc.numero_control AS nota_control, nc.motivo,
                f.serie, f.numero AS factura, f.numero_control AS factura_control, to_char(f.fecha_emision, 'YYYY-MM-DD') AS factura_fecha,
                f.receptor_nombre, f.total_bs AS factura_total_bs, nc.total_bs AS nota_total_bs, nc.total_usd >= f.total_usd AS total
         FROM documentos_fiscales nc JOIN documentos_fiscales f ON f.id = nc.doc_referencia_id
         WHERE nc.tipo = 'NOTA_CREDITO' AND nc.estado <> 'ERROR' AND to_char(nc.fecha_emision, 'YYYY-MM') = $1
         ORDER BY nc.fecha_emision, nc.numero`,
        [mes]
      ),
      pool.query(
        `SELECT c.id, c.motivo, to_char(c.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, c.hora_inicio,
                to_char(c.fecha_fin, 'YYYY-MM-DD') AS fecha_fin, c.hora_fin, c.abierta_por, c.cerrada_por,
                to_char(c.enviada_en AT TIME ZONE 'America/Caracas', 'YYYY-MM-DD') AS fecha_envio,
                (SELECT count(*)::int FROM documentos_fiscales d WHERE d.contingencia_id = c.id) AS documentos
         FROM contingencias c
         WHERE to_char(c.fecha_inicio, 'YYYY-MM') = $1 OR to_char(c.fecha_fin, 'YYYY-MM') = $1 OR c.enviada_en IS NULL
         ORDER BY c.id`,
        [mes]
      ),
    ]);
    const lista: DocLibro[] = docs.rows.map((x) => {
      const p = x.payload as DocumentoFiscal;
      return {
        id: x.id, tipo: x.tipo, serie: x.serie, numero: x.numero, numeroControl: x.numero_control, fecha: x.fecha, medio: x.medio,
        receptorNombre: x.receptor_nombre, receptorDocumento: x.receptor_documento, totales: p.totales,
        referencia: p.referencia ? { numero: p.referencia.numero, numeroControl: p.referencia.numeroControl } : null,
        ivaRetenido: toCents(x.iva_retenido), comprobanteRetencion: x.comprobantes,
      };
    });
    return NextResponse.json({
      mes,
      ventas: libroVentas(lista),
      pendientes: pendientes.rows,
      anulados: anulados.rows,
      contingencias: contingencias.rows.map((c) => ({
        ...c, motivo: MOTIVOS_CONTINGENCIA[c.motivo as MotivoContingencia] ?? c.motivo, cumplimiento: cumplimientoEnvio(c.fecha_fin, c.fecha_envio),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
