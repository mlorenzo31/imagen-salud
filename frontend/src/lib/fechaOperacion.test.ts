import { describe, expect, it } from 'vitest';
import { resolverFechaOperacion } from './fechaOperacion';
import { fechaHoraLocal } from './apiHelpers';
import { sumarDias } from './date';

const hoy = fechaHoraLocal().fecha;
const ayer = sumarDias(hoy, -1);
const antier = sumarDias(hoy, -2);

/** BD simulada: `ayer` tiene cierre consolidado. */
const db = {
  query: async (sql: string) => {
    if (sql.includes('information_schema')) return { rows: [{ column_name: 'fecha_cierre' }, { column_name: 'consolidado' }] };
    return { rows: [{ f: ayer }] };
  },
} as unknown as Parameters<typeof resolverFechaOperacion>[2];

describe('fecha de operación retroactiva', () => {
  it('sin fecha o con la de hoy: hoy, sin nota', async () => {
    expect(await resolverFechaOperacion({}, false, db)).toMatchObject({ fecha: hoy, retroactiva: false, nota: '' });
    expect(await resolverFechaOperacion({ fecha: hoy }, false, db)).toMatchObject({ fecha: hoy, retroactiva: false });
  });

  it('rechaza fechas futuras', async () => {
    await expect(resolverFechaOperacion({ fecha: sumarDias(hoy, 1), motivo_retroactivo: 'x y z' }, true, db)).rejects.toMatchObject({ status: 400 });
  });

  it('día anterior exige motivo', async () => {
    await expect(resolverFechaOperacion({ fecha: antier }, false, db)).rejects.toMatchObject({ status: 400 });
  });

  it('día anterior abierto: lo permite a cualquier rol y deja nota', async () => {
    const r = await resolverFechaOperacion({ fecha: antier, motivo_retroactivo: 'se olvidó registrar' }, false, db);
    expect(r).toMatchObject({ fecha: antier, retroactiva: true });
    expect(r.nota).toContain(antier);
  });

  it('día cerrado: solo administrador', async () => {
    await expect(resolverFechaOperacion({ fecha: ayer, motivo_retroactivo: 'se olvidó registrar' }, false, db)).rejects.toMatchObject({ status: 403 });
    expect((await resolverFechaOperacion({ fecha: ayer, motivo_retroactivo: 'se olvidó registrar' }, true, db)).fecha).toBe(ayer);
  });
});

describe('cierre ya cerrado: marcarCierreModificado', () => {
  it('actualiza totales de egresos/ingresos y deja constancia', async () => {
    const { marcarCierreModificado } = await import('./cierre');
    const calls: { sql: string; params?: unknown[] }[] = [];
    const client = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (sql.includes('information_schema')) return { rows: ['fecha_cierre', 'observaciones', 'total_egresos_bs', 'total_egresos_usd', 'total_ingresos_extra_bs', 'total_ingresos_extra_usd'].map((column_name) => ({ column_name })) };
        if (sql.includes('FROM cierres_diarios')) return { rows: [{ id: 7 }] };
        if (sql.includes('egresos_operativos')) return { rows: [{ moneda: 'BS', t: '150.25' }] };
        return { rows: [] };
      },
    } as unknown as Parameters<typeof marcarCierreModificado>[0];
    await marcarCierreModificado(client, antier, 'se olvidó', 'Admin');
    const upd = calls.find((c) => c.sql.startsWith('UPDATE cierres_diarios'))!;
    expect(upd.params?.slice(0, 4)).toEqual(['150.25', '0.00', '0.00', '0.00']);
    expect(String(upd.params?.[4])).toContain('se olvidó');
    expect(upd.params?.[5]).toBe(7);
  });
});
