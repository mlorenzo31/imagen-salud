import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';
import { armarMatriz, mesValido, type FilaHonorario } from '@/lib/matrizHonorarios';

/** Honorarios por doctor y por día de un mes: generado (servicios facturados) y pagado (liquidado en el sistema). Solo admin. */
export async function GET(req: NextRequest) {
  try {
    const mes = new URL(req.url).searchParams.get('mes') || fechaHoraLocal().fecha.slice(0, 7);
    if (!mesValido(mes)) throw new ApiError(400, 'Mes inválido (use AAAA-MM).');
    const desde = `${mes}-01`;

    const generado = await pool.query(
      `SELECT COALESCE(d.medico, 'DE GUARDIA') AS medico, to_char(f.fecha, 'YYYY-MM-DD') AS dia, SUM(d.honorarios_medico)::text AS monto
       FROM facturas_servicios_detalle d JOIN facturas_caja f ON f.id = d.factura_id
       WHERE f.fecha >= $1::date AND f.fecha < ($1::date + INTERVAL '1 month')
         AND f.estado NOT IN ('ANULADA', 'ANULADA_SALA') AND COALESCE(d.estado, '') NOT IN ('ANULADA', 'ANULADA_SALA')
         AND COALESCE(d.honorarios_medico, 0) > 0
       GROUP BY 1, 2`, [desde]);
    const pagado = await pool.query(
      `SELECT h.medico, to_char(h.fecha_servicio, 'YYYY-MM-DD') AS dia, SUM(h.monto_usd)::text AS monto
       FROM honorarios_medicos_pendientes h JOIN facturas_caja f ON f.id = h.factura_id
       WHERE h.estado = 'PAGADO' AND h.fecha_servicio >= $1::date AND h.fecha_servicio < ($1::date + INTERVAL '1 month')
         AND f.estado NOT IN ('ANULADA', 'ANULADA_SALA')
       GROUP BY 1, 2`, [desde]);

    const filas: FilaHonorario[] = [
      ...generado.rows.map((r) => ({ medico: String(r.medico), dia: String(r.dia), generado: toCents(r.monto), pagado: 0 })),
      ...pagado.rows.map((r) => ({ medico: String(r.medico), dia: String(r.dia), generado: 0, pagado: toCents(r.monto) })),
    ];
    return NextResponse.json({ mes, ...armarMatriz(filas, mes) });
  } catch (err) {
    return errorResponse(err);
  }
}
