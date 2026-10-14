import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import { asegurarCompras } from '@/lib/compras/comprasDb';
import { duplicadoA409, proveedorSchema, rifONulo } from '@/lib/compras/validaciones';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseInt((await params).id, 10);
    const b = await parseBody(req, proveedorSchema);
    const rif = rifONulo(b.rif);
    await asegurarCompras();
    const r = await pool.query(
      `UPDATE proveedores SET rif = $1, razon_social = $2, direccion = $3, telefono = $4, tipo_persona = $5,
              contribuyente_especial = $6, activo = $7 WHERE id = $8 RETURNING *`,
      [rif, b.razon_social.toUpperCase(), b.direccion || null, b.telefono || null, b.tipo_persona, b.contribuyente_especial ?? false, b.activo ?? true, id]
    ).catch((e) => { throw duplicadoA409(e, `Ya existe un proveedor con el RIF ${rif}.`); });
    if (r.rows.length === 0) throw new ApiError(404, 'Proveedor no encontrado.');
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}
