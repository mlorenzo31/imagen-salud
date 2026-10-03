import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn() } }));

import { elegirJornadaPendiente } from './cierre';

const HOY = '2026-10-10';
const act = (f: string, n: number, pend = 0) => ({ f, n, pend });

describe('elegirJornadaPendiente', () => {
  it('sin días anteriores con actividad, la caja está al día', () => {
    expect(elegirJornadaPendiente([], new Set(), HOY)).toBeNull();
    expect(elegirJornadaPendiente([act('2026-10-10', 5)], new Set(), HOY)).toBeNull(); // hoy nunca bloquea
  });

  it('un día anterior con facturas y sin cierre obliga a cerrar', () => {
    expect(elegirJornadaPendiente([act('2026-10-09', 3)], new Set(), HOY)).toBe('2026-10-09');
  });

  it('un día ya cerrado no bloquea', () => {
    expect(elegirJornadaPendiente([act('2026-10-09', 3)], new Set(['2026-10-09']), HOY)).toBeNull();
  });

  it('elige el día más antiguo sin cerrar', () => {
    const filas = [act('2026-10-09', 2), act('2026-10-07', 4), act('2026-10-08', 1)];
    expect(elegirJornadaPendiente(filas, new Set(['2026-10-08']), HOY)).toBe('2026-10-07');
  });

  it('pacientes en espera/atención bloquean aunque el día tenga cierre o sea antiguo', () => {
    expect(elegirJornadaPendiente([act('2026-10-09', 3, 1)], new Set(['2026-10-09']), HOY)).toBe('2026-10-09');
    expect(elegirJornadaPendiente([act('2026-08-01', 3, 1)], new Set(), HOY)).toBe('2026-08-01');
  });

  it('días fuera de la ventana sin pendientes se consideran historial heredado', () => {
    expect(elegirJornadaPendiente([act('2026-09-20', 8)], new Set(), HOY)).toBeNull();
    expect(elegirJornadaPendiente([act('2026-10-03', 8)], new Set(), HOY)).toBe('2026-10-03'); // justo en el límite (7 días)
  });

  it('días solo con facturas anuladas no obligan a cerrar', () => {
    expect(elegirJornadaPendiente([act('2026-10-09', 0)], new Set(), HOY)).toBeNull();
  });
});
