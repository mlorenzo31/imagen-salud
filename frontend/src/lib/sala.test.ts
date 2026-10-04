import { describe, expect, it } from 'vitest';
import { clasificarServicio, planificarLlamado, type TareaSala } from './sala';

describe('clasificarServicio', () => {
  it('por área del catálogo', () => {
    expect(clasificarServicio('Abdominal', 'ECOGRAFIA_AM').recurso).toBe('ECO');
    expect(clasificarServicio('CITOLOGIA', 'GINECOLOGIA').recurso).toBe('GINE');
    expect(clasificarServicio('Mamografía Digital', 'MAMOGRAFIA').grupo).toBe('B');
    expect(clasificarServicio('Consulta', 'CONSULTAS').grupo).toBe('C');
  });
  it('SOLO ECO y Doppler Obstétrico siguen el área elegida por el cajero', () => {
    for (const e of ['SOLO ECO', 'DOPPLER OBSTETRICO']) {
      expect(clasificarServicio(e, 'ECOGRAFIA_AM').recurso).toBe('ECO');
      expect(clasificarServicio(e, 'ECOGRAFIA_PM').recurso).toBe('ECO');
      expect(clasificarServicio(e, 'GINECOLOGIA').recurso).toBe('GINE');
    }
  });
  it('por nombre (con tildes) cuando no hay área', () => {
    expect(clasificarServicio('Tórax PA (1 Proyección)').recurso).toBe('RX');
    expect(clasificarServicio('Doppler Carotido').recurso).toBe('ECO');
    expect(clasificarServicio('CONSULTA +CITOLOGIA').recurso).toBe('GINE');
    expect(clasificarServicio('Mamografía Digital').recurso).toBe('MAMO');
    expect(clasificarServicio('Cardiología').recurso).toBe('CONS');
  });
});

const t = (id: number, p: string, recurso: TareaSala['recurso'], estado: TareaSala['estado'], box: string | null = null, medico: string | null = null): TareaSala => ({
  id, factura_id: id, paciente: p, nombre: p.toUpperCase(), grupo: ({ ECO: 'A', GINE: 'A', MAMO: 'B', RX: 'B', CONS: 'C' } as const)[recurso], recurso, medico, box, estado,
});

describe('planificarLlamado', () => {
  it('ecografía y ginecología funcionan a la vez', () => {
    const r = planificarLlamado([2], [t(1, 'ana', 'GINE', 'ATENCION', 'Consultorio Ginecológico'), t(2, 'bea', 'ECO', 'ESPERA')]);
    expect(r).toEqual({ ok: true, asignaciones: [{ id: 2, box: 'Sala de Ecografía' }] });
  });
  it('bloquea sala ocupada por otro paciente', () => {
    const r = planificarLlamado([2], [t(1, 'ana', 'ECO', 'ATENCION', 'Sala de Ecografía'), t(2, 'bea', 'ECO', 'ESPERA')]);
    expect(r).toMatchObject({ ok: false, codigo: 'BOX_OCUPADO' });
  });
  it('mismo paciente no puede estar en atención en dos grupos', () => {
    const r = planificarLlamado([2], [t(1, 'ana', 'RX', 'ATENCION', 'Sala de Rayos X'), t(2, 'ana', 'ECO', 'ESPERA')]);
    expect(r).toMatchObject({ ok: false, codigo: 'EN_OTRO_GRUPO' });
  });
  it('mismo grupo es opcional y permitido (llamado conjunto o por separado)', () => {
    const abiertas = [t(1, 'ana', 'ECO', 'ATENCION', 'Sala de Ecografía'), t(2, 'ana', 'GINE', 'ESPERA')];
    expect(planificarLlamado([2], abiertas)).toMatchObject({ ok: true });
    expect(planificarLlamado([1, 2].slice(1), abiertas)).toMatchObject({ ok: true });
    expect(planificarLlamado([3, 4], [t(3, 'bea', 'ECO', 'ESPERA'), t(4, 'bea', 'GINE', 'ESPERA')])).toMatchObject({ ok: true });
  });
  it('conjunto exige mismo paciente y grupo', () => {
    expect(planificarLlamado([1, 2], [t(1, 'ana', 'ECO', 'ESPERA'), t(2, 'ana', 'RX', 'ESPERA')])).toMatchObject({ ok: false, codigo: 'GRUPO_MIXTO' });
  });
  it('dos consultorios: asigna el libre y bloquea cuando ambos están ocupados', () => {
    const base = [t(1, 'ana', 'CONS', 'ATENCION', 'Consultorio 1', 'Dr. A'), t(3, 'cris', 'CONS', 'ESPERA', null, 'Dr. B')];
    expect(planificarLlamado([3], base)).toEqual({ ok: true, asignaciones: [{ id: 3, box: 'Consultorio 2' }] });
    const llenos = [...base, t(2, 'bea', 'CONS', 'ATENCION', 'Consultorio 2', 'Dr. C')];
    expect(planificarLlamado([3], llenos)).toMatchObject({ ok: false, codigo: 'BOX_OCUPADO' });
  });
  it('un médico no atiende a dos pacientes a la vez', () => {
    const r = planificarLlamado([2], [t(1, 'ana', 'CONS', 'ATENCION', 'Consultorio 1', 'Dr. A'), t(2, 'bea', 'CONS', 'ESPERA', null, 'Dr. A')]);
    expect(r).toMatchObject({ ok: false, codigo: 'MEDICO_OCUPADO' });
  });
  it('turno ya llamado o inexistente', () => {
    expect(planificarLlamado([1], [t(1, 'ana', 'ECO', 'ATENCION', 'Sala de Ecografía')])).toMatchObject({ ok: false, codigo: 'ESTADO_INVALIDO' });
    expect(planificarLlamado([9], [])).toMatchObject({ ok: false, codigo: 'NO_ENCONTRADO' });
  });
});
