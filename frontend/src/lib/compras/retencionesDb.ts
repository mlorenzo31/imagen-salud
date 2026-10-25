import type { PoolClient } from 'pg';
import { centsToStr } from '@/lib/money';
import { formatearComprobante, siguienteSecuencial } from './comprobante';

type Db = Pick<PoolClient, 'query'>;

/**
 * Emite el comprobante de retención de una factura de compra (art. 18). El UPDATE de la secuencia bloquea su fila
 * hasta el fin de la transacción: dos compras simultáneas no comparten número y, si se revierte, no queda hueco.
 */
export async function emitirComprobante(
  client: Db, p: { facturaId: number; fechaEmision: string; ivaRetenido: number; islrRetenido: number },
): Promise<string> {
  const r = await client.query('SELECT ultimo FROM secuencia_retencion WHERE id FOR UPDATE');
  const secuencial = siguienteSecuencial(Number(r.rows[0]?.ultimo ?? 0));
  await client.query(
    'INSERT INTO secuencia_retencion (id, ultimo) VALUES (true, $1) ON CONFLICT (id) DO UPDATE SET ultimo = EXCLUDED.ultimo',
    [secuencial]
  );
  const numero = formatearComprobante(p.fechaEmision, secuencial);
  await client.query(
    `INSERT INTO retenciones_compra (factura_id, numero, periodo, periodo_imposicion, iva_retenido, islr_retenido, fecha)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [p.facturaId, numero, numero.slice(0, 6), p.fechaEmision.slice(0, 7), centsToStr(p.ivaRetenido), centsToStr(p.islrRetenido), p.fechaEmision]
  );
  await client.query('UPDATE facturas_compra SET comprobante_retencion = $1 WHERE id = $2', [numero, p.facturaId]);
  return numero;
}
