import { beforeAll, describe, expect, it } from 'vitest';
import { codigoCoincide, generarCodigo, hashClave, hashCodigo, validarPoliticaClave, verificarClave } from './clave';

beforeAll(() => { process.env.AUTH_SECRET = 'x'.repeat(48); });

describe('clave', () => {
  it('hashea y verifica sin guardar en claro', () => {
    const h = hashClave('Secreta123');
    expect(h).not.toContain('Secreta123');
    expect(verificarClave('Secreta123', h)).toBe(true);
    expect(verificarClave('secreta123', h)).toBe(false);
    expect(hashClave('Secreta123')).not.toBe(h); // sal distinta
    expect(verificarClave('x', 'basura')).toBe(false);
  });
  it('aplica la política de clave', () => {
    expect(validarPoliticaClave('corta1')).toMatch(/al menos/);
    expect(validarPoliticaClave('soloLetrasAqui')).toMatch(/letras y números/);
    expect(validarPoliticaClave('Segura2026')).toBeNull();
  });
  it('genera códigos de 6 dígitos y los compara por usuario', () => {
    const c = generarCodigo();
    expect(c).toMatch(/^\d{6}$/);
    const h = hashCodigo(c, 7);
    expect(codigoCoincide(c, 7, h)).toBe(true);
    expect(codigoCoincide(c, 8, h)).toBe(false);
    expect(codigoCoincide('000000' === c ? '111111' : '000000', 7, h)).toBe(false);
  });
});
