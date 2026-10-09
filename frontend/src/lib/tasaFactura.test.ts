import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiHelpers';
import { decidirTasa } from './tasaFactura';

const estado = (fn: () => unknown): number => { try { fn(); return 200; } catch (e) { return e instanceof ApiError ? e.status : -1; } };

describe('decidirTasa', () => {
  it('sin tasa del cliente usa la vigente', () => {
    expect(decidirTasa({ cliente: NaN, vigente: 873.867, rol: 'cajero', manual: false })).toEqual({ tasa: 873.867, manual: false });
  });
  it('acepta la del cliente si difiere menos de 1 % (pestaña con tasa de hace unos minutos)', () => {
    expect(decidirTasa({ cliente: 873.87, vigente: 873.867, rol: 'cajero', manual: false })).toEqual({ tasa: 873.87, manual: false });
    expect(decidirTasa({ cliente: 880, vigente: 873.867, rol: 'cajero', manual: false }).tasa).toBe(880);
  });
  it('rechaza una tasa que difiere más de 1 % sin autorización', () => {
    expect(estado(() => decidirTasa({ cliente: 900, vigente: 873.867, rol: 'cajero', manual: false }))).toBe(400);
    expect(estado(() => decidirTasa({ cliente: 900, vigente: 873.867, rol: 'admin', manual: false }))).toBe(400);
  });
  it('tasa manual: solo admin', () => {
    expect(estado(() => decidirTasa({ cliente: 900, vigente: 873.867, rol: 'cajero', manual: true }))).toBe(403);
    expect(estado(() => decidirTasa({ cliente: 900, vigente: 873.867, rol: 'asistente', manual: true }))).toBe(403);
    expect(decidirTasa({ cliente: 900, vigente: 873.867, rol: 'admin', manual: true })).toEqual({ tasa: 900, manual: true });
  });
  it('tasa manual exige un valor válido', () => {
    expect(estado(() => decidirTasa({ cliente: NaN, vigente: 873.867, rol: 'admin', manual: true }))).toBe(400);
    expect(estado(() => decidirTasa({ cliente: 0, vigente: 873.867, rol: 'admin', manual: true }))).toBe(400);
    expect(estado(() => decidirTasa({ cliente: -5, vigente: 873.867, rol: 'admin', manual: true }))).toBe(400);
  });
  it('sin tasa vigente y sin autorización responde 503', () => {
    expect(estado(() => decidirTasa({ cliente: NaN, vigente: null, rol: 'cajero', manual: false }))).toBe(503);
    expect(estado(() => decidirTasa({ cliente: 873, vigente: null, rol: 'cajero', manual: false }))).toBe(503);
  });
  it('sin tasa vigente, el admin puede fijarla a mano', () => {
    expect(decidirTasa({ cliente: 873, vigente: null, rol: 'admin', manual: true })).toEqual({ tasa: 873, manual: true });
  });
});
