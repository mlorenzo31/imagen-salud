import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { exigirPinSesion } from './pin';
import { hashClave } from './clave';
import type { UsuarioFila } from './usuariosDb';

const req = (uid: number) =>
  new NextRequest('http://x/api/cierres/ejecutar-cierre', { headers: { 'x-session-uid': String(uid), 'x-session-role': 'admin' } });

const usuario = (id: number, clave: string, activo = true): UsuarioFila => ({
  id, usuario: 'u' + id, nombre: 'U', rol: 'admin', password_hash: hashClave(clave), telefono: null, email: null,
  activo, intentos_fallidos: 0, bloqueado_hasta: null,
});

describe('exigirPinSesion', () => {
  it('acepta la clave del usuario y rechaza otra', async () => {
    const buscar = async () => usuario(1, 'Clave1234');
    await expect(exigirPinSesion(req(1), 'Clave1234', buscar)).resolves.toBeUndefined();
    await expect(exigirPinSesion(req(1), 'otra', buscar)).rejects.toThrow('Clave incorrecta');
    await expect(exigirPinSesion(req(1), undefined, buscar)).rejects.toThrow('Clave incorrecta');
  });

  it('rechaza usuario inexistente o desactivado', async () => {
    await expect(exigirPinSesion(req(2), 'x', async () => null)).rejects.toThrow('Sesión no válida');
    await expect(exigirPinSesion(req(3), 'Clave1234', async () => usuario(3, 'Clave1234', false))).rejects.toThrow('Sesión no válida');
  });

  it('bloquea tras 5 fallos', async () => {
    const buscar = async () => usuario(4, 'Clave1234');
    for (let i = 0; i < 5; i++) await expect(exigirPinSesion(req(4), 'x', buscar)).rejects.toThrow();
    await expect(exigirPinSesion(req(4), 'Clave1234', buscar)).rejects.toThrow('Demasiados intentos');
  });
});
