import { describe, expect, it } from 'vitest';
import { ESPECIALISTAS_MEDICOS, ESTUDIOS_CLINICOS } from './catalogos';
import { toCents } from './money';
import { gananciaCents, honorariosCents, type RepartoCents } from './reparto';
import { FILAS_HOJA, TOTALES_HOJA } from './hojaOctubre.fixture';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Reparto en centavos que usa el sistema para una atención de la hoja. */
function repartoDeFila(f: (typeof FILAS_HOJA)[number]): RepartoCents {
  if (f.area === 'CONSULTAS') {
    const esp = ESPECIALISTAS_MEDICOS.CONSULTAS.find((e) => norm(e.nombre) === norm(f.medico));
    if (!esp?.precio || !esp.pctMedico) throw new Error(`Consulta sin tarifa: ${f.medico}`);
    const precio = toCents(esp.precio);
    const medico = toCents(esp.precio * esp.pctMedico);
    return { precio, imagen: precio - medico, medico, eco: 0, patologo: 0 };
  }
  const e = ESTUDIOS_CLINICOS[f.area]?.find((x) => norm(x.nombre) === norm(f.estudio));
  if (!e) throw new Error(`Estudio fuera del catálogo: ${f.area} / ${f.estudio}`);
  return { precio: toCents(e.precio), imagen: toCents(e.dist.imagen), medico: toCents(e.dist.medico), eco: toCents(e.dist.eco), patologo: toCents(e.dist.patologo) };
}

describe('catálogo del sistema vs hoja validada', () => {
  it('cada estudio reparte exactamente su precio', () => {
    for (const [area, lista] of Object.entries(ESTUDIOS_CLINICOS)) {
      for (const e of lista) {
        const d = e.dist;
        expect(toCents(d.imagen) + toCents(d.medico) + toCents(d.eco) + toCents(d.patologo), `${area} / ${e.nombre}`).toBe(toCents(e.precio));
      }
    }
  });

  it('Doppler Obstétrico (Ginecología): $35 → 0 / 14 / 21 / 0', () => {
    const e = ESTUDIOS_CLINICOS.GINECOLOGIA.find((x) => x.nombre === 'DOPPLER OBSTETRICO')!;
    expect(e.precio).toBe(35);
    expect(e.dist).toEqual({ imagen: 0, medico: 14, eco: 21, patologo: 0 });
  });

  it('la parte eco es ganancia de la clínica y no honorario', () => {
    const r: RepartoCents = { precio: 3500, imagen: 0, medico: 1400, eco: 2100, patologo: 0 };
    expect(gananciaCents(r)).toBe(2100);
    expect(honorariosCents(r)).toBe(1400);
    const g: RepartoCents = { precio: 5000, imagen: 1200, medico: 1800, eco: 1400, patologo: 600 };
    expect(gananciaCents(g) + honorariosCents(g)).toBe(g.precio);
    expect(honorariosCents(g)).toBe(2400);
  });
});

describe('Octubre 2026: el sistema cuadra con la hoja', () => {
  const dias = Object.keys(TOTALES_HOJA);
  const calc = (dia: string) => {
    let ingreso = 0, ganancia = 0, honorarios = 0;
    for (const f of FILAS_HOJA.filter((x) => x.fecha === dia)) {
      const r = repartoDeFila(f);
      ingreso += (r.precio / 100) * f.tasa;
      ganancia += (gananciaCents(r) / 100) * f.tasa;
      honorarios += (honorariosCents(r) / 100) * f.tasa;
    }
    return { ingreso, ganancia, honorarios };
  };

  it.each(dias)('día %s: ingreso, ganancia y honorarios coinciden (±0,01 Bs)', (dia) => {
    const [ing, gan, hon] = TOTALES_HOJA[dia];
    const c = calc(dia);
    expect(Math.abs(c.ingreso - ing)).toBeLessThan(0.01);
    expect(Math.abs(c.ganancia - gan)).toBeLessThan(0.01);
    expect(Math.abs(c.honorarios - hon)).toBeLessThan(0.01);
    // Cuadre: ingreso − ganancia − honorarios = 0
    expect(Math.abs(c.ingreso - c.ganancia - c.honorarios)).toBeLessThan(0.01);
  });

  it('totales del mes', () => {
    const t = dias.reduce((a, d) => { const c = calc(d); return { i: a.i + c.ingreso, g: a.g + c.ganancia, h: a.h + c.honorarios }; }, { i: 0, g: 0, h: 0 });
    expect(t.i).toBeCloseTo(1714933.77, 1);
    expect(t.g).toBeCloseTo(1279278.32, 1);
    expect(t.h).toBeCloseTo(435655.45, 1);
  });

  it('cierres conocidos de la hoja (05/10 y 06/10)', () => {
    const c5 = calc('2026-10-05');
    expect(c5.ganancia).toBeCloseTo(338526.82, 1);
    expect(c5.honorarios).toBeCloseTo(132012.39, 1);
    const c6 = calc('2026-10-06');
    expect(c6.ingreso).toBeCloseTo(475454.02, 1);
    expect(c6.ganancia).toBeCloseTo(337615.97, 1);
    expect(c6.honorarios).toBeCloseTo(137838.05, 1);
  });
});
