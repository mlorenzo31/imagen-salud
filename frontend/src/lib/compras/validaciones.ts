import { z } from 'zod';
import type { PoolClient } from 'pg';
import { ApiError } from '@/lib/apiHelpers';
import { normalizarRif, validarRif } from './calculos';
import { leerConfigFiscal } from './comprasDb';

export const proveedorSchema = z.object({
  rif: z.string().trim().min(1),
  razon_social: z.string().trim().min(1).max(200),
  direccion: z.string().trim().max(500).nullish(),
  telefono: z.string().trim().max(30).nullish(),
  // Art. 18.4: el comprobante de retención lleva el correo del proveedor.
  correo: z.union([z.literal(''), z.string().trim().toLowerCase().email('Correo inválido.').max(150)]).nullish(),
  tipo_persona: z.enum(['NATURAL', 'JURIDICA']),
  contribuyente_especial: z.boolean().optional(),
  activo: z.boolean().optional(),
});

export const productoSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  categoria: z.string().trim().min(1).max(100),
  alicuota_defecto: z.number().int(),
  proveedor_id: z.number().int().positive().nullish(),
  activo: z.boolean().optional(),
});

/** RIF válido y normalizado, o 400 con el motivo. */
export function rifONulo(rif: string): string {
  const error = validarRif(rif);
  if (error) throw new ApiError(400, error);
  return normalizarRif(rif);
}

/** Violación de unicidad de Postgres (23505) → 409 con el mensaje dado. */
export function duplicadoA409(err: unknown, mensaje: string): unknown {
  return (err as { code?: string })?.code === '23505' ? new ApiError(409, mensaje) : err;
}

/** La alícuota debe estar vigente en la configuración fiscal. */
export async function exigirAlicuota(alicuota: number, client?: PoolClient): Promise<void> {
  const cfg = await leerConfigFiscal(client);
  if (!cfg.alicuotas.includes(alicuota)) throw new ApiError(400, `La alícuota ${alicuota} % no está vigente (vigentes: ${cfg.alicuotas.join(', ')} %).`);
}
