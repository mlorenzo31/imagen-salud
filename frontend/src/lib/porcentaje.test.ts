import { describe, expect, it } from 'vitest';
import { leerPorcentaje } from './porcentaje';

describe('leerPorcentaje', () => {
  it('acepta porcentajes exactos', () => {
    expect(leerPorcentaje(70)).toBe('70');
    expect(leerPorcentaje('62.5')).toBe('62.5');
    expect(leerPorcentaje('62,25')).toBe('62.25');
    expect(leerPorcentaje(0)).toBe('0');
    expect(leerPorcentaje(100)).toBe('100');
  });
  it('rechaza valores inválidos', () => {
    for (const v of ['abc', '', -5, 150, '100.01', '10.123', undefined, null]) {
      expect(() => leerPorcentaje(v)).toThrow();
    }
  });
});
