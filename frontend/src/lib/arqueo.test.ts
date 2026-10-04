import { describe, expect, it } from 'vitest';
import { calcularArqueo, leerConteo } from '@/lib/cierre';

describe('arqueo de cierre', () => {
  it('calcula sobrante (+) y faltante (-) por método', () => {
    const l = calcularArqueo({ divisas_usd: 10000, punto_bs: 5000 }, { divisas_usd: 9500, punto_bs: 5000, efectivo_bs: 100 });
    expect(l.find((x) => x.metodo === 'divisas_usd')?.diferencia).toBe(-500);
    expect(l.find((x) => x.metodo === 'punto_bs')?.diferencia).toBe(0);
    expect(l.find((x) => x.metodo === 'efectivo_bs')?.diferencia).toBe(100);
  });
  it('exige todos los montos (0 es válido) y rechaza inválidos', () => {
    const ok = { divisas_usd: '0', efectivo_bs: '12.5', punto_bs: '3', pago_movil_bs: '0.10' };
    expect(leerConteo(ok)).toEqual({ divisas_usd: 0, efectivo_bs: 1250, punto_bs: 300, pago_movil_bs: 10 });
    expect(() => leerConteo({ ...ok, punto_bs: '' })).toThrow();
    expect(() => leerConteo({ ...ok, punto_bs: '-1' })).toThrow();
    expect(() => leerConteo(undefined)).toThrow();
  });
});
