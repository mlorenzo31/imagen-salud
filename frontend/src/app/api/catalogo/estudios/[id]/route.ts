import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import { asegurarCatalogo } from '@/lib/catalogoDb';
import { estudioSchema, normalizarEstudio } from '@/lib/catalogoValidacion';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseInt((await params).id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Identificador inválido.');
    const b = await parseBody(request, estudioSchema);
    const { precio, d } = normalizarEstudio(b);
    await asegurarCatalogo();
    try {
      const r = await pool.query(
        `UPDATE catalogo_estudios SET codigo=$1, area=$2, nombre=$3, precio_usd=$4, sala=$5,
           dist_imagen=$6, dist_medico=$7, dist_eco=$8, dist_patologo=$9, activo=COALESCE($10, activo), actualizado_en=now()
         WHERE id=$11 RETURNING *`,
        [b.codigo || null, b.area, b.nombre, precio, b.sala, d[0], d[1], d[2], d[3], b.activo ?? null, id]
      );
      if (r.rows.length === 0) throw new ApiError(404, 'Estudio no encontrado.');
      return NextResponse.json({ ok: true, id });
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
        throw new ApiError(409, 'Ya existe un estudio con ese nombre en esa área.');
      }
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
