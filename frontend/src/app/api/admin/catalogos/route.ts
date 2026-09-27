import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Catálogo de usuarios
    const resUsuarios = await pool.query('SELECT id, user_login, nombre, rol, email FROM usuarios ORDER BY id ASC');

    // Catálogo de doctores y servicios predeterminados
    const doctores = [
      { id: 1, nombre: 'Dra. María González', especialidad: 'Radiología e Imagenología', comision_pct: 70 },
      { id: 2, nombre: 'Dr. Carlos Mendoza', especialidad: 'Ecografía Integral', comision_pct: 70 },
      { id: 3, nombre: 'Dra. Carmen Rodríguez', especialidad: 'Patología Clínica', comision_pct: 75 },
      { id: 4, nombre: 'Dr. Juan Pérez', especialidad: 'Medicina General & Ocupacional', comision_pct: 60 },
      { id: 5, nombre: 'Dr. De Guardia', especialidad: 'Triaje y Emergencia', comision_pct: 50 }
    ];

    const servicios = [
      { id: 1, area: 'ECOGRAFIA_AM', nombre: 'Ecografía Abdominal Total', precio_usd: 25.00, sala: 'SALA_ECO_AM' },
      { id: 2, area: 'ECOGRAFIA_AM', nombre: 'Ecografía Renal / Vías Urinarias', precio_usd: 20.00, sala: 'SALA_ECO_AM' },
      { id: 3, area: 'ECOGRAFIA_PM', nombre: 'Ecografía Obstétrica 4D', precio_usd: 35.00, sala: 'SALA_ECO_PM' },
      { id: 4, area: 'ECOGRAFIA_PM', nombre: 'Eco Doppler Miembros Inferiores', precio_usd: 40.00, sala: 'SALA_ECO_PM' },
      { id: 5, area: 'RADIOLOGIA', nombre: 'Radiografía de Tórax AP/Lateral', precio_usd: 15.00, sala: 'SALA_RAYOS_X' },
      { id: 6, area: 'RADIOLOGIA', nombre: 'Rayos X Columna Lumbo-Sacra', precio_usd: 20.00, sala: 'SALA_RAYOS_X' },
      { id: 7, area: 'MAMOGRAFIA', nombre: 'Mamografía Digital Bilateral', precio_usd: 30.00, sala: 'SALA_MAMO' },
      { id: 8, area: 'CONSULTAS', nombre: 'Consulta Médica Especializada', precio_usd: 20.00, sala: 'CONSULTORIO_1' },
      { id: 9, area: 'GINECOLOGIA', nombre: 'Citología / Papanicolaou', precio_usd: 15.00, sala: 'CONSULTORIO_2' }
    ];

    return NextResponse.json({
      usuarios: resUsuarios.rows,
      doctores,
      servicios
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
