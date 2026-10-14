import { describe, expect, it } from 'vitest';
import { ajustarPagoCruzado, estadoFactura, montoAplicado, toleranciaCruzada, validarPago } from './pagos';

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

describe('ajustarPagoCruzado (factura en Bs pagada desde $: un céntimo de $ vale ~tasa céntimos de Bs)', () => {
  it('pagar el equivalente redondeado salda la factura aunque quede corto por menos de un céntimo de la cuenta', () => {
    // 100.000,00 Bs a 876,8: $114,05 → Bs 99.999,04 (faltan 0,96 Bs, menos de un céntimo de $)
    const aplicado = montoAplicado(11405, 'USD', 'BS', 876.8);
    expect(ajustarPagoCruzado(aplicado, 10000000, toleranciaCruzada('USD', 'BS', 876.8))).toBe(10000000);
  });
  it('pagar un céntimo de $ de más no se rechaza y aplica solo lo pendiente', () => {
    const aplicado = montoAplicado(11406, 'USD', 'BS', 876.8); // Bs 100.007,81
    const tol = toleranciaCruzada('USD', 'BS', 876.8);
    expect(validarPago(aplicado, 10000000, 99999999, 11406, tol)).toBeNull();
    expect(ajustarPagoCruzado(aplicado, 10000000, tol)).toBe(10000000);
  });
  it('misma moneda: tolerancia de 1 céntimo; un pago claramente parcial no se toca', () => {
    expect(toleranciaCruzada('BS', 'BS', 876.8)).toBe(1);
    expect(ajustarPagoCruzado(5000, 10000, 1)).toBe(5000);
  });
  it('factura ya saldada: no admite más pagos', () => {
    expect(validarPago(1, 0, 99999, 1, 1)).toMatch(/ya está pagada/);
  });
});
