import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { sincronizarSala } from '@/lib/salaDb';

export const dynamic = 'force-dynamic';

/** "MARIA ELENA PEREZ GOMEZ" → "MARIA E." (la pantalla de sala es pública: no se expone el nombre completo ni la cédula). */
const abreviar = (nombre: string | null): string => {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Paciente';
  return partes.length === 1 ? partes[0] : `${partes[0]} ${partes[1][0]}.`;
};

/** Turnos activos para la TV de la sala de espera. Público por diseño (la pantalla no inicia sesión), con datos mínimos. */
export async function GET() {
  try {
    await sincronizarSala(pool);
    const r = await pool.query(`
      SELECT s.id, f.turno_num, f.nombre_paciente, s.estudio, s.medico, s.estado, f.hora, f.fecha,
             s.grupo AS grupo_clinico, s.box AS box_asignado, s.llamado_en
        FROM sala_servicios s JOIN facturas_caja f ON f.id = s.factura_id
       WHERE f.estado IN ('ESPERA', 'ATENCION') AND s.estado IN ('ESPERA', 'ATENCION')
       ORDER BY s.retorno DESC, s.orden_cola, s.idx
       LIMIT 300`);
    return NextResponse.json(r.rows.map((t) => ({ ...t, nombre_paciente: abreviar(t.nombre_paciente) })));
  } catch (err) {
    return errorResponse(err);
  }
}
