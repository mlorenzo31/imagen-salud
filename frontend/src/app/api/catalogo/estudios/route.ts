import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import { estudioSchema, normalizarEstudio } from '@/lib/catalogoValidacion';
import { asegurarCatalogo, filaAEstudio, grupoDeArea, listarEstudios, type EstudioFila } from '@/lib/catalogoDb';
import type { EstudioItem } from '@/lib/catalogos';

const aServicio = (f: EstudioFila) => {
  const p = Number(f.precio_usd);
  const pct = (v: string) => (p > 0 ? Math.round((Number(v) / p) * 10000) / 100 : 0);
  return {
    id: f.id, codigo: f.codigo ?? undefined, nombre: f.nombre, area: f.area, grupo_clinico: grupoDeArea(f.area), precio_usd: p,
    reparto_clinica_pct: pct(f.dist_imagen), reparto_medico_pct: pct(f.dist_medico), reparto_eco_pct: pct(f.dist_eco), reparto_patologo_pct: pct(f.dist_patologo),
    dist: { imagen: Number(f.dist_imagen), medico: Number(f.dist_medico), eco: Number(f.dist_eco), patologo: Number(f.dist_patologo) },
    activo: f.activo, sala_defecto: f.sala,
  };
};

/** GET: catálogo agrupado por área (Recepción, solo activos). GET ?lista=1: lista plana con inactivos (Catálogos). */
export async function GET(request: NextRequest) {
  try {
    const lista = request.nextUrl.searchParams.get('lista') === '1';
    const { filas, respaldo } = await listarEstudios(!lista);
    if (lista) return NextResponse.json({ respaldo, estudios: filas.map(aServicio) });
    const porArea: Record<string, EstudioItem[]> = {};
    for (const f of filas) (porArea[f.area] ||= []).push(filaAEstudio(f));
    return NextResponse.json({ respaldo, catalogo: porArea });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const b = await parseBody(request, estudioSchema);
    const { precio, d } = normalizarEstudio(b);
    await asegurarCatalogo();
    try {
      const r = await pool.query(
        `INSERT INTO catalogo_estudios (codigo, area, nombre, precio_usd, sala, dist_imagen, dist_medico, dist_eco, dist_patologo, activo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [b.codigo || null, b.area, b.nombre, precio, b.sala, d[0], d[1], d[2], d[3], b.activo ?? true]
      );
      return NextResponse.json(aServicio(r.rows[0]), { status: 201 });
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
