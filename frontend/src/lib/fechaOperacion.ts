import { z } from 'zod';
import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { ApiError, fechaHoraLocal } from '@/lib/apiHelpers';
import { fechasCerradas } from '@/lib/cierre';

type Db = Pick<PoolClient, 'query'>;

/** Campos opcionales que acepta toda operación de tesorería para registrarse en un día anterior. */
export const camposFechaOperacion = {
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.').nullish(),
  motivo_retroactivo: z.string().trim().max(200).nullish(),
};

export interface FechaOperacion { fecha: string; hora: string; retroactiva: boolean; nota: string }

/**
 * Fecha contable de una operación. Sin `fecha` (o igual a hoy) = hoy. Con una fecha pasada:
 *  - no puede ser futura;
 *  - exige motivo;
 *  - si ese día ya tiene cierre, solo un administrador puede registrarla.
 * La hora y los saldos son los del momento real del registro; solo cambia el día contable.
 */
export async function resolverFechaOperacion(
  b: { fecha?: string | null; motivo_retroactivo?: string | null },
  esAdmin: boolean,
  db: Db = pool,
): Promise<FechaOperacion> {
  const hoy = fechaHoraLocal();
  if (!b.fecha || b.fecha === hoy.fecha) return { ...hoy, retroactiva: false, nota: '' };
  if (b.fecha > hoy.fecha) throw new ApiError(400, 'La fecha de la operación no puede ser futura.');
  const motivo = (b.motivo_retroactivo ?? '').trim();
  if (motivo.length < 3) throw new ApiError(400, 'Indique el motivo del registro en un día anterior.');
  if ((await fechasCerradas(db)).has(b.fecha) && !esAdmin) {
    throw new ApiError(403, `El ${b.fecha} ya está cerrado: solo un administrador puede registrar operaciones en ese día.`);
  }
  return { fecha: b.fecha, hora: hoy.hora, retroactiva: true, nota: ` [Registro retroactivo del ${b.fecha}: ${motivo}]` };
}
