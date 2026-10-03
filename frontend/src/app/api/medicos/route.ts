import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { normalizarCedulaRif, extraerDigitos, validarEstructuraCedulaRif } from '@/lib/cedulaRif';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cedula = searchParams.get('cedula') || searchParams.get('cedula_rif');
    const activoOnly = searchParams.get('activo') === 'true';

    let q = 'SELECT * FROM medicos WHERE 1=1';
    const params: unknown[] = [];

    if (cedula) {
      const digitos = extraerDigitos(cedula);
      if (digitos) {
        params.push(digitos);
        q += ` AND regexp_replace(cedula_rif, '[^0-9]', '', 'g') = $${params.length}`;
      }
    }

    if (activoOnly) {
      q += ' AND activo = TRUE';
    }

    q += ' ORDER BY nombre ASC';
    const result = await pool.query(q, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, especialidad, turno, comision_pct, telefono, email, mpps_matricula, consultorio_defecto, activo } = body;
    const cedulaRaw = body.cedula_rif || body.cedula;

    if (!cedulaRaw) {
      return NextResponse.json({ error: 'La Cédula o RIF del especialista es obligatoria.' }, { status: 400 });
    }

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre del especialista es obligatorio.' }, { status: 400 });
    }

    const validacion = validarEstructuraCedulaRif(cedulaRaw);
    if (!validacion.valido) {
      return NextResponse.json({ error: validacion.mensaje }, { status: 400 });
    }

    const cedulaCanonica = normalizarCedulaRif(cedulaRaw);
    const digitos = extraerDigitos(cedulaRaw);

    // 1. BLINDAJE ANTI-DUPLICIDAD: Verificar si ya existe otro doctor con la misma Cédula o RIF
    const colision = await pool.query(
      "SELECT id, nombre, cedula_rif FROM medicos WHERE regexp_replace(cedula_rif, '[^0-9]', '', 'g') = $1 LIMIT 1",
      [digitos]
    );

    if (colision.rows.length > 0) {
      const doctorExistente = colision.rows[0];
      return NextResponse.json({ 
        error: `Ya existe un especialista registrado con la Cédula/RIF ${doctorExistente.cedula_rif} (${doctorExistente.nombre}). No se permiten duplicados.`,
        colision: doctorExistente
      }, { status: 409 });
    }

    // 2. Insertar nuevo especialista
    const result = await pool.query(`
      INSERT INTO medicos 
      (cedula_rif, nombre, especialidad, turno, comision_pct, telefono, email, mpps_matricula, consultorio_defecto, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      cedulaCanonica,
      nombre.trim(),
      especialidad || 'Especialista General',
      turno || 'COMPLETO',
      parseFloat(String(comision_pct || 70)),
      telefono || null,
      email || null,
      mpps_matricula || null,
      consultorio_defecto || null,
      activo !== false
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') { // Unique violation
      return NextResponse.json({ error: 'La Cédula o RIF ya se encuentra registrada en el sistema.' }, { status: 409 });
    }
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, nombre, especialidad, turno, comision_pct, telefono, email, mpps_matricula, consultorio_defecto, activo } = body;
    const cedulaRaw = body.cedula_rif || body.cedula;

    if (!id) {
      return NextResponse.json({ error: 'ID de especialista requerido para actualizar.' }, { status: 400 });
    }

    const cedulaCanonica = normalizarCedulaRif(cedulaRaw);
    const digitos = extraerDigitos(cedulaRaw);

    // Verificar colisión con otro doctor diferente al actual
    if (digitos) {
      const colision = await pool.query(
        "SELECT id, nombre, cedula_rif FROM medicos WHERE regexp_replace(cedula_rif, '[^0-9]', '', 'g') = $1 AND id != $2 LIMIT 1",
        [digitos, id]
      );
      if (colision.rows.length > 0) {
        return NextResponse.json({ 
          error: `La Cédula/RIF ${cedulaCanonica} ya está asignada a otro especialista (${colision.rows[0].nombre}).`,
        }, { status: 409 });
      }
    }

    const result = await pool.query(`
      UPDATE medicos 
      SET cedula_rif = COALESCE($1, cedula_rif),
          nombre = COALESCE(NULLIF($2, ''), nombre),
          especialidad = COALESCE(NULLIF($3, ''), especialidad),
          turno = COALESCE($4, turno),
          comision_pct = COALESCE($5, comision_pct),
          telefono = COALESCE($6, telefono),
          email = COALESCE($7, email),
          mpps_matricula = COALESCE($8, mpps_matricula),
          consultorio_defecto = COALESCE($9, consultorio_defecto),
          activo = COALESCE($10, activo)
      WHERE id = $11
      RETURNING *
    `, [
      cedulaCanonica || null,
      nombre,
      especialidad,
      turno,
      comision_pct !== undefined ? parseFloat(String(comision_pct)) : null,
      telefono,
      email,
      mpps_matricula,
      consultorio_defecto,
      activo,
      id
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Especialista no encontrado.' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}
