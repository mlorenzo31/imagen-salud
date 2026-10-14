import { describe, expect, it } from 'vitest';
import { ApiError } from './apiHelpers';
import { cargosPendientes, claveMedico, cuadraPago, devolucionEnBs, saldoEnBs, validarMontosLiquidacion, descuentoAplicable, exigirSaldoValido, saldoDeuda, usdDeBs, validarDevolucion } from './deudasHonorarios';

describe('saldoDeuda', () => {
  it('suma cargos y resta abonos, en centavos', () => {
    expect(saldoDeuda([{ tipo: 'CARGO', monto_usd: '30.00' }, { tipo: 'ABONO_LIQUIDACION', monto_usd: '20.00' }, { tipo: 'ABONO_DEVOLUCION', monto_usd: 5 }])).toBe(500);
    expect(saldoDeuda([])).toBe(0);
  });
  it('rechaza saldos negativos (datos corruptos)', () => {
    expect(() => exigirSaldoValido(-1)).toThrow(ApiError);
    expect(exigirSaldoValido(0)).toBe(0);
  });
});

describe('claveMedico', () => {
  it('ignora mayúsculas y espacios', () => {
    expect(claveMedico(' Dra. Silvia ')).toBe(claveMedico('DRA. SILVIA'));
  });
});

describe('descuentoAplicable', () => {
  it('descuenta lo posible sin bajar de cero', () => {
    expect(descuentoAplicable(3000, 2000)).toBe(2000);
    expect(descuentoAplicable(2000, 2000)).toBe(2000);
    expect(descuentoAplicable(1000, 2000)).toBe(1000);
    expect(descuentoAplicable(0, 2000)).toBe(0);
    expect(descuentoAplicable(-100, 2000)).toBe(0);
  });
});

describe('cuadraPago', () => {
  it('tolera 2 céntimos y rechaza pagos cuando no hay nada que pagar', () => {
    expect(cuadraPago(500, 0)).toBe(false);
    expect(cuadraPago(2, 0)).toBe(true);
    expect(cuadraPago(1998, 2000)).toBe(true);
    expect(cuadraPago(1997, 2000)).toBe(false);
  });
});

describe('usdDeBs', () => {
  it('convierte Bs a USD en centavos', () => {
    expect(usdDeBs(874732, 874.7321)).toBe(1000);
    expect(() => usdDeBs(100, 0)).toThrow(ApiError);
  });
});

describe('validarDevolucion', () => {
  it('no permite devolver más que la deuda, ni montos vacíos, ni sin deuda', () => {
    expect(() => validarDevolucion(1001, 1000)).toThrow(/10\.00/);
    expect(() => validarDevolucion(0, 1000)).toThrow(ApiError);
    expect(() => validarDevolucion(500, 0)).toThrow(ApiError);
    expect(() => validarDevolucion(1000, 1000)).not.toThrow();
  });
});

describe('validarMontosLiquidacion', () => {
  const cero = { pm: 0, comPm: 0, efBs: 0, efUsd: 0 };
  it('si la deuda cubre todo (a pagar 0), no admite ningún monto, ni céntimos ni comisión', () => {
    expect(() => validarMontosLiquidacion(0, cero)).not.toThrow();
    expect(() => validarMontosLiquidacion(0, { ...cero, pm: 2100 })).toThrow(ApiError);
    expect(() => validarMontosLiquidacion(0, { ...cero, efUsd: 2 })).toThrow(ApiError);
    expect(() => validarMontosLiquidacion(0, { ...cero, comPm: 500 })).toThrow(ApiError);
  });
  it('no admite comisión de pago móvil sin pago móvil', () => {
    expect(() => validarMontosLiquidacion(2000, { ...cero, efUsd: 2000, comPm: 500 })).toThrow(/comisión/);
    expect(() => validarMontosLiquidacion(2000, { ...cero, pm: 1749464, comPm: 500 })).not.toThrow();
  });
});

describe('cargosPendientes / devolucionEnBs (tasa de cobro de cada factura, de la más vieja a la más nueva)', () => {
  const movs = [
    { id: 1, tipo: 'CARGO' as const, monto_usd: '6.00', tasa: 860 },
    { id: 2, tipo: 'CARGO' as const, monto_usd: '10.00', tasa: 870 },
    { id: 3, tipo: 'ABONO_LIQUIDACION' as const, monto_usd: '4.00', tasa: null },
  ];
  it('los abonos saldan primero los cargos más viejos', () => {
    expect(cargosPendientes(movs)).toEqual([{ id: 1, usd: 200, tasa: 860 }, { id: 2, usd: 1000, tasa: 870 }]);
  });
  it('el saldo en Bs se calcula a la tasa de cada factura', () => {
    expect(saldoEnBs(cargosPendientes(movs), 999)).toBe(172000 + 870000);
  });
  it('devolver exactamente los Bs adeudados deja la deuda en cero', () => {
    expect(devolucionEnBs(172000 + 870000, cargosPendientes(movs), 999)).toBe(1200);
  });
  it('una devolución parcial salda en orden y convierte el resto a la tasa del cargo siguiente', () => {
    expect(devolucionEnBs(172000 + 87000, cargosPendientes(movs), 999)).toBe(200 + 100);
  });
  it('rechaza devolver más Bs de los adeudados', () => {
    expect(() => devolucionEnBs(172000 + 870000 + 100, cargosPendientes(movs), 999)).toThrow(/supera la deuda/);
  });
  it('un cargo sin tasa de factura usa la tasa de respaldo', () => {
    const p = cargosPendientes([{ id: 9, tipo: 'CARGO' as const, monto_usd: '1.00', tasa: null }]);
    expect(saldoEnBs(p, 900)).toBe(90000);
  });
});
