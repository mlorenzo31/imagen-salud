import { describe, expect, it } from 'vitest';
import { claveMedico } from './claveMedico';

describe('claveMedico', () => {
  it('ignora mayúsculas y espacios de los extremos, igual que upper(trim()) en Postgres', () => {
    expect(claveMedico(' Dra. Núñez ')).toBe('DRA. NÚÑEZ');
    expect(claveMedico('dra. silvia')).toBe(claveMedico('DRA. SILVIA'));
  });
  it('no recorta tabulaciones ni espacios duros: Postgres tampoco, así JS y la base agrupan igual', () => {
    expect(claveMedico('\tDra. Silvia')).not.toBe(claveMedico('Dra. Silvia'));
    expect(claveMedico('Dra. Silvia ')).not.toBe(claveMedico('Dra. Silvia'));
  });
});
