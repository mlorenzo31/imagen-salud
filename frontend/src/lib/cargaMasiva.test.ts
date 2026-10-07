import { describe, expect, it } from 'vitest';
import { normalizarFila } from './cargaMasiva';

const base = {
  Fecha: '2026-10-05', Nombres_Paciente: 'Ana', Apellidos_Paciente: 'Pérez', Servicio_Estudio: 'ABDOMINAL', Cedula_Paciente: 'V123',
  Precio_Total_USD: '20', Tasa_BCV: '800', Pago_Divisas_USD: '20',
};

describe('carga masiva: honorarios', () => {
  it('exige Honorarios_Medico_USD (no asume ningún porcentaje)', () => {
    const r = normalizarFila(base, []);
    expect(r.registro).toBeNull();
    expect(r.errores.join(' ')).toContain('Honorarios_Medico_USD');
  });

  it('con honorarios informados, la ganancia es el resto', () => {
    const r = normalizarFila({ ...base, Honorarios_Medico_USD: '6' }, []);
    expect(r.errores).toEqual([]);
    expect(r.registro?.honorarios).toBe(600);
    expect(r.registro?.ganancia).toBe(1400);
  });
});
