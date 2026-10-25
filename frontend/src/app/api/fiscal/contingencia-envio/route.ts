import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { actorSesion, registrarBitacora } from '@/lib/bitacora';
import { getErrorMessage } from '@/lib/utils';
import { enviarContingencia } from '@/lib/fiscal/contingenciaDb';
import { procesarPendientes } from '@/lib/fiscal/emision';
import { asegurarFiscal, leerConfigEmisor } from '@/lib/fiscal/fiscalDb';
import { obtenerProveedor } from '@/lib/fiscal/proveedor';

/**
 * Art. 7: remite a la imprenta digital los documentos físicos de la contingencia cerrada (relación en PDF).
 * Después envía las notas que esperaban a esas facturas. Admin y asistente (no está en las rutas del cajero).
 */
export async function POST(req: NextRequest) {
  try {
    const proveedor = obtenerProveedor();
    if (!proveedor) throw new ApiError(409, 'La emisión fiscal está desactivada (FISCAL_PROVEEDOR).');
    await asegurarFiscal();
    const hoy = fechaHoraLocal().fecha;
    const emisor = await leerConfigEmisor();
    let r;
    try {
      r = await enviarContingencia(pool, proveedor, { emisor, hoy });
    } catch (err) {
      throw new ApiError(409, getErrorMessage(err));
    }
    await registrarBitacora(pool, {
      tipo: 'FISCAL', fechaAfectada: hoy, ...actorSesion(req),
      descripcion: r.estado === 'ENVIADA'
        ? `Contingencia remitida a la imprenta digital: ${r.documentos} documento(s)${r.pendientes ? `; quedan ${r.pendientes} registrados durante el envío` : ''}.`
        : `No se pudo remitir la contingencia a la imprenta digital: ${r.error}`,
      detalle: { ...r },
    });
    const notas = r.estado === 'ENVIADA' ? await procesarPendientes(pool, proveedor, hoy) : null;
    return NextResponse.json({ ...r, notas });
  } catch (err) {
    return errorResponse(err);
  }
}
