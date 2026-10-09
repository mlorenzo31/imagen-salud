import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiHelpers';
import { hashClave } from './clave';
import { exigirAutorizacionDescuento } from './autorizacionDescuento';
import type { UsuarioFila } from './usuariosDb';
import type { UserRole } from '@/types';

const cuenta = (usuario: string, rol: UserRole, clave: string, activo = true): UsuarioFila => ({
  id: 1, usuario, nombre: usuario, rol, password_hash: hashClave(clave), telefono: null, email: null,
  activo, intentos_fallidos: 0, bloqueado_hasta: null,
});
const buscarEn = (c: UsuarioFila | null) => async () => c;
const estado = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof ApiError ? e.status : -1; } };

describe('exigirAutorizacionDescuento', () => {
  it('cajero dentro del tope no necesita autorizador', async () => {
    expect(await exigirAutorizacionDescuento({ rol: 'cajero', porcentajeBp: 2000 })).toBeNull();
  });
  it('cajero sobre el tope sin autorizador → 403', async () => {
    expect(await estado(exigirAutorizacionDescuento({ rol: 'cajero', porcentajeBp: 2001 }))).toBe(403);
  });
  it('autorizador admin válido autoriza', async () => {
    const r = await exigirAutorizacionDescuento({
      rol: 'cajero', porcentajeBp: 3000, autorizador: { usuario: 'jefe', clave: 'Clave1234' }, buscar: buscarEn(cuenta('jefe', 'admin', 'Clave1234')),
    });
    expect(r).toBe('jefe');
  });
  it('autorizador asistente válido autoriza', async () => {
    const r = await exigirAutorizacionDescuento({
      rol: 'cajero', porcentajeBp: 3000, autorizador: { usuario: 'asis', clave: 'Clave1234' }, buscar: buscarEn(cuenta('asis', 'asistente', 'Clave1234')),
    });
    expect(r).toBe('asis');
  });
  it('autorizador con rol cajero → 403', async () => {
    expect(await estado(exigirAutorizacionDescuento({
      rol: 'cajero', porcentajeBp: 3000, autorizador: { usuario: 'otro', clave: 'Clave1234' }, buscar: buscarEn(cuenta('otro', 'cajero', 'Clave1234')),
    }))).toBe(403);
  });
  it('clave incorrecta, usuario inexistente o inactivo → 401', async () => {
    const a = { usuario: 'jefe2', clave: 'mala' };
    expect(await estado(exigirAutorizacionDescuento({ rol: 'cajero', porcentajeBp: 3000, autorizador: a, buscar: buscarEn(cuenta('jefe2', 'admin', 'Clave1234')) }))).toBe(401);
    expect(await estado(exigirAutorizacionDescuento({ rol: 'cajero', porcentajeBp: 3000, autorizador: { usuario: 'nadie', clave: 'x' }, buscar: buscarEn(null) }))).toBe(401);
    expect(await estado(exigirAutorizacionDescuento({ rol: 'cajero', porcentajeBp: 3000, autorizador: { usuario: 'baja', clave: 'Clave1234' }, buscar: buscarEn(cuenta('baja', 'admin', 'Clave1234', false)) }))).toBe(401);
  });
  it('admin y asistente no tienen tope', async () => {
    expect(await exigirAutorizacionDescuento({ rol: 'admin', porcentajeBp: 5000 })).toBeNull();
    expect(await exigirAutorizacionDescuento({ rol: 'asistente', porcentajeBp: 5000 })).toBeNull();
  });
  it('5 fallos seguidos bloquean al autorizador → 429', async () => {
    const args = { rol: 'cajero', porcentajeBp: 3000, autorizador: { usuario: 'bloqueado', clave: 'mala' }, buscar: buscarEn(cuenta('bloqueado', 'admin', 'Clave1234')) };
    for (let i = 0; i < 5; i++) expect(await estado(exigirAutorizacionDescuento(args))).toBe(401);
    expect(await estado(exigirAutorizacionDescuento(args))).toBe(429);
  });
});
