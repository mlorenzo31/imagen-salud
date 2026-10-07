import { describe, expect, it } from 'vitest';
import { inferirSexo } from './sexo';

describe('inferirSexo', () => {
  it('usa el primer nombre', () => {
    expect(inferirSexo('MARIA ROSAS')).toBe('F');
    expect(inferirSexo('Carlos Martínez')).toBe('M');
    expect(inferirSexo('JESUS CARRASQUEL')).toBe('M');
  });
  it('infiere por terminación los nombres no listados', () => {
    expect(inferirSexo('YAMILETH PEREZ')).toBeNull();
    expect(inferirSexo('JOSELIA PEREZ')).toBe('F');
    expect(inferirSexo('ARQUIMEDO PEREZ')).toBe('M');
  });
  it('deja sin determinar los ambiguos y vacíos', () => {
    expect(inferirSexo('ALEXIS HERNANDEZ')).toBeNull();
    expect(inferirSexo('')).toBeNull();
  });
});
