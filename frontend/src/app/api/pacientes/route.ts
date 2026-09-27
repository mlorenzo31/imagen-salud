import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { normalizarCedulaRif, extraerDigitos } from '@/lib/cedulaRif';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cedula = searchParams.get('cedula');

    if (cedula) {
      const digitos = extraerDigitos(cedula);
      if (!digitos) return NextResponse.json(null);

      const result = await pool.query(
        "SELECT id, cedula, nombre, fecha_nacimiento, direccion, telefono FROM pacientes WHERE regexp_replace(cedula, '[^0-9]', '', 'g') = $1 LIMIT 1",
        [digitos]
      );
      if (result.rows.length === 0) return NextResponse.json(null);
      return NextResponse.json(result.rows[0]);
    }

    // Consulta con deduplicación garantizada
    const result = await pool.query(`
      SELECT DISTINCT ON (regexp_replace(cedula, '[^0-9]', '', 'g')) 
        id, cedula, nombre, fecha_nacimiento, direccion, telefono
      FROM pacientes 
      ORDER BY regexp_replace(cedula, '[^0-9]', '', 'g'), id DESC
    `);
    
    // Ordenar alfabéticamente por nombre para la UI
    const pacientesOrdenados = result.rows.sort((a, b) => 
      (a.nombre || '').localeCompare(b.nombre || '')
    );

    return NextResponse.json(pacientesOrdenados);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, fecha_nacimiento, direccion, telefono } = body;
    const cedulaRaw = body.cedula;

    if (!cedulaRaw) {
      return NextResponse.json({ error: 'La cédula es requerida' }, { status: 400 });
    }

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre completo es obligatorio' }, { status: 400 });
    }
    if (/\d/.test(nombre)) {
      return NextResponse.json({ error: 'El nombre no puede contener números' }, { status: 400 });
    }
    if (!fecha_nacimiento) {
      return NextResponse.json({ error: 'La fecha de nacimiento es obligatoria' }, { status: 400 });
    }
    if (!telefono || !telefono.trim()) {
      return NextResponse.json({ error: 'El teléfono es obligatorio' }, { status: 400 });
    }
    if (/[a-zA-Z]/.test(telefono)) {
      return NextResponse.json({ error: 'El teléfono no puede contener letras' }, { status: 400 });
    }

    const cedulaCanonica = normalizarCedulaRif(cedulaRaw);
    const digitos = extraerDigitos(cedulaRaw);

    if (!digitos || digitos.length < 5) {
      return NextResponse.json({ error: 'Número de cédula inválido (debe tener entre 5 y 9 dígitos)' }, { status: 400 });
    }

    const nombreUpper = nombre.trim().toUpperCase();
    const direccionUpper = direccion ? direccion.trim().toUpperCase() : null;

    // 1. Verificar si ya existe un paciente con el mismo número de cédula (con o sin 'V-')
    const existente = await pool.query(
      "SELECT id FROM pacientes WHERE regexp_replace(cedula, '[^0-9]', '', 'g') = $1 LIMIT 1",
      [digitos]
    );

    if (existente.rows.length > 0) {
      // Actualizar paciente existente garantizando cédula canónica, fecha_nacimiento y MAYÚSCULAS
      const idExistente = existente.rows[0].id;
      const updateRes = await pool.query(`
        UPDATE pacientes 
        SET cedula = $1,
            nombre = COALESCE(NULLIF($2, ''), nombre),
            fecha_nacimiento = COALESCE($3::DATE, fecha_nacimiento),
            direccion = COALESCE(NULLIF($4, ''), direccion),
            telefono = COALESCE(NULLIF($5, ''), telefono)
        WHERE id = $6
        RETURNING id, cedula, nombre, fecha_nacimiento, direccion, telefono
      `, [cedulaCanonica, nombreUpper, fecha_nacimiento || null, direccionUpper, telefono, idExistente]);

      return NextResponse.json(updateRes.rows[0]);
    }

    // 2. Si no existe, insertar nuevo paciente con cédula canónica, fecha_nacimiento y MAYÚSCULAS
    const insertRes = await pool.query(`
      INSERT INTO pacientes (cedula, nombre, fecha_nacimiento, direccion, telefono)
      VALUES ($1, $2, $3::DATE, $4, $5)
      RETURNING id, cedula, nombre, fecha_nacimiento, direccion, telefono
    `, [cedulaCanonica, nombreUpper, fecha_nacimiento || null, direccionUpper, telefono]);

    return NextResponse.json(insertRes.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
