import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { registro_id, accion, motivo, usuario } = await req.json();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (accion === 'CULMINAR') {
        await client.query("UPDATE facturas_caja SET estado = 'FINALIZADO', etapa_actual = 2 WHERE id = $1", [registro_id]);
      } else if (accion === 'ANULAR') {
        await client.query("UPDATE facturas_caja SET estado = 'ANULADA' WHERE id = $1", [registro_id]);
      } else if (accion === 'CARTERA_DEUDOR') {
        await client.query("UPDATE facturas_caja SET estado = 'FINALIZADO', etapa_actual = 2 WHERE id = $1", [registro_id]);
        await client.query(`
          INSERT INTO cartera_deudores (atencion_id, paciente_nombre, monto_pendiente, motivo, usuario)
          SELECT id, COALESCE(nombre_paciente, 'Paciente #' || id), precio_usd, 'Trasladado desde auditoría de cierre', $2
          FROM facturas_caja WHERE id = $1
        `, [registro_id, usuario || 'Administrador']);
      } else if (accion === 'REASIGNAR_HOY') {
        await client.query("UPDATE facturas_caja SET fecha = CURRENT_DATE WHERE id = $1", [registro_id]);
      }

      await client.query('COMMIT');
      return NextResponse.json({ mensaje: 'Paciente resuelto exitosamente.', accion, registro_id });
    } catch (err: any) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: err.message }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
