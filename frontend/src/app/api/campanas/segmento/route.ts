import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { errorResponse, parseBody } from '@/lib/apiHelpers';
import { consultarSegmento, opcionesFiltros } from '@/lib/campanasDb';
import { FiltrosSchema, resumirSegmento } from '@/lib/segmentos';

/** Valores disponibles para los filtros (áreas, médicos, estudios). */
export async function GET() {
  try {
    return NextResponse.json(await opcionesFiltros(pool));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Pacientes que cumplen los filtros + resumen por rango etario, área y médico. */
export async function POST(req: NextRequest) {
  try {
    const { filtros } = await parseBody(req, z.object({ filtros: FiltrosSchema }));
    const { pacientes, conBaja } = await consultarSegmento(pool, filtros);
    return NextResponse.json({ pacientes, resumen: resumirSegmento(pacientes, conBaja) });
  } catch (err) {
    return errorResponse(err);
  }
}
