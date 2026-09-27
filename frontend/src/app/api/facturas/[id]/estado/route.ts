import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const body = await req.json();

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowedFields = [
      'estado',
      'etapa_actual',
      'motivo_anulacion',
      'estudio_principal_id',
      'prioridad',
      'retorno_sala',
      'sala_anterior',
      'adjunto_nombre',
      'adjunto_url',
      'adjunto_tipo',
      'whatsapp_enviado',
      'whatsapp_fecha_envio',
      'telefono_paciente'
    ];

    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(body[key]);
        idx++;
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const query = `UPDATE facturas_caja SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;

    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
