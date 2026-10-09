import { describe, expect, it } from 'vitest';
import { agruparResumen, rangoValido, type FilaServicio } from './resumenPeriodo';

const f = (area: string, estudio: string, medico: string, lista: number, cobrado: number, honorarios: number): FilaServicio =>
  ({ area, estudio, medico, lista, cobrado, honorarios, ganancia: cobrado - honorarios });

const filas: FilaServicio[] = [
  f('ECOGRAFIA_AM', 'ABDOMINAL', 'DRA. SILVIA', 2000, 2000, 600),
  f('ECOGRAFIA_AM', 'ABDOMINAL', 'DRA. SILVIA', 2000, 1500, 600),
  f('ECOGRAFIA_AM', 'RENAL', 'DRA. SILVIA', 2000, 2000, 600),
  f('RADIOLOGIA', 'TÓRAX PA (1 PROYECCIÓN)', 'TÉCNICO RADIOLOGÍA', 2500, 2500, 0),
];

describe('agruparResumen', () => {
  const r = agruparResumen(filas, 8000);
  it('agrupa por área y estudio con cantidades y sumas exactas', () => {
    const eco = r.porArea.find((a) => a.area === 'ECOGRAFIA_AM');
    expect(eco).toMatchObject({ cantidad: 3, lista: 6000, descuento: 500, cobrado: 5500, honorarios: 1800, ganancia: 3700 });
    expect(eco?.estudios.find((e) => e.estudio === 'ABDOMINAL')).toMatchObject({ cantidad: 2, descuento: 500, cobrado: 3500 });
  });
  it('agrupa por doctor', () => {
    expect(r.porDoctor.find((d) => d.medico === 'DRA. SILVIA')).toMatchObject({ cantidad: 3, cobrado: 5500, honorarios: 1800, ganancia: 3700 });
  });
  it('totales y cuadre contra lo facturado', () => {
    expect(r.total).toMatchObject({ cantidad: 4, lista: 8500, descuento: 500, cobrado: 8000, honorarios: 1800, ganancia: 6200 });
    expect(r.cuadra).toBe(true);
    expect(agruparResumen(filas, 7999).cuadra).toBe(false);
  });
  it('ordena por cobrado descendente', () => {
    expect(r.porArea.map((a) => a.area)).toEqual(['ECOGRAFIA_AM', 'RADIOLOGIA']);
  });
  it('sin filas devuelve ceros y cuadra con cero', () => {
    const v = agruparResumen([], 0);
    expect(v.total.cobrado).toBe(0);
    expect(v.cuadra).toBe(true);
  });
});

describe('rangoValido', () => {
  it('acepta rangos ordenados de hasta 366 días', () => {
    expect(rangoValido('2026-10-01', '2026-10-07')).toBeNull();
    expect(rangoValido('2026-10-07', '2026-10-07')).toBeNull();
  });
  it('rechaza formato, orden invertido y rangos largos', () => {
    expect(rangoValido('2026-10-08', '2026-10-07')).toMatch(/posterior/);
    expect(rangoValido('01/10/2026', '2026-10-07')).toMatch(/inválida/);
    expect(rangoValido('2025-01-01', '2026-10-07')).toMatch(/366/);
  });
});
