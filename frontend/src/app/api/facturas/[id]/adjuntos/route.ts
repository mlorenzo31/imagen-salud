import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, withTransaction } from '@/lib/apiHelpers';
import { MAX_BYTES, TIPOS_PERMITIDOS, almacen, asegurarTablasAdjuntos, extension, nuevaRuta, resumenAdjuntos, tokenDe } from '@/lib/adjuntos';
import { asegurarTablasWhatsapp } from '@/lib/whatsapp';

async function idFactura(params: Promise<{ id: string }>): Promise<number> {
  const id = parseInt((await params).id, 10);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Identificador de factura inválido.');
  return id;
}

async function listar(facturaId: number) {
  const r = await pool.query(`SELECT id, nombre, tipo, tamano, creado FROM factura_adjuntos WHERE factura_id = $1 ORDER BY id`, [facturaId]);
  return r.rows as { id: number; nombre: string; tipo: string; tamano: number; creado: string }[];
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await idFactura(params);
    await asegurarTablasAdjuntos(pool);
    return NextResponse.json({ adjuntos: await listar(id) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Sube UN archivo (multipart, campo "file"); el cliente repite la llamada por cada archivo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await idFactura(params);
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) throw new ApiError(400, 'Falta el archivo.');
    const ext = extension(file.name);
    if (!(ext in TIPOS_PERMITIDOS)) throw new ApiError(400, 'Tipo no permitido (PDF, PNG, JPG, WEBP o DOCX).');
    if (file.size === 0) throw new ApiError(400, 'El archivo está vacío.');
    if (file.size > MAX_BYTES) throw new ApiError(413, 'El archivo supera 4 MB.');

    await asegurarTablasAdjuntos(pool);
    await asegurarTablasWhatsapp(pool);
    const existe = await pool.query(`SELECT 1 FROM facturas_caja WHERE id = $1`, [id]);
    if (existe.rowCount === 0) throw new ApiError(404, 'Factura no encontrada.');

    const ruta = nuevaRuta(id, file.name);
    const tipo = TIPOS_PERMITIDOS[ext];
    const { error } = await (await almacen()).upload(ruta, Buffer.from(await file.arrayBuffer()), { contentType: tipo });
    if (error) throw new ApiError(502, 'No se pudo guardar el archivo: ' + error.message);

    const token = await tokenDe(pool, id);
    const adjuntos = await withTransaction(async (c) => {
      await c.query(`INSERT INTO factura_adjuntos (factura_id, nombre, tipo, tamano, ruta) VALUES ($1,$2,$3,$4,$5)`, [id, file.name, tipo, file.size, ruta]);
      const lista = (await c.query(`SELECT nombre FROM factura_adjuntos WHERE factura_id = $1 ORDER BY id`, [id])).rows as { nombre: string }[];
      await c.query(
        `UPDATE facturas_caja SET adjunto_nombre = $2, adjunto_tipo = $3, whatsapp_enviado = FALSE WHERE id = $1`,
        [id, resumenAdjuntos(lista.map((x) => x.nombre)), tipo],
      );
      // Material nuevo: el envío anterior queda reemplazado para poder reenviar.
      await c.query(`UPDATE wa_outbox SET estado = 'REEMPLAZADO' WHERE factura_id = $1 AND estado = 'ENVIADO'`, [id]);
      return lista.length;
    });
    return NextResponse.json({ ok: true, token, total: adjuntos, adjunto_nombre: adjuntos === 1 ? file.name : `${adjuntos} archivos` });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await idFactura(params);
    const adjId = parseInt(req.nextUrl.searchParams.get('adjId') ?? '', 10);
    if (!Number.isInteger(adjId)) throw new ApiError(400, 'adjId inválido.');
    await asegurarTablasAdjuntos(pool);
    const r = await pool.query(`DELETE FROM factura_adjuntos WHERE id = $1 AND factura_id = $2 RETURNING ruta`, [adjId, id]);
    if (r.rowCount === 0) throw new ApiError(404, 'Adjunto no encontrado.');
    await (await almacen()).remove([r.rows[0].ruta as string]);
    const lista = (await listar(id)).map((x) => x.nombre);
    await pool.query(`UPDATE facturas_caja SET adjunto_nombre = $2 WHERE id = $1`, [id, resumenAdjuntos(lista)]);
    return NextResponse.json({ ok: true, total: lista.length });
  } catch (err) {
    return errorResponse(err);
  }
}
