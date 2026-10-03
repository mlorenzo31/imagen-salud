import { describe, expect, it } from 'vitest';
import { ESTUDIOS_CLINICOS } from './catalogos';
import { toCents } from './money';

describe('catálogo oficial incorporado', () => {
  it('cada estudio reparte exactamente su precio (clínica + médico + ecografista + patólogo)', () => {
    const malos: string[] = [];
    for (const [area, lista] of Object.entries(ESTUDIOS_CLINICOS)) {
      for (const e of lista) {
        const suma = toCents(e.dist.imagen) + toCents(e.dist.medico) + toCents(e.dist.eco) + toCents(e.dist.patologo);
        if (suma !== toCents(e.precio)) malos.push(`${area} / ${e.nombre}`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('no hay nombres duplicados dentro de un área', () => {
    for (const [area, lista] of Object.entries(ESTUDIOS_CLINICOS)) {
      const nombres = lista.map((e) => e.nombre.toLowerCase());
      expect(new Set(nombres).size, area).toBe(nombres.length);
    }
  });
});
