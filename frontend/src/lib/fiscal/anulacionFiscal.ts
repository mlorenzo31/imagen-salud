import type { PoolClient } from 'pg';
import { getErrorMessage } from '@/lib/utils';
import { registrarBitacora } from '@/lib/bitacora';
import { registrarNotaPorAnulacion } from './notasDb';
import { emitirDocumento } from './emision';
import { obtenerProveedor } from './proveedor';

type Db = Pick<PoolClient, 'query'>;

/**
 * Parte fiscal de anular un cobro: registra la NC de su factura (si la tiene) dentro de la transacción de la
 * anulación. Con SAVEPOINT: si la NC no se puede generar, la anulación sigue y queda el aviso en bitácora
 * (el Control Fiscal lo muestra como "anulado sin nota de crédito").
 */
export async function anularFiscalmente(
  client: Db, facturaCajaId: number, usuario: string, motivo: string, actor: { usuario: string; rol: string }, fechaAfectada: string,
): Promise<{ notaId: number | null; aviso: string | null }> {
  await client.query('SAVEPOINT nota_fiscal');
  try {
    const r = await registrarNotaPorAnulacion(client, facturaCajaId, usuario, motivo);
    await client.query('RELEASE SAVEPOINT nota_fiscal');
    if (r.notaId) {
      await registrarBitacora(client, {
        tipo: 'FISCAL', fechaAfectada, ...actor,
        descripcion: `Nota de crédito registrada por la anulación del cobro ${facturaCajaId}.`,
        detalle: { factura_id: facturaCajaId, nota_id: r.notaId },
      });
    }
    return r;
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT nota_fiscal');
    const aviso = `No se pudo generar la nota de crédito del cobro ${facturaCajaId}: ${getErrorMessage(err)}`;
    await registrarBitacora(client, { tipo: 'FISCAL', fechaAfectada, ...actor, descripcion: aviso, detalle: { factura_id: facturaCajaId } });
    return { notaId: null, aviso };
  }
}

/** Tras confirmar la anulación: envía la NC a la imprenta. Devuelve un aviso si no quedó emitida. */
export async function emitirNotaTrasAnular(db: Db, notaId: number, hoy: string): Promise<string | null> {
  let proveedor;
  try {
    proveedor = obtenerProveedor();
  } catch (err) {
    return `Nota de crédito registrada pero no enviada: ${getErrorMessage(err)}`;
  }
  if (!proveedor) return 'Nota de crédito registrada; se enviará cuando la emisión fiscal esté activa.';
  const r = await emitirDocumento(db, proveedor, notaId, hoy);
  if (r.estado === 'EMITIDO') return null;
  if (r.estado === 'ERROR') return `La imprenta rechazó la nota de crédito: ${r.error}`;
  return 'La nota de crédito quedó pendiente de envío (se emite cuando la factura original tenga N° de control); se reintentará.';
}
