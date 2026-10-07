import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { errorResponse, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { crearCampana, listarCampanas } from '@/lib/campanasDb';
import { FiltrosSchema } from '@/lib/segmentos';

const Schema = z.object({
  nombre: z.string().trim().min(3, 'Indique un nombre para la campaña.').max(100),
  mensaje: z.string().trim().min(10, 'El mensaje es muy corto.').max(900, 'Máximo 900 caracteres.'),
  filtros: FiltrosSchema,
  excluir: z.array(z.string().max(30)).max(5000).default([]),
});

export async function GET() {
  try {
    return NextResponse.json(await listarCampanas(pool));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Solo administrador (proxy). Encola la campaña; el bot la despacha espaciada y con tope diario. */
export async function POST(req: NextRequest) {
  try {
    const b = await parseBody(req, Schema);
    const usuario = sesionUsuario(req);
    const r = await withTransaction((client) => crearCampana(client, { ...b, usuario }));
    return NextResponse.json(r);
  } catch (err) {
    return errorResponse(err);
  }
}
