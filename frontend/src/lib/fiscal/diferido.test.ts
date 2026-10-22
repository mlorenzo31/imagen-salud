import { describe, expect, it } from 'vitest';
import { MOTIVOS_DIFERIDO, diferirSchema, fechaLimite } from './diferido';

describe('fechaLimite: hasta cuándo puede quedar un cobro sin factura', () => {
  it('anticipo: 30 días para prestar el servicio y facturarlo', () => {
    expect(fechaLimite('ANTICIPO', '2026-10-22')).toBe('2026-11-21');
  });
  it('aseguradora/empresa: dentro del mismo período de imposición (fin de mes)', () => {
    expect(fechaLimite('ASEGURADORA', '2026-10-22')).toBe('2026-10-31');
    expect(fechaLimite('ASEGURADORA', '2027-02-03')).toBe('2027-02-28');
    expect(fechaLimite('ASEGURADORA', '2028-02-29')).toBe('2028-02-29');
  });
  it('datos de la empresa: 2 días para completarlos', () => {
    expect(fechaLimite('DATOS_EMPRESA', '2026-12-31')).toBe('2027-01-02');
  });
  it('rechaza fechas inválidas', () => {
    expect(() => fechaLimite('ANTICIPO', '22/10/2026')).toThrow();
  });
});

describe('diferirSchema', () => {
  it('solo admite los motivos de la lista y exige clave', () => {
    expect(diferirSchema.parse({ motivo: 'ANTICIPO', pin: '1234' })).toEqual({ motivo: 'ANTICIPO', pin: '1234' });
    expect(() => diferirSchema.parse({ motivo: 'NO_QUIERO', pin: '1234' })).toThrow();
    expect(() => diferirSchema.parse({ motivo: 'ANTICIPO', pin: '' })).toThrow();
  });
  it('cada motivo tiene una etiqueta para la caja', () => {
    expect(Object.keys(MOTIVOS_DIFERIDO)).toEqual(['ANTICIPO', 'ASEGURADORA', 'DATOS_EMPRESA']);
    for (const m of Object.values(MOTIVOS_DIFERIDO)) expect(m.etiqueta.length).toBeGreaterThan(10);
  });
});
