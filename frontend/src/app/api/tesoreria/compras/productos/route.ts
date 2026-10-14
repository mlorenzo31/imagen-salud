import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { errorResponse, parseBody } from '@/lib/apiHelpers';
import { asegurarCompras } from '@/lib/compras/comprasDb';
import { exigirAlicuota, productoSchema } from '@/lib/compras/validaciones';

/** Catálogo de productos y servicios de compra (?proveedor_id= para los de un proveedor y los generales). */
export async function GET(req: NextRequest) {
  try {
    await asegurarCompras();
    const prov = Number(new URL(req.url).searchParams.get('proveedor_id')) || null;
    const r = await pool.query(
      `SELECT * FROM productos_compra ${prov ? 'WHERE proveedor_id = $1 OR proveedor_id IS NULL' : ''} ORDER BY activo DESC, categoria, nombre`,
      prov ? [prov] : []
    );
    return NextResponse.json(r.rows);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await parseBody(req, productoSchema);
    await asegurarCompras();
    await exigirAlicuota(b.alicuota_defecto);
    const r = await pool.query(
      'INSERT INTO productos_compra (nombre, categoria, alicuota_defecto, proveedor_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [b.nombre, b.categoria, b.alicuota_defecto, b.proveedor_id ?? null]
    );
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}
