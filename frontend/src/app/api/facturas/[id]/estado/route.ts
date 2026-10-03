import { NextRequest, NextResponse } from 'next/server';
import { ApiError, errorResponse, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { esAnulada } from '@/lib/estados';
import { revertirTesoreriaPorAnulacion } from '@/lib/anulacion';

const ALLOWED_FIELDS = [
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
  'telefono_paciente',
] as const;

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseInt((await params).id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Identificador de factura inválido.');
    const body = (await req.json()) as Record<string, unknown>;
    // etapa_actual se normaliza a número (0 espera, 1 atención, 2 finalizado) aunque el cliente envíe texto.
    if (body.etapa_actual !== undefined) {
      const mapa: Record<string, number> = { ESPERA: 0, ATENCION: 1, FINALIZADO: 2 };
      const crudo = String(body.etapa_actual).toUpperCase();
      const etapa = crudo in mapa ? mapa[crudo] : Number(crudo);
      if (!Number.isInteger(etapa) || etapa < 0 || etapa > 2) throw new ApiError(400, 'etapa_actual inválida.');
      body.etapa_actual = etapa;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        values.push(body[key]);
        fields.push(`${key} = $${values.length}`);
      }
    }
    if (fields.length === 0) throw new ApiError(400, 'No hay campos para actualizar.');

    const out = await withTransaction(async (client) => {
      const actual = await client.query('SELECT estado FROM facturas_caja WHERE id = $1 FOR UPDATE', [id]);
      if (actual.rows.length === 0) throw new ApiError(404, 'Factura no encontrada.');

      const nuevoEstado = typeof body.estado === 'string' ? body.estado : undefined;
      const yaAnulada = esAnulada(actual.rows[0].estado);
      if (yaAnulada && nuevoEstado !== undefined && !esAnulada(nuevoEstado)) {
        throw new ApiError(409, 'Una factura anulada no puede reactivarse.');
      }

      values.push(id);
      const result = await client.query(`UPDATE facturas_caja SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`, values);

      let advertencias: string[] = [];
      if (!yaAnulada && esAnulada(nuevoEstado)) {
        const motivo = typeof body.motivo_anulacion === 'string' ? body.motivo_anulacion : '';
        ({ advertencias } = await revertirTesoreriaPorAnulacion(client, id, sesionUsuario(req), motivo));
      }
      return { factura: result.rows[0], advertencias };
    });

    // Se conserva la forma de respuesta previa (la factura) y se añaden advertencias solo si existen.
    return NextResponse.json(out.advertencias.length > 0 ? { ...out.factura, advertencias_anulacion: out.advertencias } : out.factura);
  } catch (err) {
    return errorResponse(err);
  }
}
