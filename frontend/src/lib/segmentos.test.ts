import { describe, it, expect } from 'vitest';
import { calcularEdad, rangoEtario, personalizarMensaje, resumirSegmento, FiltrosSchema, type PacienteSegmento } from './segmentos';

const p = (o: Partial<PacienteSegmento>): PacienteSegmento => ({
  cedula: 'V1', nombre: 'X', telefono: '04141234567', fecha_nacimiento: null, edad: null, visitas: 1, gasto_cents: 0,
  ultima_visita: null, estudios: [], medicos: [], areas: [], contactable: true, ...o,
});

describe('segmentos', () => {
  it('calcula la edad cumplida', () => {
    expect(calcularEdad('1990-06-15', '2026-06-14')).toBe(35);
    expect(calcularEdad('1990-06-15', '2026-06-15')).toBe(36);
    expect(calcularEdad(null, '2026-10-07')).toBeNull();
    expect(calcularEdad('2030-01-01', '2026-10-07')).toBeNull();
  });
  it('asigna rango etario en los bordes', () => {
    expect(rangoEtario(17)).toBe('0–17');
    expect(rangoEtario(18)).toBe('18–29');
    expect(rangoEtario(75)).toBe('75+');
    expect(rangoEtario(null)).toBe('Sin fecha');
  });
  it('personaliza el mensaje y agrega el pie de baja', () => {
    const m = personalizarMensaje('Hola {nombre}, mamografía con 20% off', 'MARIA JOSE PEREZ');
    expect(m.startsWith('Hola Maria, mamografía')).toBe(true);
    expect(m.endsWith('BAJA para no recibir más mensajes._')).toBe(true);
  });
  it('resume por rango, área y contactables', () => {
    const r = resumirSegmento([
      p({ edad: 40, areas: ['MAMOGRAFIA'] }),
      p({ edad: 41, areas: ['MAMOGRAFIA', 'ECOGRAFIA_AM'], telefono: null, contactable: false }),
      p({ edad: null }),
    ], 2);
    expect(r.total).toBe(3);
    expect(r.contactables).toBe(2);
    expect(r.sinTelefono).toBe(1);
    expect(r.conBaja).toBe(2);
    expect(r.porRango.find((x) => x.etiqueta === '30–44')?.total).toBe(2);
    expect(r.porArea[0]).toEqual({ etiqueta: 'MAMOGRAFIA', total: 2 });
  });
  it('rechaza filtros inválidos y completa listas por defecto', () => {
    expect(FiltrosSchema.parse({}).estudios).toEqual([]);
    expect(FiltrosSchema.safeParse({ edadMin: -1 }).success).toBe(false);
    expect(FiltrosSchema.safeParse({ ultimaVisitaDesde: '07/10/2026' }).success).toBe(false);
  });
});
