import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { asegurarTablasAdjuntos } from '@/lib/adjuntos';

/** Público: listado de archivos de un enlace de resultados (el token es secreto y no adivinable). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    await asegurarTablasAdjuntos(pool);
    const f = await pool.query(
      `SELECT id, nombre_paciente, estudio, fecha FROM facturas_caja WHERE adjunto_token = $1`,
      [token],
    );
    if (f.rowCount === 0) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 });
    const fila = f.rows[0] as { id: number; nombre_paciente: string | null; estudio: string | null; fecha: string };
    const a = await pool.query(`SELECT id, nombre, tipo, tamano FROM factura_adjuntos WHERE factura_id = $1 ORDER BY id`, [fila.id]);
    const nombre = (fila.nombre_paciente ?? '').trim().split(/\s+/);
    return NextResponse.json({
      paciente: nombre.length > 1 ? `${nombre[0]} ${nombre[1][0]}.` : nombre[0] ?? '',
      estudio: fila.estudio,
      fecha: fila.fecha,
      archivos: a.rows,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err);
  }
}
