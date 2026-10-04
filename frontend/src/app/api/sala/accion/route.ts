import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, parseBody, withTransaction } from '@/lib/apiHelpers';
import { planificarLlamado } from '@/lib/sala';
import { SELECT_SALA, aTarea, recalcularFacturas, sincronizarSala, type FilaSala } from '@/lib/salaDb';

const Schema = z.object({
  accion: z.enum(['LLAMAR', 'FINALIZAR', 'AUSENTE']),
  ids: z.array(z.number().int().positive()).min(1).max(20),
  box: z.string().max(60).optional(),
});

/**
 * Cambios de estado de los turnos de sala. Todo ocurre bajo un candado global para que dos puestos
 * no llamen al mismo paciente (u ocupen la misma sala) a la vez.
 */
export async function POST(req: NextRequest) {
  try {
    const { accion, ids, box } = await parseBody(req, Schema);
    const out = await withTransaction(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('sala'))`);
      await sincronizarSala(c);
      const abiertas = (await c.query(SELECT_SALA)).rows as FilaSala[];
      const tareas = abiertas.map(aTarea);
      const sel = ids.map((id) => abiertas.find((r) => r.id === id));
      if (sel.some((r) => !r)) throw new ApiError(409, 'El turno ya no está activo en la sala.', 'NO_ENCONTRADO');
      const filas = sel as FilaSala[];
      const facturas = filas.map((r) => r.factura_id);

      if (accion === 'LLAMAR') {
        const plan = planificarLlamado(ids, tareas, box);
        if (!plan.ok) throw new ApiError(409, plan.mensaje, plan.codigo);
        for (const a of plan.asignaciones) {
          await c.query(`UPDATE sala_servicios SET estado = 'ATENCION', box = $2, llamado_en = now(), retorno = FALSE WHERE id = $1`, [a.id, a.box]);
        }
        await recalcularFacturas(c, facturas);
        return { asignaciones: plan.asignaciones };
      }

      if (filas.some((r) => r.estado !== 'ATENCION')) throw new ApiError(409, 'El paciente no está en atención.', 'ESTADO_INVALIDO');

      if (accion === 'FINALIZAR') {
        await c.query(`UPDATE sala_servicios SET estado = 'FINALIZADO', finalizado_en = now() WHERE id = ANY($1::int[])`, [ids]);
        // Retorno prioritario: sus otros estudios pendientes pasan al frente de la cola.
        await c.query(`UPDATE sala_servicios SET retorno = TRUE WHERE estado = 'ESPERA' AND factura_id = ANY($1::int[])`, [facturas]);
        await recalcularFacturas(c, facturas);
        return { finalizados: ids };
      }

      // AUSENTE: no se presentó al llamado → vuelve a espera, al final de la cola.
      await c.query(
        `UPDATE sala_servicios SET estado = 'ESPERA', box = NULL, llamado_en = NULL, ausencias = ausencias + 1, retorno = FALSE, orden_cola = now()
          WHERE id = ANY($1::int[])`, [ids],
      );
      await recalcularFacturas(c, facturas);
      return { reingresados: ids };
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return errorResponse(err);
  }
}
