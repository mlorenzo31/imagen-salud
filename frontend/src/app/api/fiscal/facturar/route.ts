import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { esAnulada } from '@/lib/estados';
import { obtenerTasaBcv } from '@/lib/tasaBcv';
import { actorSesion, registrarBitacora } from '@/lib/bitacora';
import { receptorAlternoSchema } from '@/lib/fiscal/configEmisor';
import { asegurarFiscal, leerConfigEmisor, siguienteNumero } from '@/lib/fiscal/fiscalDb';
import { emitirDocumento, entradaParaCobros, guardarFactura } from '@/lib/fiscal/emision';
import { cargarCobros } from '@/lib/fiscal/cobros';
import { obtenerProveedor } from '@/lib/fiscal/proveedor';

const schema = z.object({
  cobros: z.array(z.number().int().positive()).min(1).max(200),
  receptor: receptorAlternoSchema.nullable().optional(),
});

/**
 * Emite la factura fiscal de cobros que aún no la tienen (diferidos o sin factura). Varios cobros = factura
 * consolidada a una aseguradora o empresa. El tipo de cambio es el BCV vigente del día de emisión. Admin y asistente.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await parseBody(req, schema);
    const proveedor = obtenerProveedor();
    if (!proveedor) throw new ApiError(409, 'La emisión fiscal está desactivada (FISCAL_PROVEEDOR).');
    await asegurarFiscal();
    const emisor = await leerConfigEmisor();
    const tasa = (await obtenerTasaBcv())?.tasa;
    if (!tasa) throw new ApiError(409, 'No hay tasa BCV vigente para emitir la factura.');
    const { fecha, hora } = fechaHoraLocal();
    const usuario = sesionUsuario(req);
    const ids = [...new Set(b.cobros)];

    const { id, documento } = await withTransaction(async (client) => {
      const cobros = await cargarCobros(client, ids);
      if (cobros.length !== ids.length) throw new ApiError(404, 'Alguno de los cobros no existe.');
      for (const c of cobros) {
        if (esAnulada(c.estado)) throw new ApiError(409, `El cobro ${c.id} está anulado.`);
        if (c.facturado) throw new ApiError(409, `El cobro ${c.id} ya tiene factura fiscal.`);
      }
      const numero = await siguienteNumero(client, 'FACTURA');
      let entrada;
      try {
        entrada = entradaParaCobros({ numero, fecha, hora, tasa: String(tasa), emisor, cobros, receptor: b.receptor ?? null });
      } catch (err) {
        throw new ApiError(400, err instanceof Error ? err.message : String(err));
      }
      const res = await guardarFactura(client, entrada, { cobros: ids, usuario });
      await registrarBitacora(client, {
        tipo: 'FISCAL', fechaAfectada: fecha, ...actorSesion(req),
        descripcion: `Factura fiscal ${res.documento.numero} emitida para ${ids.length > 1 ? `${ids.length} cobros (consolidada) a ${res.documento.receptor.nombre}` : `el cobro ${ids[0]}`}.`,
        detalle: { documento_id: res.id, cobros: ids },
      });
      return res;
    });

    const resultado = await emitirDocumento(pool, proveedor, id, fecha);
    return NextResponse.json({ documentoId: id, numero: documento.numero, ...resultado });
  } catch (err) {
    return errorResponse(err);
  }
}
