import { describe, expect, it } from 'vitest';
import { esComprobante, formatearComprobante, secuencialDe, siguienteSecuencial, montosComprobante } from './comprobante';

describe('art. 18.1: AAAAMMSSSSSSSS', () => {
  it('año y mes de emisión + secuencial de 8 dígitos (14 caracteres)', () => {
    expect(formatearComprobante('2027-03-15', 1)).toBe('20270300000001');
    expect(formatearComprobante('2027-12-01', 12345678)).toBe('20271212345678');
    expect(formatearComprobante('2027-03-15', 1)).toHaveLength(14);
  });
  it('rechaza secuenciales fuera de rango y fechas inválidas', () => {
    expect(() => formatearComprobante('2027-03-15', 0)).toThrow();
    expect(() => formatearComprobante('2027-03-15', 100_000_000)).toThrow();
    expect(() => formatearComprobante('2027-3-15', 1)).toThrow();
  });
  it('el secuencial es continuo entre meses y se reinicia solo al superar 99.999.999', () => {
    expect(siguienteSecuencial(41)).toBe(42);
    expect(siguienteSecuencial(99_999_999)).toBe(1);
  });
  it('lee el secuencial de un comprobante y valida el formato', () => {
    expect(secuencialDe('20261000000007')).toBe(7);
    expect(esComprobante('20261000000007')).toBe(true);
    expect(esComprobante('2026100000007')).toBe(false);
    expect(esComprobante('20261300000007')).toBe(false);
    expect(esComprobante('20261000000000')).toBe(false);
  });
});

describe('montosComprobante (art. 18.8, en Bs)', () => {
  it('factura en Bs: los montos tal cual', () => {
    expect(montosComprobante({ moneda: 'BS', tasa: '1', total: 11600, base: 10000, iva: 1600, ivaRetenido: 1200, islrRetenido: 0 }))
      .toEqual({ total: 11600, base: 10000, iva: 1600, ivaRetenido: 1200, islrRetenido: 0 });
  });
  it('factura en USD: se llevan a Bs con la tasa de la factura', () => {
    expect(montosComprobante({ moneda: 'USD', tasa: '211.67', total: 11600, base: 10000, iva: 1600, ivaRetenido: 1200, islrRetenido: 200 }))
      .toEqual({ total: 2455372, base: 2116700, iva: 338672, ivaRetenido: 254004, islrRetenido: 42334 });
  });
});
