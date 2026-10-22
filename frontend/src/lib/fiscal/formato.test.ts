import { describe, expect, it } from 'vitest';
import { esNumeroControl, fechaFiscal, horaFiscal, marcarExento, numeroControl } from './formato';

describe('fechaFiscal (art. 8.5: DDMMAAAA)', () => {
  it('convierte ISO a 8 dígitos día-mes-año, separados', () => {
    expect(fechaFiscal('2026-10-15')).toBe('15/10/2026');
    expect(fechaFiscal('2027-01-05')).toBe('05/01/2027');
  });
  it('permite pedirla sin separador', () => {
    expect(fechaFiscal('2026-10-15', '')).toBe('15102026');
  });
  it('rechaza fechas inválidas', () => {
    expect(() => fechaFiscal('2026-02-30')).toThrow();
    expect(() => fechaFiscal('15/10/2026')).toThrow();
  });
});

describe('horaFiscal (art. 8.5: HH.MM.SS con a.m./p.m.)', () => {
  it('mañana', () => expect(horaFiscal('10:24:18')).toBe('10.24.18 a.m.'));
  it('tarde', () => expect(horaFiscal('14:04:07')).toBe('02.04.07 p.m.'));
  it('medianoche y mediodía', () => {
    expect(horaFiscal('00:05:00')).toBe('12.05.00 a.m.');
    expect(horaFiscal('12:00:00')).toBe('12.00.00 p.m.');
  });
  it('acepta HH:MM y completa segundos', () => expect(horaFiscal('09:30')).toBe('09.30.00 a.m.'));
  it('rechaza horas inválidas', () => {
    expect(() => horaFiscal('25:00:00')).toThrow();
    expect(() => horaFiscal('10:61:00')).toThrow();
  });
});

describe('numeroControl (art. 9.1: identificador de 2 dígitos + secuencial de hasta 8)', () => {
  it('la primera asignación es 00-00000001', () => expect(numeroControl(0, 1)).toBe('00-00000001'));
  it('rellena con ceros', () => expect(numeroControl(3, 15344016)).toBe('03-15344016'));
  it('rechaza valores fuera de rango', () => {
    expect(() => numeroControl(100, 1)).toThrow();
    expect(() => numeroControl(0, 0)).toThrow();
    expect(() => numeroControl(0, 100_000_000)).toThrow();
    expect(() => numeroControl(0, 1.5)).toThrow();
  });
  it('valida el formato', () => {
    expect(esNumeroControl('00-00000365')).toBe(true);
    expect(esNumeroControl('00-0365')).toBe(false);
    expect(esNumeroControl('0000000365')).toBe(false);
    expect(esNumeroControl('00-00000000')).toBe(false);
  });
});

describe('marcarExento (art. 8.7: "(E)" separado por un espacio)', () => {
  it('agrega la marca', () => expect(marcarExento('Ecografía mamaria')).toBe('Ecografía mamaria (E)'));
  it('no la duplica', () => expect(marcarExento('Tórax PA (E)')).toBe('Tórax PA (E)'));
});
