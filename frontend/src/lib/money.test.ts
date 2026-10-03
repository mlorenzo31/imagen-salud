import { describe, expect, it } from 'vitest';
import { centsToNumber, centsToStr, mulRate, toCents } from './money';

describe('toCents', () => {
  it('evita errores binarios de punto flotante', () => {
    expect(toCents('0.1') + toCents('0.2')).toBe(30);
    expect(toCents(19.99)).toBe(1999);
  });
  it('redondea half-up a 2 decimales', () => {
    expect(toCents('1.005')).toBe(101);
    expect(toCents(1.005)).toBe(101);
    expect(toCents('1.004')).toBe(100);
    expect(toCents('-12.345')).toBe(-1235);
  });
  it('acepta coma decimal, vacío y notación científica', () => {
    expect(toCents('12,50')).toBe(1250);
    expect(toCents('')).toBe(0);
    expect(toCents(null)).toBe(0);
    expect(toCents('1e3')).toBe(100000);
  });
  it('rechaza valores no numéricos', () => {
    expect(() => toCents('abc')).toThrow();
    expect(() => toCents(NaN)).toThrow();
  });
});

describe('centsToStr / centsToNumber', () => {
  it('formatea sin pasar por float', () => {
    expect(centsToStr(123456)).toBe('1234.56');
    expect(centsToStr(5)).toBe('0.05');
    expect(centsToStr(-5)).toBe('-0.05');
    expect(centsToStr(0)).toBe('0.00');
    expect(centsToNumber(149_40)).toBe(149.4);
  });
});

describe('mulRate', () => {
  it('multiplica por tasa con redondeo half-up', () => {
    expect(mulRate(10000, '36.5')).toBe(365000);
    expect(mulRate(1, '0.5')).toBe(1);
    expect(mulRate(1, '0.4')).toBe(0);
  });
  it('rechaza tasas inválidas', () => {
    expect(() => mulRate(100, 0)).toThrow();
    expect(() => mulRate(100, 'x')).toThrow();
  });
});
