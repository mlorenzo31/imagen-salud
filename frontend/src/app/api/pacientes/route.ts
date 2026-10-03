import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { asegurarCatalogo } from '@/lib/catalogoDb';
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

    // Consulta con deduplicación garantizada, visitas (facturas no anuladas) y saldo pendiente de cartera
    let tieneActivo = true;
    try { await asegurarCatalogo(); } catch { tieneActivo = false; }
    const result = await pool.query(`
      SELECT DISTINCT ON (regexp_replace(p.cedula, '[^0-9]', '', 'g'))
        p.id, p.cedula, p.nombre, p.fecha_nacimiento, p.direccion, p.telefono,
        ${tieneActivo ? 'COALESCE(p.activo, TRUE)' : 'TRUE'} AS activo,
        (SELECT COUNT(*)::int FROM facturas_caja f
           WHERE regexp_replace(f.cedula_paciente, '[^0-9]', '', 'g') = regexp_replace(p.cedula, '[^0-9]', '', 'g')
             AND f.estado NOT IN ('ANULADA', 'ANULADA_SALA')) AS visitas,
        (SELECT COALESCE(SUM(c.saldo_restante_usd), 0) FROM cartera_deudores c
           WHERE regexp_replace(c.cedula_paciente, '[^0-9]', '', 'g') = regexp_replace(p.cedula, '[^0-9]', '', 'g')
             AND c.estado = 'PENDIENTE') AS saldo_pendiente_usd
      FROM pacientes p
      ORDER BY regexp_replace(p.cedula, '[^0-9]', '', 'g'), p.id DESC
    `);
    
    // Ordenar alfabéticamente por nombre para la UI
    const pacientesOrdenados = result.rows.sort((a, b) => 
      (a.nombre || '').localeCompare(b.nombre || '')
    );

    return NextResponse.json(pacientesOrdenados);
  } catch (err) {
    return errorResponse(err);
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
  } catch (err) {
    return errorResponse(err);
  }
}

/** Activa o desactiva un paciente del catálogo (solo administrador; ver lib/auth.ts). */
export async function PUT(req: NextRequest) {
  try {
    const { id, activo } = (await req.json()) as { id?: unknown; activo?: unknown };
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid <= 0 || typeof activo !== 'boolean') {
      return NextResponse.json({ error: 'Se requiere id (entero) y activo (booleano).' }, { status: 400 });
    }
    await asegurarCatalogo();
    const r = await pool.query('UPDATE pacientes SET activo = $1 WHERE id = $2 RETURNING id, activo', [activo, pid]);
    if (r.rows.length === 0) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}
