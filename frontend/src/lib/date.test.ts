import { describe, expect, it } from 'vitest';
import { hoyLocal, sumarDias } from './date';

describe('hoyLocal', () => {
  it('usa la fecha de Caracas, no la UTC, después de las 8 p. m.', () => {
    // 2026-10-03 02:00 UTC = 2026-10-02 22:00 en Caracas (UTC-4)
    expect(hoyLocal(new Date('2026-10-03T02:00:00Z'))).toBe('2026-10-02');
    expect(hoyLocal(new Date('2026-10-03T05:00:00Z'))).toBe('2026-10-03');
  });
});

describe('sumarDias', () => {
  it('cruza fin de mes y de año', () => {
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-10-03', -7)).toBe('2026-09-26');
  });
});
