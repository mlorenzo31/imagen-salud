import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn() } }));

import pool from '@/lib/db';

const respuesta = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

describe('obtenerTasaBcv', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(pool.query).mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('usa el proveedor principal', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respuesta({ promedio: 36.5 })));
    const { obtenerTasaBcv } = await import('./tasaBcv');
    expect(await obtenerTasaBcv()).toMatchObject({ tasa: 36.5, exito: true });
  });

  it('cae al proveedor de respaldo', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      url.includes('dolarapi') ? Promise.reject(new Error('caído')) : respuesta({ monitors: { usd: { price: 37.1 } } })));
    const { obtenerTasaBcv } = await import('./tasaBcv');
    expect(await obtenerTasaBcv()).toMatchObject({ tasa: 37.1, exito: true });
  });

  it('con ambos caídos usa la última tasa facturada (sin intervención humana)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin red'))));
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ tasa_bcv: '36.40', fecha: '2026-10-02' }] } as never);
    const { obtenerTasaBcv } = await import('./tasaBcv');
    expect(await obtenerTasaBcv()).toMatchObject({ tasa: 36.4, exito: false, desactualizada: true });
  });

  it('sin proveedores ni historial devuelve null (nunca inventa una tasa)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin red'))));
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    const { obtenerTasaBcv } = await import('./tasaBcv');
    expect(await obtenerTasaBcv()).toBeNull();
  });

  it('rechaza valores no positivos del proveedor', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respuesta({ promedio: 0, monitors: { usd: { price: -1 } } })));
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    const { obtenerTasaBcv } = await import('./tasaBcv');
    expect(await obtenerTasaBcv()).toBeNull();
  });
});
