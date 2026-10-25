/**
 * Comprobante de retención (art. 18 de la Providencia G.O. 21/10/2026). Numeración AAAAMMSSSSSSSS: año y mes de
 * emisión + secuencial de 8 dígitos continuo para el agente de retención; solo se reinicia al superar 99.999.999.
 */
import { mulRate } from '@/lib/money';

const MAX = 99_999_999;

export function formatearComprobante(fechaEmision: string, secuencial: number): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(fechaEmision);
  if (!m) throw new Error(`Fecha de emisión inválida: ${fechaEmision}`);
  if (!Number.isInteger(secuencial) || secuencial < 1 || secuencial > MAX) throw new Error(`Secuencial fuera de rango: ${secuencial}`);
  return `${m[1]}${m[2]}${String(secuencial).padStart(8, '0')}`;
}

export function siguienteSecuencial(ultimo: number): number {
  return ultimo >= MAX ? 1 : ultimo + 1;
}

export function esComprobante(numero: string): boolean {
  const m = /^\d{4}(\d{2})(\d{8})$/.exec(numero);
  return !!m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1;
}

export function secuencialDe(numero: string): number {
  if (!esComprobante(numero)) throw new Error(`Comprobante inválido: ${numero}`);
  return Number(numero.slice(6));
}

/** Montos del art. 18.8 en Bs (centavos). Las facturas en USD se llevan a Bs con la tasa de la propia factura. */
export function montosComprobante(f: {
  moneda: 'BS' | 'USD'; tasa: string | number; total: number; base: number; iva: number; ivaRetenido: number; islrRetenido: number;
}): { total: number; base: number; iva: number; ivaRetenido: number; islrRetenido: number } {
  const bs = (c: number) => (f.moneda === 'BS' ? c : mulRate(c, f.tasa));
  return { total: bs(f.total), base: bs(f.base), iva: bs(f.iva), ivaRetenido: bs(f.ivaRetenido), islrRetenido: bs(f.islrRetenido) };
}
