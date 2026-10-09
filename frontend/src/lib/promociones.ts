import { z } from 'zod';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD).');

/** Entrada de una promoción. `valor`: % si tipo PCT; dólares si USD (descuento) o FIJO (precio final). Hasta 2 decimales. */
export const promoEntradaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(80),
  tipo: z.enum(['PCT', 'USD', 'FIJO']).default('PCT'),
  valor: z.number().gt(0, 'El valor debe ser mayor a 0.').max(100000)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Máximo 2 decimales.'),
  modo: z.enum(['CLINICA', 'PROPORCIONAL']),
  areas: z.array(z.string().trim().min(1)).default([]),
  estudios: z.array(z.string().trim().min(1)).default([]),
  requiere: z.array(z.string().trim().min(1)).default([]),
  fechaDesde: fecha,
  fechaHasta: fecha,
  activa: z.boolean().default(true),
}).refine((p) => p.tipo !== 'PCT' || p.valor <= 100, { message: 'El porcentaje no puede superar 100.', path: ['valor'] })
  .refine((p) => p.fechaDesde <= p.fechaHasta, { message: 'La fecha de inicio no puede ser posterior al fin.', path: ['fechaHasta'] })
  .refine((p) => p.areas.length + p.estudios.length > 0, { message: 'Indique al menos un área o un estudio.', path: ['areas'] });

export type PromoEntrada = z.infer<typeof promoEntradaSchema>;
