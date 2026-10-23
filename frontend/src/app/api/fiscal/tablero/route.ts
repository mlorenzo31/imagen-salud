import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { mulRate, toCents } from '@/lib/money';
import { ESTADOS_ANULADOS } from '@/lib/estados';
import { asegurarFiscal, leerConfigEmisor } from '@/lib/fiscal/fiscalDb';
import { clasificar, diferenciasDocumentos, resumen, type FilaCobro } from '@/lib/fiscal/tablero';
import { contingenciaVigente } from '@/lib/fiscal/contingenciaDb';
import { plazoEnvio } from '@/lib/fiscal/contingencia';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Control fiscal del período: cada cobro no anulado con su estado fiscal (emitida, en proceso, rechazada,
 * diferida, vencida o sin factura), el resumen en USD/Bs y las facturas cuyo monto no cuadra con sus cobros.
 * Solo cuenta cobros desde el inicio de la facturación fiscal (Catálogos > Datos fiscales). Admin y asistente.
 */
export async function GET(req: NextRequest) {
  try {
    const hoy = fechaHoraLocal().fecha;
    const sp = req.nextUrl.searchParams;
    const desdeIn = sp.get('desde') ?? `${hoy.slice(0, 7)}-01`;
    const hasta = sp.get('hasta') ?? hoy;
    if (!ISO.test(desdeIn) || !ISO.test(hasta) || desdeIn > hasta) throw new ApiError(400, 'Rango de fechas inválido.');
    await asegurarFiscal();
    const { inicioFacturacion } = await leerConfigEmisor();
    const c = await contingenciaVigente(pool, hoy);
    const contingencia = c && { ...c, plazoEnvio: c.fechaFin ? plazoEnvio(c.fechaFin) : null };
    if (!inicioFacturacion) {
      const vacio = { n: 0, usd: 0, bs: 0 };
      return NextResponse.json({ inicioFacturacion: null, desde: desdeIn, hasta, filas: [], resumen: resumen([], hoy), diferencias: [], notas: { credito: vacio, debito: vacio }, anuladosSinNota: [], contingencia });
    }
    const desde = desdeIn < inicioFacturacion ? inicioFacturacion : desdeIn;

    const r = await pool.query(
      `SELECT f.id, f.fecha::text AS fecha, f.nombre_paciente, f.cedula_paciente, f.precio_usd, f.tasa_bcv,
              f.receptor_razon_social, d.id AS doc_id, d.estado AS doc_estado, d.numero AS doc_numero, d.numero_control AS doc_control,
              fd.motivo, fd.facturar_antes_de::text AS facturar_antes_de
       FROM facturas_caja f
       LEFT JOIN documentos_fiscales_cobros l ON l.factura_caja_id = f.id
       LEFT JOIN documentos_fiscales d ON d.id = l.documento_id
       LEFT JOIN facturacion_diferida fd ON fd.factura_caja_id = f.id
       WHERE f.fecha BETWEEN $1 AND $2 AND COALESCE(f.estado, '') <> ALL($3::text[])
       ORDER BY f.fecha, f.id`,
      [desde, hasta, ESTADOS_ANULADOS]
    );
    const filas = r.rows.map((x) => {
      const usd = toCents(x.precio_usd);
      const fila: FilaCobro = {
        id: x.id, fecha: x.fecha, paciente: x.nombre_paciente, totalUsd: usd, totalBs: mulRate(usd, x.tasa_bcv),
        docId: x.doc_id, docEstado: x.doc_estado, docNumero: x.doc_numero, docControl: x.doc_control,
        motivoDiferido: x.motivo, facturarAntesDe: x.facturar_antes_de,
      };
      return { ...fila, cedula: x.cedula_paciente, facturarA: x.receptor_razon_social, estado: clasificar(fila, hoy) };
    });

    // Facturas del período: venta (sin IVA ni IGTF) frente a la suma de los cobros que cubren.
    const docs = await pool.query(
      `SELECT d.id, d.numero, (d.total_usd - d.total_iva_usd - d.total_igtf_usd) AS venta, COALESCE(SUM(f.precio_usd), 0) AS cobros
       FROM documentos_fiscales d
       JOIN documentos_fiscales_cobros l ON l.documento_id = d.id
       JOIN facturas_caja f ON f.id = l.factura_caja_id
       WHERE d.tipo = 'FACTURA' AND d.id IN (SELECT l2.documento_id FROM documentos_fiscales_cobros l2 JOIN facturas_caja f2 ON f2.id = l2.factura_caja_id WHERE f2.fecha BETWEEN $1 AND $2)
       GROUP BY d.id ORDER BY d.id`,
      [desde, hasta]
    );
    const diferencias = diferenciasDocumentos(docs.rows.map((d) => ({ docId: d.id, numero: d.numero, ventaUsd: toCents(d.venta), cobrosUsd: toCents(d.cobros) })));

    // Notas de crédito/débito emitidas en el período, y cobros anulados cuya factura quedó sin nota de crédito.
    const notas = await pool.query(
      `SELECT tipo, count(*)::int AS n, COALESCE(SUM(total_usd), 0) AS usd, COALESCE(SUM(total_bs), 0) AS bs
       FROM documentos_fiscales WHERE tipo <> 'FACTURA' AND estado <> 'ERROR' AND fecha_emision BETWEEN $1 AND $2 GROUP BY tipo`,
      [desde, hasta]
    );
    const anuladosSinNota = await pool.query(
      `SELECT f.id, f.fecha::text AS fecha, f.nombre_paciente AS paciente, d.numero
       FROM facturas_caja f
       JOIN documentos_fiscales_cobros l ON l.factura_caja_id = f.id
       JOIN documentos_fiscales d ON d.id = l.documento_id AND d.estado <> 'ERROR'
       WHERE f.fecha BETWEEN $1 AND $2 AND f.estado = ANY($3::text[])
         AND NOT EXISTS (SELECT 1 FROM documentos_fiscales n WHERE n.doc_referencia_id = d.id AND n.factura_caja_id = f.id
                         AND n.tipo = 'NOTA_CREDITO' AND n.estado <> 'ERROR')
       ORDER BY f.id`,
      [desde, hasta, ESTADOS_ANULADOS]
    );
    const vacio = { n: 0, usd: 0, bs: 0 };
    const porTipo = Object.fromEntries(notas.rows.map((x) => [x.tipo, { n: x.n, usd: toCents(x.usd), bs: toCents(x.bs) }]));

    return NextResponse.json({
      inicioFacturacion, desde, hasta, filas, resumen: resumen(filas, hoy), diferencias,
      notas: { credito: porTipo.NOTA_CREDITO ?? vacio, debito: porTipo.NOTA_DEBITO ?? vacio },
      anuladosSinNota: anuladosSinNota.rows,
      contingencia,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
