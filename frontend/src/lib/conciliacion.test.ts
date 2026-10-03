import { describe, expect, it } from 'vitest';
import { repartirProporcional } from './conciliacion';

describe('repartirProporcional', () => {
  it('la suma de las partes es exactamente el total', () => {
    for (const [montos, total] of [[[100000, 100075], 2001], [[333, 333, 334], 100], [[1, 1, 1], 100], [[250000], 3750]] as [number[], number][]) {
      const partes = repartirProporcional(montos, total);
      expect(partes.reduce((a, p) => a + p, 0)).toBe(total);
      expect(partes).toHaveLength(montos.length);
    }
  });
  it('reparte en proporción a cada monto', () => {
    expect(repartirProporcional([6000, 4000], 1000)).toEqual([600, 400]);
  });
  it('maneja lista vacía y bruto cero', () => {
    expect(repartirProporcional([], 50)).toEqual([]);
    expect(repartirProporcional([0, 0], 50)).toEqual([0, 50]);
  });
});
