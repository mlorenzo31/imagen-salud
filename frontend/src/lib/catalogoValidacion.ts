import { z } from 'zod';
import { ApiError } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';

const dinero = z.union([z.string(), z.number()]);
export const estudioSchema = z.object({
  codigo: z.string().max(40).nullish(),
  area: z.string().regex(/^[A-Z_]{3,40}$/, 'Área inválida (use MAYÚSCULAS_Y_GUION_BAJO).'),
  nombre: z.string().trim().min(2).max(255),
  precio_usd: dinero,
  sala: z.string().trim().min(2).max(80),
  dist_imagen: dinero,
  dist_medico: dinero,
  dist_eco: dinero,
  dist_patologo: dinero,
  activo: z.boolean().optional(),
});

/** Convierte y valida: el reparto (clínica + médico + ecografista + patólogo) debe sumar exactamente el precio. */
export function normalizarEstudio(b: z.infer<typeof estudioSchema>) {
  const precio = toCents(b.precio_usd);
  const d = [toCents(b.dist_imagen), toCents(b.dist_medico), toCents(b.dist_eco), toCents(b.dist_patologo)];
  if (precio <= 0) throw new ApiError(400, 'El precio debe ser mayor a 0.');
  if (d.some((v) => v < 0)) throw new ApiError(400, 'El reparto no puede tener montos negativos.');
  const suma = d.reduce((a, v) => a + v, 0);
  if (suma !== precio) throw new ApiError(400, `El reparto suma $${centsToStr(suma)} y el precio es $${centsToStr(precio)}: deben coincidir.`);
  return { precio: centsToStr(precio), d: d.map(centsToStr) };
}
