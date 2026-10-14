import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { errorResponse, parseBody, sesionUsuario } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';
import { asegurarCompras, leerConfigFiscal } from '@/lib/compras/comprasDb';

/** Configuración fiscal de compras (retenciones, alícuotas). Leer: admin y asistente; cambiar: solo admin. */
export async function GET() {
  try {
    await asegurarCompras();
    return NextResponse.json(await leerConfigFiscal());
  } catch (err) {
    return errorResponse(err);
  }
}

const schema = z.object({
  retencionesActivas: z.boolean(),
  ivaRetenidoPct: z.union([z.literal(75), z.literal(100)]),
  alicuotas: z.array(z.number().int().min(0).max(100)).min(1),
  islr: z.array(z.object({
    concepto: z.string().trim().min(1).max(100),
    tipoPersona: z.enum(['NATURAL', 'JURIDICA']),
    pct: z.number().min(0).max(100),
    sustraendo: z.union([z.string(), z.number()]).optional(),
  })),
});

export async function PUT(req: NextRequest) {
  try {
    const b = await parseBody(req, schema);
    await asegurarCompras();
    // La alícuota 0 (exento) siempre está disponible; el sustraendo se guarda en centavos.
    const valor = {
      ...b,
      alicuotas: [...new Set([...b.alicuotas, 0])].sort((x, y) => y - x),
      islr: b.islr.map((r) => ({ ...r, sustraendo: toCents(r.sustraendo ?? 0) })),
    };
    await pool.query(
      `INSERT INTO config_fiscal (clave, valor, usuario, actualizado_en) VALUES ('fiscal', $1, $2, now())
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, usuario = EXCLUDED.usuario, actualizado_en = now()`,
      [JSON.stringify(valor), sesionUsuario(req)]
    );
    return NextResponse.json(valor);
  } catch (err) {
    return errorResponse(err);
  }
}
