import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { asegurarFiscal } from '@/lib/fiscal/fiscalDb';
import { procesarPendientes } from '@/lib/fiscal/emision';
import { obtenerProveedor } from '@/lib/fiscal/proveedor';

/** Documentos fiscales no emitidos (pendientes, en envío o rechazados) y conteo por estado. Admin y asistente. */
export async function GET() {
  try {
    await asegurarFiscal();
    const [lista, conteo] = await Promise.all([
      pool.query(
        `SELECT id, tipo, numero, factura_caja_id, estado, intentos, ultimo_error, proximo_intento, fecha_emision, receptor_nombre, total_usd, total_bs
         FROM documentos_fiscales WHERE estado NOT IN ('EMITIDO', 'CONTINGENCIA') ORDER BY id LIMIT 200`
      ),
      pool.query('SELECT estado, count(*)::int AS n FROM documentos_fiscales GROUP BY estado'),
    ]);
    return NextResponse.json({
      documentos: lista.rows,
      conteo: Object.fromEntries(conteo.rows.map((r) => [r.estado, r.n])),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Reintenta ya los pendientes con plazo vencido (también sirve para una tarea programada). */
export async function POST() {
  try {
    await asegurarFiscal();
    const proveedor = obtenerProveedor();
    if (!proveedor) return NextResponse.json({ error: 'La emisión fiscal está desactivada (FISCAL_PROVEEDOR).' }, { status: 409 });
    return NextResponse.json({ procesados: await procesarPendientes(pool, proveedor, fechaHoraLocal().fecha) });
  } catch (err) {
    return errorResponse(err);
  }
}
