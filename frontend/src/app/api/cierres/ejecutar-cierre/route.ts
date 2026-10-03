import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fecha = body.fecha || body.fecha_cierre || fechaHoraLocal().fecha;
    const usuario = body.usuario_responsable || body.usuario || 'Administrador';
    const observaciones = body.observaciones || 'Cierre auditado conforme';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar que no queden pendientes
      const pendRes = await client.query(`
        SELECT COUNT(*) as cant FROM facturas_caja 
        WHERE estado IN ('ESPERA', 'ATENCION') AND fecha = $1
      `, [fecha]);

      if (parseInt(pendRes.rows[0].cant) > 0) {
        throw new ApiError(400, 'Aún existen pacientes pendientes de resolución para esta fecha (' + pendRes.rows[0].cant + ' pendientes).');
      }

      // Obtener totales del día
      const totalesRes = await client.query(`
        SELECT 
          COALESCE(SUM(precio_usd), 0) as total_usd,
          COALESCE(SUM(pago_divisas), 0) as total_divisas_usd,
          COALESCE(SUM(pago_efectivo_bs), 0) as total_efectivo_bs,
          COALESCE(SUM(pago_punto), 0) as total_punto_bs,
          COALESCE(SUM(pago_movil), 0) as total_pago_movil_bs
        FROM facturas_caja
        WHERE fecha = $1 AND estado != 'ANULADA'
      `, [fecha]);

      const t = totalesRes.rows[0] || {};

      const insertRes = await client.query(`
        INSERT INTO cierres_diarios (fecha_cierre, observaciones, usuario, consolidado)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (fecha_cierre) DO UPDATE SET 
          consolidado = true, 
          observaciones = EXCLUDED.observaciones,
          usuario = EXCLUDED.usuario,
          actualizado_en = CURRENT_TIMESTAMP
        RETURNING *
      `, [fecha, observaciones, usuario]);

      await client.query('COMMIT');
      return NextResponse.json({ 
        mensaje: 'Cierre diario consolidado exitosamente.', 
        fecha_cierre: fecha,
        cierre: {
          ...insertRes.rows[0],
          ...t,
          usuario_responsable: usuario
        }
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      return errorResponse(err);
    } finally {
      client.release();
    }
  } catch (err) {
    return errorResponse(err);
  }
}
