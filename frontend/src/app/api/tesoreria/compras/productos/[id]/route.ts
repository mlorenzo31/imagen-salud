import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody } from '@/lib/apiHelpers';
import { asegurarCompras } from '@/lib/compras/comprasDb';
import { exigirAlicuota, productoSchema } from '@/lib/compras/validaciones';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseInt((await params).id, 10);
    const b = await parseBody(req, productoSchema);
    await asegurarCompras();
    await exigirAlicuota(b.alicuota_defecto);
    const r = await pool.query(
      'UPDATE productos_compra SET nombre = $1, categoria = $2, alicuota_defecto = $3, proveedor_id = $4, activo = $5 WHERE id = $6 RETURNING *',
      [b.nombre, b.categoria, b.alicuota_defecto, b.proveedor_id ?? null, b.activo ?? true, id]
    );
    if (r.rows.length === 0) throw new ApiError(404, 'Producto no encontrado.');
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}
