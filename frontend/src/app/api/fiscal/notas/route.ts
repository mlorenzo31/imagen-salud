import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';
import { exigirPinSesion } from '@/lib/pin';
import { actorSesion, registrarBitacora } from '@/lib/bitacora';
import { getErrorMessage } from '@/lib/utils';
import { asegurarFiscal } from '@/lib/fiscal/fiscalDb';
import { registrarNotaAjuste } from '@/lib/fiscal/notasDb';
import { emitirDocumento } from '@/lib/fiscal/emision';
import { obtenerProveedor } from '@/lib/fiscal/proveedor';

const schema = z.object({
  documentoId: z.number().int().positive(),
  tipo: z.enum(['NOTA_CREDITO', 'NOTA_DEBITO']),
  montoUsd: z.union([z.number(), z.string()]),
  motivo: z.string().trim().min(5, 'Indique el motivo (mínimo 5 caracteres).').max(200),
  pin: z.string().min(1, 'Ingrese su clave para confirmar.'),
});

/**
 * Nota manual de crédito (parcial) o débito sobre una factura emitida. Solo admin (SOLO_ADMIN) y con clave.
 * Es el documento fiscal: el movimiento de dinero (devolución o cobro adicional) se registra en Tesorería.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await parseBody(req, schema);
    await exigirPinSesion(req, b.pin);
    const proveedor = obtenerProveedor();
    if (!proveedor) throw new ApiError(409, 'La emisión fiscal está desactivada (FISCAL_PROVEEDOR).');
    await asegurarFiscal();
    const montoUsd = toCents(b.montoUsd);
    const { fecha } = fechaHoraLocal();
    const { notaId, nota } = await withTransaction(async (client) => {
      let r;
      try {
        r = await registrarNotaAjuste(client, { documentoId: b.documentoId, tipo: b.tipo, montoUsd, motivo: b.motivo, usuario: sesionUsuario(req) });
      } catch (err) {
        throw new ApiError(400, getErrorMessage(err));
      }
      await registrarBitacora(client, {
        tipo: 'FISCAL', fechaAfectada: fecha, ...actorSesion(req),
        descripcion: `${r.nota.denominacion} ${r.nota.numero} por $${(montoUsd / 100).toFixed(2)} sobre la factura ${r.nota.referencia?.numero}: ${b.motivo}`,
        detalle: { documento_id: b.documentoId, nota_id: r.notaId, monto_usd: montoUsd },
      });
      return r;
    });
    const resultado = await emitirDocumento(pool, proveedor, notaId, fecha);
    return NextResponse.json({ notaId, numero: nota.numero, denominacion: nota.denominacion, ...resultado });
  } catch (err) {
    return errorResponse(err);
  }
}
