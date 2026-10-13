import { describe, expect, it } from 'vitest';
import { construirHojaCierre, filasExcelHojaCierre, type FacturaHoja } from './hojaCierre';

const tasa = 875.6505;
const eco: FacturaHoja = {
  fecha: '2026-10-09', cedula: 'V1', tasa, precio: 2000, honorarios: 600,
  pagos: { punto: 1751301, movil: 0, efectivoBs: 0, divisas: 0 },
  servicios: [{ area: 'ECOGRAFIA_AM', ganancia: 1400 }],
};
const gineco: FacturaHoja = {
  fecha: '2026-10-09', cedula: 'V2', tasa, precio: 5000, honorarios: 2400,
  pagos: { punto: 0, movil: 0, efectivoBs: 0, divisas: 5000 },
  servicios: [{ area: 'GINECOLOGIA', ganancia: 2600, imagen: 1200, eco: 1400 }],
};
const rx2: FacturaHoja = {
  fecha: '2026-10-11', cedula: 'V1', tasa: 876.7976, precio: 8500, honorarios: 3600,
  pagos: { punto: 0, movil: 7452780, efectivoBs: 0, divisas: 0 },
  servicios: [{ area: 'RADIOLOGIA', ganancia: 2500 }, { area: 'CONSULTAS', ganancia: 2400 }],
};

describe('construirHojaCierre', () => {
  const hoja = construirHojaCierre([eco, gineco, rx2], '2026-10-09', '2026-10-11');

  it('una fila por día del rango, incluidos los días sin actividad en cero', () => {
    expect(hoja.filas.map((f) => f.fecha)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11']);
    expect(hoja.filas[1]).toMatchObject({ pacientes: 0, ingreso: 0, cobrado: 0, honorarios: 0, gananciaTotal: 0 });
  });

  it('convierte a Bs con la tasa de cada factura, en centavos', () => {
    const d9 = hoja.filas[0];
    expect(d9.pacientes).toBe(2);
    expect(d9.ingreso).toBe(Math.round(2000 * tasa) + Math.round(5000 * tasa));
    expect(d9.punto).toBe(1751301);
    expect(d9.divisas).toBe(5000); // las divisas quedan en $
    expect(d9.cobrado).toBe(1751301 + Math.round(5000 * tasa));
    expect(d9.saldoPendiente).toBe(d9.ingreso - d9.cobrado);
  });

  it('separa la ganancia de ginecología en imagen y eco, y el cuadre da cero', () => {
    const d9 = hoja.filas[0];
    expect(d9.porArea.ECOGRAFIA_AM).toBe(Math.round(1400 * tasa));
    expect(d9.porArea.GINECO_IMAGEN).toBe(Math.round(1200 * tasa));
    expect(d9.porArea.GINECO_ECO).toBe(Math.round(1400 * tasa));
    expect(d9.cuadre).toBe(0);
    expect(hoja.filas[2].cuadre).toBe(0);
    expect(hoja.filas[2].gananciaTotal).toBe(Object.values(hoja.filas[2].porArea).reduce((a, b) => a + b, 0));
  });

  it('la ganancia clínica es lo cobrado menos los honorarios', () => {
    const d11 = hoja.filas[2];
    expect(d11.gananciaClinica).toBe(d11.cobrado - d11.honorarios);
  });

  it('el cuadre detecta facturas cuyo precio no es ganancia + honorarios', () => {
    const mala = { ...eco, honorarios: 500 };
    expect(construirHojaCierre([mala], '2026-10-09', '2026-10-09').filas[0].cuadre).toBe(Math.round(100 * tasa));
  });

  it('el total suma los días; los pacientes del total son personas únicas del rango', () => {
    const t = hoja.total;
    expect(t.ingreso).toBe(hoja.filas.reduce((a, f) => a + f.ingreso, 0));
    expect(t.honorarios).toBe(hoja.filas.reduce((a, f) => a + f.honorarios, 0));
    expect(t.porArea.CONSULTAS).toBe(hoja.filas[2].porArea.CONSULTAS);
    expect(t.pacientes).toBe(2); // V1 vino dos días: cuenta una vez
  });

  it('convierte a Bs una vez por día y tasa (como la hoja), no factura por factura', () => {
    const a = { ...eco, precio: 1 };
    const b = { ...eco, cedula: 'V9', precio: 1 };
    const f = construirHojaCierre([a, b], '2026-10-09', '2026-10-09').filas[0];
    expect(f.ingreso).toBe(Math.round(2 * tasa)); // 1751.3 → 1751, no 876 + 876
  });

  it('una ginecología sin reparto guardado cuenta todo como imagen', () => {
    const sinDist = { ...gineco, servicios: [{ area: 'GINECOLOGIA', ganancia: 2600 }] };
    const f = construirHojaCierre([sinDist], '2026-10-09', '2026-10-09').filas[0];
    expect(f.porArea.GINECO_IMAGEN).toBe(Math.round(2600 * tasa));
    expect(f.porArea.GINECO_ECO).toBe(0);
  });
});

describe('filasExcelHojaCierre', () => {
  it('devuelve una fila por día más TOTAL, con montos en unidades y columnas de la hoja', () => {
    const hoja = construirHojaCierre([eco], '2026-10-09', '2026-10-09');
    const filas = filasExcelHojaCierre(hoja);
    expect(filas).toHaveLength(2);
    expect(filas[0].FECHA).toBe('09/10/2026');
    expect(filas[0]['PUNTO (TDD)']).toBe(17513.01);
    expect(filas[0]['CUADRE (debe ser 0)']).toBe(0);
    expect(filas[1].FECHA).toBe('TOTAL');
    expect(Object.keys(filas[0])).toContain('GANANCIA GINECO. ECO');
  });
});
