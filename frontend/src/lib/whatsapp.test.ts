import { describe, expect, it } from 'vitest';
import { construirMensaje, normalizarTelefono } from './whatsapp';

describe('normalizarTelefono', () => {
  it('formatos venezolanos', () => {
    expect(normalizarTelefono('0414-123.4567')).toBe('584141234567');
    expect(normalizarTelefono('4141234567')).toBe('584141234567');
    expect(normalizarTelefono('+58 414 1234567')).toBe('584141234567');
  });
  it('internacional y inválidos', () => {
    expect(normalizarTelefono('+1 305 555 0100')).toBe('13055550100');
    expect(normalizarTelefono('123')).toBeNull();
    expect(normalizarTelefono('')).toBeNull();
    expect(normalizarTelefono(null)).toBeNull();
  });
});

describe('construirMensaje', () => {
  it('incluye adjunto solo si existe', () => {
    expect(construirMensaje('Ana', 'Eco', null)).not.toContain('adjunto');
    expect(construirMensaje('Ana', 'Eco', 'r.pdf')).toContain('r.pdf');
    expect(construirMensaje('Ana', 'Eco', 'r.pdf', 'https://x/resultados/t')).toContain('https://x/resultados/t');
  });
});
