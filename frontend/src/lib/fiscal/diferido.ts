/**
 * Facturación diferida: casos legítimos en que la factura fiscal se emite después del cobro.
 * Todo cobro termina facturado; diferir solo mueve el momento, con un plazo máximo.
 */
import { z } from 'zod';

export const MOTIVOS_DIFERIDO = {
  ANTICIPO: { etiqueta: 'Anticipo: se factura al prestar el servicio', regla: 'dias', dias: 30 },
  ASEGURADORA: { etiqueta: 'Aseguradora o empresa: factura consolidada del mes', regla: 'finDeMes', dias: 0 },
  DATOS_EMPRESA: { etiqueta: 'Factura a empresa: faltan su razón social y RIF', regla: 'dias', dias: 2 },
} as const;

export type MotivoDiferido = keyof typeof MOTIVOS_DIFERIDO;

export const diferirSchema = z.object({
  motivo: z.enum(['ANTICIPO', 'ASEGURADORA', 'DATOS_EMPRESA']),
  pin: z.string().min(1, 'Ingrese su clave para autorizar la facturación diferida.'),
});

/** Fecha límite (AAAA-MM-DD) para emitir la factura de un cobro diferido. */
export function fechaLimite(motivo: MotivoDiferido, fechaCobro: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaCobro);
  if (!m) throw new Error(`Fecha inválida: ${fechaCobro}`);
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const regla = MOTIVOS_DIFERIDO[motivo];
  // Fin de mes: la factura debe quedar dentro del mismo período de imposición del cobro.
  const f = regla.regla === 'finDeMes' ? new Date(Date.UTC(a, mes, 0)) : new Date(Date.UTC(a, mes - 1, d + regla.dias));
  return f.toISOString().slice(0, 10);
}
