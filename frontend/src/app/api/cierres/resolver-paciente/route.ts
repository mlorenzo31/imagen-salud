import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse, fechaHoraLocal, sesionUsuario } from '@/lib/apiHelpers';
import { esAnulada } from '@/lib/estados';
import { revertirTesoreriaPorAnulacion } from '@/lib/anulacion';
import { actorSesion, registrarBitacora } from '@/lib/bitacora';

export async function POST(req: NextRequest) {
  try {
    const { registro_id, accion } = await req.json();
    const usuario = sesionUsuario(req);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fac = await client.query('SELECT to_char(fecha, \'YYYY-MM-DD\') AS fecha, nombre_paciente, turno_num FROM facturas_caja WHERE id = $1', [registro_id]);
      if (fac.rows.length > 0) {
        const f = fac.rows[0] as { fecha: string; nombre_paciente: string | null; turno_num: number | null };
        await registrarBitacora(client, {
          tipo: 'RESOLUCION_CIERRE', fechaAfectada: f.fecha, ...actorSesion(req),
          descripcion: `Paciente ${f.nombre_paciente ?? '#' + registro_id} (turno ${f.turno_num ?? '-'}, jornada ${f.fecha}) resuelto en el cierre: ${String(accion)}.`,
          detalle: { factura_id: registro_id, accion },
        });
      }

      if (accion === 'CULMINAR') {
        await client.query("UPDATE facturas_caja SET estado = 'FINALIZADO', etapa_actual = 2 WHERE id = $1", [registro_id]);
      } else if (accion === 'ANULAR') {
        const previo = await client.query('SELECT estado FROM facturas_caja WHERE id = $1 FOR UPDATE', [registro_id]);
        await client.query("UPDATE facturas_caja SET estado = 'ANULADA' WHERE id = $1", [registro_id]);
        if (previo.rows.length > 0 && !esAnulada(previo.rows[0].estado)) {
          await revertirTesoreriaPorAnulacion(client, registro_id, usuario, 'Anulada en auditoría de cierre');
        }
      } else if (accion === 'CARTERA_DEUDOR') {
        await client.query("UPDATE facturas_caja SET estado = 'FINALIZADO', etapa_actual = 2 WHERE id = $1", [registro_id]);
        await client.query(`
          INSERT INTO cartera_deudores (atencion_id, paciente_nombre, monto_pendiente, motivo, usuario)
          SELECT id, COALESCE(nombre_paciente, 'Paciente #' || id), precio_usd, 'Trasladado desde auditoría de cierre', $2
          FROM facturas_caja WHERE id = $1
        `, [registro_id, usuario]);
      } else if (accion === 'REASIGNAR_HOY') {
        await client.query("UPDATE facturas_caja SET fecha = $2 WHERE id = $1", [registro_id, fechaHoraLocal().fecha]);
      }

      await client.query('COMMIT');
      return NextResponse.json({ mensaje: 'Paciente resuelto exitosamente.', accion, registro_id });
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
