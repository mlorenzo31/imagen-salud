import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { asegurarDescuentos } from '@/lib/descuentosDb';
import { toCents } from '@/lib/money';
import { agruparResumen, rangoValido, type FilaServicio } from '@/lib/resumenPeriodo';

/** Resultado por servicio y por doctor de un período (Desde–Hasta). Solo admin y asistente. */
export async function GET(req: NextRequest) {
  try {
    if (req.headers.get('x-session-role') === 'cajero') throw new ApiError(403, 'No tiene permiso para ver este resumen.');
    const q = new URL(req.url).searchParams;
    const hoy = fechaHoraLocal().fecha;
    const desde = q.get('desde') || hoy;
    const hasta = q.get('hasta') || desde;
    const error = rangoValido(desde, hasta);
    if (error) throw new ApiError(400, error);

    await asegurarDescuentos(); // usa precio_lista_usd
    const detalle = await pool.query(
      `SELECT d.area, d.estudio, COALESCE(d.medico, 'DE GUARDIA') AS medico,
              COALESCE(d.precio_lista_usd, d.precio_usd)::text AS lista, d.precio_usd::text AS cobrado,
              COALESCE(d.honorarios_medico, 0)::text AS honorarios, COALESCE(d.ganancia_clinica, 0)::text AS ganancia
       FROM facturas_servicios_detalle d JOIN facturas_caja f ON f.id = d.factura_id
       WHERE f.fecha BETWEEN $1 AND $2 AND f.estado NOT IN ('ANULADA', 'ANULADA_SALA')
         AND COALESCE(d.estado, '') NOT IN ('ANULADA', 'ANULADA_SALA')`, [desde, hasta]);
    const facturado = await pool.query(
      "SELECT COALESCE(SUM(precio_usd), 0)::text AS t FROM facturas_caja WHERE fecha BETWEEN $1 AND $2 AND estado NOT IN ('ANULADA', 'ANULADA_SALA')", [desde, hasta]);

    const filas: FilaServicio[] = detalle.rows.map((r) => ({
      area: String(r.area ?? 'GENERAL'), estudio: String(r.estudio), medico: String(r.medico),
      lista: toCents(r.lista), cobrado: toCents(r.cobrado), honorarios: toCents(r.honorarios), ganancia: toCents(r.ganancia),
    }));
    const totalFacturado = toCents(facturado.rows[0].t);
    return NextResponse.json({ desde, hasta, totalFacturado, ...agruparResumen(filas, totalFacturado) });
  } catch (err) {
    return errorResponse(err);
  }
}
