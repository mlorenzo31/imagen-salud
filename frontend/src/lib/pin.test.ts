import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { exigirPinSesion } from './pin';

const req = (rol: string, user = 'u') =>
  new NextRequest('http://x/api/cierres/ejecutar-cierre', { headers: { 'x-session-role': rol, 'x-session-user': user } });

describe('exigirPinSesion', () => {
  afterEach(() => { delete process.env.AUTH_PIN_ADMIN; });

  it('acepta la clave del rol y rechaza otra', () => {
    process.env.AUTH_PIN_ADMIN = '1234';
    expect(() => exigirPinSesion(req('admin', 'a'), '1234')).not.toThrow();
    expect(() => exigirPinSesion(req('admin', 'a'), '9999')).toThrow('Clave incorrecta');
    expect(() => exigirPinSesion(req('admin', 'a'), undefined)).toThrow('Clave incorrecta');
  });

  it('bloquea tras 5 fallos', () => {
    process.env.AUTH_PIN_ADMIN = '1234';
    for (let i = 0; i < 5; i++) expect(() => exigirPinSesion(req('admin', 'b'), 'x')).toThrow();
    expect(() => exigirPinSesion(req('admin', 'b'), '1234')).toThrow('Demasiados intentos');
  });
});
