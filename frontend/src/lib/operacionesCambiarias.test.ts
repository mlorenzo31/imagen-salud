import { describe, expect, it } from 'vitest';
import { ApiError } from './apiHelpers';
import { calcularVenta, resumirOperaciones, validarTransferencia, type OperacionResumen } from './operacionesCambiarias';

describe('calcularVenta', () => {
  it('Bs recibidos = $ × tasa de mercado, menos la comisión, en centavos', () => {
    expect(calcularVenta(10000, 1050.5, 0)).toEqual({ brutoBs: 10505000, netoBs: 10505000 });
    expect(calcularVenta(2050, 1050.55, 1500)).toEqual({ brutoBs: 2153628, netoBs: 2152128 }); // 20.50 × 1050.55 = 21536.2775
  });
  it('rechaza montos, tasas o comisiones inválidas', () => {
    expect(() => calcularVenta(0, 1000, 0)).toThrow(ApiError);
    expect(() => calcularVenta(100, 0, 0)).toThrow(ApiError);
    expect(() => calcularVenta(100, 1000, -1)).toThrow(ApiError);
    expect(() => calcularVenta(100, 1000, 100000)).toThrow(/comisión/); // la comisión se come todo
  });
});

describe('validarTransferencia', () => {
  const bs = (id: number, saldo: number) => ({ id, moneda: 'BS', saldo, nombre: `Cuenta ${id}` });
  it('acepta una transferencia válida entre cuentas en Bs', () => {
    expect(() => validarTransferencia(bs(2, 50000), bs(4, 0), 30000, 500)).not.toThrow();
  });
  it('rechaza misma cuenta, cuentas que no son en Bs, monto vacío o saldo insuficiente', () => {
    expect(() => validarTransferencia(bs(2, 50000), bs(2, 0), 100, 0)).toThrow(/misma cuenta/);
    expect(() => validarTransferencia({ ...bs(1, 50000), moneda: 'USD' }, bs(4, 0), 100, 0)).toThrow(/bolívares/);
    expect(() => validarTransferencia(bs(2, 50000), { ...bs(1, 0), moneda: 'USD' }, 100, 0)).toThrow(/bolívares/);
    expect(() => validarTransferencia(bs(2, 50000), bs(4, 0), 0, 0)).toThrow(ApiError);
    expect(() => validarTransferencia(bs(2, 50000), bs(4, 0), 100, -1)).toThrow(ApiError);
    expect(() => validarTransferencia(bs(2, 50000), bs(4, 0), 49600, 500)).toThrow(/Saldo insuficiente/);
  });
});

describe('resumirOperaciones', () => {
  const ops: OperacionResumen[] = [
    { tipo: 'COMPRA', usd: 10000, bs: 10500000, comisionBs: 1000 },
    { tipo: 'COMPRA', usd: 5000, bs: 5300000, comisionBs: 0 },
    { tipo: 'VENTA', usd: 4000, bs: 4400000, comisionBs: 500 },
  ];
  it('totaliza compras y ventas y calcula la tasa promedio ponderada', () => {
    const r = resumirOperaciones(ops);
    expect(r.compras).toEqual({ cantidad: 2, usd: 15000, bs: 15800000, comisionBs: 1000, tasaPromedio: 1053.33 });
    expect(r.ventas).toEqual({ cantidad: 1, usd: 4000, bs: 4400000, comisionBs: 500, tasaPromedio: 1100 });
    expect(r.netoUsd).toBe(11000);
  });
  it('sin operaciones, todo en cero y sin tasa', () => {
    expect(resumirOperaciones([]).compras).toEqual({ cantidad: 0, usd: 0, bs: 0, comisionBs: 0, tasaPromedio: null });
  });
});
