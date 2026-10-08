import { beforeAll, describe, expect, it } from 'vitest';
import { isAllowed, signSession, verifySession } from './auth';

beforeAll(() => {
  process.env.AUTH_SECRET = 'x'.repeat(48);
});

describe('sesión firmada', () => {
  it('firma y verifica', async () => {
    const token = await signSession({ uid: 1, role: 'admin', nombre: 'A', modo: 'operador' });
    const s = await verifySession(token);
    expect(s?.role).toBe('admin');
  });
  it('rechaza token manipulado, malformado o ausente', async () => {
    const token = await signSession({ uid: 1, role: 'cajero', nombre: 'C', modo: 'operador' });
    const [body, sig] = token.split('.');
    const falso = btoa(JSON.stringify({ uid: 1, role: 'admin', nombre: 'C', modo: 'operador', exp: 9999999999 })).replace(/=+$/, '');
    expect(await verifySession(`${falso}.${sig}`)).toBeNull();
    expect(await verifySession(`${body}.AAAA`)).toBeNull();
    expect(await verifySession('basura')).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
  it('rechaza sesión expirada', async () => {
    const vieja = Date.now;
    Date.now = () => vieja() - 13 * 3600 * 1000;
    const token = await signSession({ uid: 1, role: 'admin', nombre: 'A', modo: 'operador' });
    Date.now = vieja;
    expect(await verifySession(token)).toBeNull();
  });
});

describe('RBAC por ruta', () => {
  it('admin accede a todo', () => {
    expect(isAllowed('admin', '/api/tesoreria/cambio-divisa', 'POST')).toBe(true);
  });
  it('cajero solo accede a facturación y datos de paciente', () => {
    expect(isAllowed('cajero', '/api/facturas', 'POST')).toBe(true);
    expect(isAllowed('cajero', '/api/facturas/5/estado', 'PUT')).toBe(true);
    expect(isAllowed('cajero', '/api/tesoreria/cuentas', 'GET')).toBe(false);
    expect(isAllowed('cajero', '/api/tesoreria/cambio-divisa', 'POST')).toBe(false);
    expect(isAllowed('cajero', '/api/cierres/ejecutar-cierre', 'POST')).toBe(true);
    expect(isAllowed('asistente', '/api/cierres/ejecutar-cierre', 'POST')).toBe(true);
    expect(isAllowed('asistente', '/api/bitacora', 'GET')).toBe(false);
    expect(isAllowed('admin', '/api/cierres/reabrir', 'POST')).toBe(true);
    expect(isAllowed('asistente', '/api/cierres/reabrir', 'POST')).toBe(false);
    expect(isAllowed('cajero', '/api/cierres/reabrir', 'POST')).toBe(false);
    expect(isAllowed('cajero', '/api/bitacora', 'GET')).toBe(false);
    expect(isAllowed('admin', '/api/bitacora', 'GET')).toBe(true);
  });
  it('asistente lee tesorería pero no escribe ni liquida', () => {
    expect(isAllowed('asistente', '/api/tesoreria/cuentas', 'GET')).toBe(true);
    expect(isAllowed('asistente', '/api/tesoreria/egresos-operativos', 'POST')).toBe(false);
    expect(isAllowed('asistente', '/api/tesoreria/honorarios/liquidar', 'POST')).toBe(false);
    expect(isAllowed('asistente', '/api/tesoreria/conciliacion/ejecutar', 'POST')).toBe(false);
    expect(isAllowed('asistente', '/api/admin/catalogos', 'GET')).toBe(false);
  });
  it('no se salta el prefijo con rutas parecidas', () => {
    expect(isAllowed('cajero', '/api/facturas-secretas', 'GET')).toBe(false);
  });
});
