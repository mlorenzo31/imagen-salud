import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { errorResponse, parseBody } from '@/lib/apiHelpers';
import { cancelarCampana } from '@/lib/campanasDb';

export async function POST(req: NextRequest) {
  try {
    const { id } = await parseBody(req, z.object({ id: z.number().int().positive() }));
    return NextResponse.json({ cancelados: await cancelarCampana(pool, id) });
  } catch (err) {
    return errorResponse(err);
  }
}
