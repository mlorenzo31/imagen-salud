import { describe, expect, it } from 'vitest';
import { promoEntradaSchema } from './promociones';

const ok = { nombre: 'Mes Rosa', tipo: 'PCT', valor: 20, requiere: [], modo: 'CLINICA', areas: ['MAMOGRAFIA'], estudios: [], fechaDesde: '2026-10-01', fechaHasta: '2026-10-31', activa: true };

describe('promoEntradaSchema', () => {
  it('acepta una promoción válida', () => {
    expect(promoEntradaSchema.safeParse(ok).success).toBe(true);
  });
  it('rechaza porcentaje 0 y mayor a 100', () => {
    expect(promoEntradaSchema.safeParse({ ...ok, valor: 0 }).success).toBe(false);
    expect(promoEntradaSchema.safeParse({ ...ok, valor: 101 }).success).toBe(false);
  });
  it('rechaza fechas invertidas, nombre vacío y sin áreas ni estudios', () => {
    expect(promoEntradaSchema.safeParse({ ...ok, fechaDesde: '2026-11-01' }).success).toBe(false);
    expect(promoEntradaSchema.safeParse({ ...ok, nombre: '  ' }).success).toBe(false);
    expect(promoEntradaSchema.safeParse({ ...ok, areas: [], estudios: [] }).success).toBe(false);
  });
  it('descuento en $ y precio fijo aceptan montos y requieren estudios opcionales', () => {
    expect(promoEntradaSchema.safeParse({ ...ok, tipo: 'FIJO', valor: 25, areas: [], estudios: ['MAMOGRAFIA DIGITAL'], requiere: ['ECO MAMARIO'] }).success).toBe(true);
    expect(promoEntradaSchema.safeParse({ ...ok, tipo: 'USD', valor: 5.5 }).success).toBe(true);
  });
  it('monto en $ no admite 0, negativos ni más de 2 decimales; solo PCT tiene tope 100', () => {
    expect(promoEntradaSchema.safeParse({ ...ok, tipo: 'USD', valor: 0 }).success).toBe(false);
    expect(promoEntradaSchema.safeParse({ ...ok, tipo: 'FIJO', valor: 25.123 }).success).toBe(false);
    expect(promoEntradaSchema.safeParse({ ...ok, tipo: 'USD', valor: 150 }).success).toBe(true);
  });
  it('requiere sin duplicados no vacíos', () => {
    expect(promoEntradaSchema.safeParse({ ...ok, requiere: [' '] }).success).toBe(false);
  });
});
