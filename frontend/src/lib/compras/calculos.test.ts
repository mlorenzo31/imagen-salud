import { describe, expect, it } from 'vitest';
import { calcularTotales, normalizarRif, subtotalLinea, validarRif, type ConfigFiscal } from './calculos';

const apagado: ConfigFiscal = { retencionesActivas: false, ivaRetenidoPct: 75, islr: [], alicuotas: [16, 8, 0] };
const activo: ConfigFiscal = { ...apagado, retencionesActivas: true, islr: [{ concepto: 'SERVICIOS', tipoPersona: 'JURIDICA', pct: 2, sustraendo: 0 }] };
const lineas = [
  { cantidad: 1000, precio: 6000, alicuota: 16 },
  { cantidad: 2000, precio: 2000, alicuota: 16 },
  { cantidad: 1000, precio: 5000, alicuota: 0 },
  { cantidad: 1000, precio: 2000, alicuota: 8 },
];
const ordinario = { contribuyenteEspecial: false, tipoPersona: 'JURIDICA' as const };

describe('subtotalLinea', () => {
  it('cantidad en milésimas × precio en centavos', () => {
    expect(subtotalLinea({ cantidad: 2500, precio: 1000, alicuota: 16 })).toBe(2500);
  });
});

describe('calcularTotales', () => {
  it('agrupa por alícuota, separa lo exento y suma el total', () => {
    const t = calcularTotales(lineas, apagado, ordinario);
    expect(t.porAlicuota).toEqual([{ alicuota: 16, base: 10000, iva: 1600 }, { alicuota: 8, base: 2000, iva: 160 }]);
    expect(t.exento).toBe(5000);
    expect(t.totalBase).toBe(12000);
    expect(t.totalIva).toBe(1760);
    expect(t.total).toBe(18760);
  });
  it('con retenciones apagadas no retiene nada', () => {
    const t = calcularTotales(lineas, apagado, ordinario);
    expect([t.ivaRetenido, t.islrRetenido, t.netoAPagar]).toEqual([0, 0, t.total]);
  });
  it('con retenciones activas retiene IVA al 75 % o 100 % y el ISLR según la tabla', () => {
    const t = calcularTotales(lineas, activo, { ...ordinario, conceptoIslr: 'SERVICIOS' });
    expect(t.ivaRetenido).toBe(1320);
    expect(t.islrRetenido).toBe(240);
    expect(t.netoAPagar).toBe(18760 - 1320 - 240);
    expect(calcularTotales(lineas, { ...activo, ivaRetenidoPct: 100 }, ordinario).ivaRetenido).toBe(1760);
  });
  it('el ISLR nunca es negativo (sustraendo mayor que la retención)', () => {
    const cfg = { ...activo, islr: [{ concepto: 'SERVICIOS', tipoPersona: 'JURIDICA' as const, pct: 2, sustraendo: 99999 }] };
    expect(calcularTotales(lineas, cfg, { ...ordinario, conceptoIslr: 'SERVICIOS' }).islrRetenido).toBe(0);
  });
  it('rechaza alícuotas que no están vigentes en la configuración', () => {
    expect(() => calcularTotales([{ cantidad: 1000, precio: 100, alicuota: 12 }], apagado, ordinario)).toThrow(/alícuota/);
  });
});

describe('RIF', () => {
  it('valida y normaliza', () => {
    expect(validarRif('j123456789')).toBeNull();
    expect(normalizarRif('j123456789')).toBe('J-12345678-9');
    expect(normalizarRif('V-1234567-0')).toBe('V-01234567-0');
    expect(validarRif('X-1')).toMatch(/RIF/);
  });
});
