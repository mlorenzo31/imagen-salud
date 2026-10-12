import { describe, expect, it } from 'vitest';
import { ApiError } from './apiHelpers';
import { validarSeleccionHonorarios } from './liquidacionHonorarios';

const fila = (id: number, medico: string, estado = 'PENDIENTE') => ({ id, medico, estado });

describe('validarSeleccionHonorarios', () => {
  it('acepta cuando todos son del médico y siguen pendientes (sin distinguir mayúsculas ni espacios)', () => {
    expect(() => validarSeleccionHonorarios([1, 2], [fila(1, 'Dra. Silvia'), fila(2, ' DRA. SILVIA ')], 'Dra. Silvia')).not.toThrow();
  });
  it('rechaza honorarios de otro médico', () => {
    expect(() => validarSeleccionHonorarios([1, 2], [fila(1, 'Dra. Silvia'), fila(2, 'Iraima Macero')], 'Dra. Silvia')).toThrow(/otro médico/);
  });
  it('rechaza si alguno ya no está pendiente', () => {
    expect(() => validarSeleccionHonorarios([1, 2], [fila(1, 'Dra. Silvia'), fila(2, 'Dra. Silvia', 'PAGADO')], 'Dra. Silvia')).toThrow(/ya no están pendientes/);
  });
  it('rechaza si alguno no existe', () => {
    expect(() => validarSeleccionHonorarios([1, 2, 3], [fila(1, 'Dra. Silvia')], 'Dra. Silvia')).toThrow(ApiError);
  });
  it('ignora ids repetidos en la selección', () => {
    expect(() => validarSeleccionHonorarios([1, 1], [fila(1, 'Dra. Silvia')], 'Dra. Silvia')).not.toThrow();
  });
});
