import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { almacen, asegurarTablasAdjuntos, nombreSeguro } from '@/lib/adjuntos';

/** Público: entrega un archivo del enlace de resultados (?descargar=1 fuerza la descarga). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; adjId: string }> }) {
  try {
    const { token, adjId } = await params;
    const id = parseInt(adjId, 10);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Archivo no válido.' }, { status: 404 });
    await asegurarTablasAdjuntos(pool);
    const r = await pool.query(
      `SELECT a.nombre, a.tipo, a.ruta FROM factura_adjuntos a JOIN facturas_caja f ON f.id = a.factura_id WHERE a.id = $1 AND f.adjunto_token = $2`,
      [id, token],
    );
    if (r.rowCount === 0) return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 });
    const { nombre, tipo, ruta } = r.rows[0] as { nombre: string; tipo: string; ruta: string };
    const { data, error } = await (await almacen()).download(ruta);
    if (error || !data) return NextResponse.json({ error: 'No se pudo leer el archivo.' }, { status: 502 });
    const descargar = req.nextUrl.searchParams.get('descargar') === '1';
    return new Response(await data.arrayBuffer(), {
      headers: {
        'Content-Type': tipo,
        'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename="${nombreSeguro(nombre)}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
