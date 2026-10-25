import type { PoolClient } from 'pg';
import { fechaHoraLocal } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';
import type { DocumentoFiscal } from './factura';
import { guardarDocumento, leerConfigEmisor, siguienteNumero } from './fiscalDb';
import { cargarCobros } from './cobros';
import { notaAjuste, notaCreditoPorAnulacion } from './notas';

type Db = Pick<PoolClient, 'query'>;

/** Centavos USD ya acreditados a una factura por notas de crédito válidas (no rechazadas). */
async function acreditadoPrevio(client: Db, documentoId: number): Promise<number> {
  const r = await client.query(
    "SELECT COALESCE(SUM(total_usd), 0) AS t FROM documentos_fiscales WHERE doc_referencia_id = $1 AND tipo = 'NOTA_CREDITO' AND estado <> 'ERROR'",
    [documentoId]
  );
  return toCents(r.rows[0].t);
}

/**
 * Al anular un cobro con factura fiscal: NC total por sus líneas (art. 12), PENDIENTE hasta enviarla.
 * Idempotente (si ya existe la NC de ese cobro la devuelve). Sin factura o con factura rechazada no hace nada.
 * Dentro de la transacción de la anulación.
 */
export async function registrarNotaPorAnulacion(client: Db, facturaCajaId: number, usuario: string, motivo: string): Promise<{ notaId: number | null; aviso: string | null }> {
  const r = await client.query(
    `SELECT d.id, d.numero, d.estado, d.payload,
            (SELECT count(*)::int FROM documentos_fiscales_cobros l2 WHERE l2.documento_id = d.id) AS n_cobros
     FROM documentos_fiscales_cobros l JOIN documentos_fiscales d ON d.id = l.documento_id
     WHERE l.factura_caja_id = $1 FOR UPDATE OF d`,
    [facturaCajaId]
  );
  if (r.rows.length === 0) return { notaId: null, aviso: null };
  const d = r.rows[0];
  if (d.estado === 'ERROR') return { notaId: null, aviso: `La factura fiscal ${d.numero} fue rechazada por la imprenta: no requiere nota de crédito.` };

  const ya = await client.query(
    "SELECT id FROM documentos_fiscales WHERE doc_referencia_id = $1 AND factura_caja_id = $2 AND tipo = 'NOTA_CREDITO' AND estado <> 'ERROR'",
    [d.id, facturaCajaId]
  );
  if (ya.rows.length > 0) return { notaId: ya.rows[0].id, aviso: null };

  const [cobro] = await cargarCobros(client, [facturaCajaId]);
  const { fecha, hora } = fechaHoraLocal();
  const nota = notaCreditoPorAnulacion({
    numero: await siguienteNumero(client, 'NOTA_CREDITO'), fecha, hora, motivo, emisor: await leerConfigEmisor(client),
    original: d.payload as DocumentoFiscal, cobro, consolidada: d.n_cobros > 1, acreditadoPrevioUsd: await acreditadoPrevio(client, d.id),
  });
  const notaId = await guardarDocumento(client, nota, { facturaCajaId, docReferenciaId: d.id, usuario, fecha, hora });
  return { notaId, aviso: null };
}

/** Nota manual (crédito parcial o débito) sobre una factura ya emitida. */
export async function registrarNotaAjuste(
  client: Db, p: { documentoId: number; tipo: 'NOTA_CREDITO' | 'NOTA_DEBITO'; montoUsd: number; motivo: string; usuario: string },
): Promise<{ notaId: number; nota: DocumentoFiscal }> {
  const r = await client.query("SELECT id, tipo, estado, payload, factura_caja_id FROM documentos_fiscales WHERE id = $1 FOR UPDATE", [p.documentoId]);
  if (r.rows.length === 0) throw new Error('La factura no existe.');
  const d = r.rows[0];
  if (d.tipo !== 'FACTURA') throw new Error('Las notas solo se emiten sobre facturas.');
  if (d.estado !== 'EMITIDO') throw new Error('La factura aún no está emitida por la imprenta.');
  const { fecha, hora } = fechaHoraLocal();
  const nota = notaAjuste({
    tipo: p.tipo, numero: await siguienteNumero(client, p.tipo), fecha, hora, motivo: p.motivo, emisor: await leerConfigEmisor(client),
    original: d.payload as DocumentoFiscal, montoUsd: p.montoUsd, acreditadoPrevioUsd: await acreditadoPrevio(client, d.id),
  });
  const notaId = await guardarDocumento(client, nota, { facturaCajaId: d.factura_caja_id, docReferenciaId: d.id, usuario: p.usuario, fecha, hora });
  return { notaId, nota };
}
