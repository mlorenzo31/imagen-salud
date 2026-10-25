/**
 * Retenciones que le practican a la clínica sus clientes agentes de retención (aseguradoras, empresas). El número
 * es el del comprobante que emite el agente (art. 18); la clínica lo registra contra su propia factura fiscal.
 */
import { z } from 'zod';
import { toCents } from '@/lib/money';
import { esComprobante } from '@/lib/compras/comprobante';
import { rif } from './configEmisor';

const monto = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const c = toCents(String(v).replace(',', '.'));
  if (!Number.isFinite(c) || c < 0) { ctx.addIssue({ code: 'custom', message: 'Monto inválido.' }); return z.NEVER; }
  return c;
});

export const retencionRecibidaSchema = z.object({
  agenteRif: rif('VEJGPC', 'RIF del agente de retención inválido.'),
  agenteRazonSocial: z.string().trim().min(1).max(200),
  numeroComprobante: z.string().trim().refine(esComprobante, 'N° de comprobante inválido: 14 dígitos AAAAMMSSSSSSSS (art. 18).'),
  fechaComprobante: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD.'),
  /** N° de la factura fiscal de la clínica (8 dígitos). */
  facturaNumero: z.string().trim().regex(/^\d{1,8}$/, 'N° de factura inválido.').transform((v) => v.padStart(8, '0')),
  /** Serie del talonario si la factura fue de contingencia; vacío = numeración digital. */
  facturaSerie: z.string().trim().toUpperCase().max(6).default(''),
  /** Centavos de Bs. */
  ivaRetenido: monto,
  islrRetenido: monto,
  observacion: z.string().trim().max(300).optional(),
}).refine((r) => r.ivaRetenido + r.islrRetenido > 0, 'Indique el monto retenido de IVA o de ISLR.');
export type RetencionRecibida = z.infer<typeof retencionRecibidaSchema>;

/** Coherencia con la factura de la clínica (centavos de Bs), sumando lo ya retenido sobre ella. Devuelve el error o null. */
export function validarContraFactura(
  r: { ivaRetenido: number; islrRetenido: number; agenteRif: string },
  f: { ivaBs: number; baseBs: number; receptorDocumento: string; anulada: boolean; ivaPrevio?: number; islrPrevio?: number },
): string | null {
  if (f.anulada) return 'La factura está anulada: no admite retenciones.';
  if (r.agenteRif !== f.receptorDocumento) return `El agente de retención (${r.agenteRif}) no es el receptor de la factura (${f.receptorDocumento}).`;
  if (r.ivaRetenido + (f.ivaPrevio ?? 0) > f.ivaBs) return f.ivaBs === 0 ? 'La factura es exenta de IVA: no puede haber IVA retenido.' : 'El IVA retenido (con lo ya registrado) supera el IVA de la factura.';
  if (r.islrRetenido + (f.islrPrevio ?? 0) > f.baseBs) return 'El ISLR retenido (con lo ya registrado) supera la base de la factura.';
  return null;
}
