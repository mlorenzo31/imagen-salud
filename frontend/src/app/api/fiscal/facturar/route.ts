import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';
import { esAnulada } from '@/lib/estados';
import { obtenerTasaBcv } from '@/lib/tasaBcv';
import { actorSesion, registrarBitacora } from '@/lib/bitacora';
import { receptorAlternoSchema } from '@/lib/fiscal/configEmisor';
import { asegurarFiscal, leerConfigEmisor, siguienteNumero } from '@/lib/fiscal/fiscalDb';
import { emitirDocumento, entradaParaCobros, guardarFactura, type CobroDiferido } from '@/lib/fiscal/emision';
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
      const r = await client.query(
        `SELECT f.id, f.estado, f.nombre_paciente, f.cedula_paciente, f.servicios, f.pago_divisas,
                f.receptor_razon_social, f.receptor_rif, f.receptor_domicilio, p.direccion,
                EXISTS (SELECT 1 FROM documentos_fiscales_cobros l WHERE l.factura_caja_id = f.id) AS facturado
         FROM facturas_caja f LEFT JOIN pacientes p ON p.cedula = f.cedula_paciente
         WHERE f.id = ANY($1) ORDER BY f.id FOR UPDATE OF f`,
        [ids]
      );
      if (r.rows.length !== ids.length) throw new ApiError(404, 'Alguno de los cobros no existe.');
      const cobros: CobroDiferido[] = r.rows.map((f) => {
        if (esAnulada(f.estado)) throw new ApiError(409, `El cobro ${f.id} está anulado.`);
        if (f.facturado) throw new ApiError(409, `El cobro ${f.id} ya tiene factura fiscal.`);
        const servicios = (Array.isArray(f.servicios) ? f.servicios : []) as Array<Record<string, unknown>>;
        return {
          id: f.id,
          paciente: { nombre: f.nombre_paciente, cedula: f.cedula_paciente, direccion: f.direccion ?? '' },
          facturarA: f.receptor_rif ? { razonSocial: f.receptor_razon_social, rif: f.receptor_rif, domicilio: f.receptor_domicilio ?? undefined } : null,
          pagoDivisasUsd: toCents(f.pago_divisas),
          servicios: servicios.map((s) => {
            const precio = toCents(s.precioUSD);
            const lista = s.precioLista !== undefined ? toCents(s.precioLista) : precio;
            return { codigo: typeof s.codigo === 'string' ? s.codigo : null, estudio: String(s.estudio ?? ''), area: String(s.area ?? 'GENERAL'), precioLista: lista, descuento: lista - precio };
          }),
        };
      });
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
