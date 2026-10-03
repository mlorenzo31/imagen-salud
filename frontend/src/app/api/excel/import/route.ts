import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';

export async function POST(req: NextRequest) {
  try {
    const { filas, usuario } = await req.json();

    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron filas válidas para procesar.' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const filasValidas = filas.filter(f => f.valido);
      let insertados = 0;

      for (const item of filasValidas) {
        await client.query(`
          INSERT INTO atenciones_cola 
            (numero_turno, paciente_nombre, doctor_nombre, especialidad, total_usd, estado, fecha, hora, usuario)
          VALUES 
            ($1, $2, $3, $4, $5, 'FINALIZADO', CURRENT_DATE, TO_CHAR(NOW(), 'HH:MI AM'), $6)
        `, [
          `EXC-${Date.now().toString().slice(-4)}-${insertados + 1}`,
          item.paciente,
          item.medico,
          item.servicio,
          item.monto_usd,
          usuario || 'Administrador Carga Masiva'
        ]);
        insertados++;
      }

      await client.query('COMMIT');
      return NextResponse.json({
        mensaje: `Carga masiva completada con éxito. Se persistieron ${insertados} atenciones clínicas.`,
        registros_insertados: insertados
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
