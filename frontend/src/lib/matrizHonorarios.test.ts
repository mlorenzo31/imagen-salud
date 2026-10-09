import { describe, expect, it } from 'vitest';
import { armarMatriz, diasDelMes, mesValido, type FilaHonorario } from './matrizHonorarios';

describe('diasDelMes / mesValido', () => {
  it('cuenta los días del mes', () => {
    expect(diasDelMes('2026-10')).toBe(31);
    expect(diasDelMes('2026-02')).toBe(28);
    expect(diasDelMes('2028-02')).toBe(29);
    expect(diasDelMes('2026-04')).toBe(30);
  });
  it('valida el formato AAAA-MM', () => {
    expect(mesValido('2026-10')).toBe(true);
    expect(mesValido('2026-13')).toBe(false);
    expect(mesValido('2026-1')).toBe(false);
    expect(mesValido('26-10')).toBe(false);
  });
});

const f = (medico: string, dia: string, generado: number, pagado = 0): FilaHonorario => ({ medico, dia, generado, pagado });

describe('armarMatriz', () => {
  const filas = [
    f('DRA. SILVIA', '2026-10-01', 600, 600),
    f('DRA. SILVIA', '2026-10-01', 600),
    f('DRA. SILVIA', '2026-10-05', 600),
    f('ROSA VALDIVIESO', '2026-10-06', 1200),
    f('DRA. CARMEN', '2026-10-03', 300),
  ];
  const m = armarMatriz(filas, '2026-10');
  it('una columna por día del mes', () => {
    expect(m.dias).toHaveLength(31);
    expect(m.dias[0]).toBe(1);
  });
  it('suma por doctor y día sin perder centavos', () => {
    const s = m.medicos.find((x) => x.medico === 'DRA. SILVIA');
    expect(s?.generado[0]).toBe(1200);
    expect(s?.generado[4]).toBe(600);
    expect(s?.pagado[0]).toBe(600);
    expect(s?.pendiente[0]).toBe(600);
    expect(s?.totales).toEqual({ generado: 1800, pagado: 600, pendiente: 1200 });
  });
  it('totales por día y total general', () => {
    expect(m.totalesDia.generado[0]).toBe(1200);
    expect(m.totalesDia.generado[5]).toBe(1200);
    expect(m.total).toEqual({ generado: 3300, pagado: 600, pendiente: 2700 });
  });
  it('ordena doctores por lo generado, de mayor a menor', () => {
    expect(m.medicos.map((x) => x.medico)).toEqual(['DRA. SILVIA', 'ROSA VALDIVIESO', 'DRA. CARMEN']);
  });
  it('ignora filas fuera del mes y devuelve vacío sin datos', () => {
    expect(armarMatriz([f('X', '2026-09-30', 500)], '2026-10').total.generado).toBe(0);
    expect(armarMatriz([], '2026-10').medicos).toEqual([]);
  });
  it('unifica el nombre del doctor sin distinguir mayúsculas', () => {
    const r = armarMatriz([f('Dra. Silvia', '2026-10-02', 100), f('DRA. SILVIA', '2026-10-02', 200)], '2026-10');
    expect(r.medicos).toHaveLength(1);
    expect(r.medicos[0].generado[1]).toBe(300);
  });
});
