import { describe, expect, it } from 'vitest';
import { promoEntradaSchema } from './promociones';

const ok = { nombre: 'Mes Rosa', porcentaje: 20, modo: 'CLINICA', areas: ['MAMOGRAFIA'], estudios: [], fechaDesde: '2026-10-01', fechaHasta: '2026-10-31', activa: true };

describe('promoEntradaSchema', () => {
  it('acepta una promoción válida', () => {
    expect(promoEntradaSchema.safeParse(ok).success).toBe(true);
  });
  it('rechaza porcentaje 0 y mayor a 100', () => {
    expect(promoEntradaSchema.safeParse({ ...ok, porcentaje: 0 }).success).toBe(false);
    expect(promoEntradaSchema.safeParse({ ...ok, porcentaje: 101 }).success).toBe(false);
  });
  it('rechaza fechas invertidas, nombre vacío y sin áreas ni estudios', () => {
    expect(promoEntradaSchema.safeParse({ ...ok, fechaDesde: '2026-11-01' }).success).toBe(false);
    expect(promoEntradaSchema.safeParse({ ...ok, nombre: '  ' }).success).toBe(false);
    expect(promoEntradaSchema.safeParse({ ...ok, areas: [], estudios: [] }).success).toBe(false);
  });
});
