import { describe, expect, it } from 'vitest';
import { estadoFactura, montoAplicado, validarPago } from './pagos';

describe('montoAplicado', () => {
  it('misma moneda: igual; cruzada: convierte a la tasa del pago', () => {
    expect(montoAplicado(5000, 'BS', 'BS', 876.8)).toBe(5000);
    expect(montoAplicado(876800, 'BS', 'USD', 876.8)).toBe(1000);
    expect(montoAplicado(1000, 'USD', 'BS', 876.8)).toBe(876800);
  });
});

describe('estadoFactura', () => {
  it('pendiente, parcial y pagada (tolerancia de 1 céntimo)', () => {
    expect(estadoFactura(10000, 0)).toBe('PENDIENTE');
    expect(estadoFactura(10000, 5000)).toBe('PARCIAL');
    expect(estadoFactura(10000, 9999)).toBe('PAGADA');
    expect(estadoFactura(10000, 10000)).toBe('PAGADA');
  });
});

describe('validarPago', () => {
  it('no admite pagar más de lo pendiente ni más del saldo de la cuenta', () => {
    expect(validarPago(10002, 10000, 99999, 10002)).toMatch(/supera lo pendiente/);
    expect(validarPago(10001, 10000, 99999, 10001)).toBeNull(); // dentro de la tolerancia
    expect(validarPago(100, 10000, 100, 200)).toMatch(/Saldo insuficiente/);
    expect(validarPago(0, 10000, 100, 0)).toMatch(/mayor que cero/);
    expect(validarPago(100, 10000, 200, 200)).toBeNull();
  });
});
