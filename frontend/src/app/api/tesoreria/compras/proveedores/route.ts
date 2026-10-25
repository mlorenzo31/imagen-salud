import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { errorResponse, parseBody } from '@/lib/apiHelpers';
import { duplicadoA409, proveedorSchema, rifONulo } from '@/lib/compras/validaciones';
import { asegurarCompras } from '@/lib/compras/comprasDb';

/** Proveedores (búsqueda por RIF o razón social con ?q=). */
export async function GET(req: NextRequest) {
  try {
    await asegurarCompras();
    const q = new URL(req.url).searchParams.get('q')?.trim();
    const r = await pool.query(
      `SELECT * FROM proveedores ${q ? 'WHERE rif ILIKE $1 OR razon_social ILIKE $1' : ''} ORDER BY activo DESC, razon_social LIMIT 200`,
      q ? [`%${q}%`] : []
    );
    return NextResponse.json(r.rows);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await parseBody(req, proveedorSchema);
    const rif = rifONulo(b.rif);
    await asegurarCompras();
    const r = await pool.query(
      `INSERT INTO proveedores (rif, razon_social, direccion, telefono, tipo_persona, contribuyente_especial, correo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [rif, b.razon_social.toUpperCase(), b.direccion || null, b.telefono || null, b.tipo_persona, b.contribuyente_especial ?? false, b.correo || null]
    ).catch((e) => { throw duplicadoA409(e, `Ya existe un proveedor con el RIF ${rif}.`); });
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}
