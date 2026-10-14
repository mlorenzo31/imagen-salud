import { mulRate } from '@/lib/money';
import type { Moneda } from './calculos';

/** Diferencia de redondeo aceptada al saldar una factura (centavos de la moneda de la factura). */
export const TOLERANCIA_PAGO = 1;

/** Cuánto de la factura salda un pago hecho desde una cuenta en otra moneda, a la tasa del pago. */
export function montoAplicado(montoCuenta: number, monedaCuenta: Moneda, monedaFactura: Moneda, tasa: number): number {
  if (monedaCuenta === monedaFactura) return montoCuenta;
  if (!(tasa > 0)) throw new Error('Indique la tasa del pago.');
  return monedaCuenta === 'BS' ? Math.round(montoCuenta / tasa) : mulRate(montoCuenta, tasa);
}

export function estadoFactura(neto: number, pagado: number): 'PENDIENTE' | 'PARCIAL' | 'PAGADA' {
  if (neto - pagado <= TOLERANCIA_PAGO) return 'PAGADA';
  return pagado > 0 ? 'PARCIAL' : 'PENDIENTE';
}

/**
 * Diferencia aceptada al saldar, en céntimos de la factura: un céntimo de la moneda de la cuenta. Pagando en $ una factura
 * en Bs, un céntimo de $ vale ~tasa céntimos de Bs, así que exigir 1 céntimo haría imposible saldarla exacto.
 */
export function toleranciaCruzada(monedaCuenta: Moneda, monedaFactura: Moneda, tasa: number): number {
  return monedaCuenta === 'USD' && monedaFactura === 'BS' ? Math.max(TOLERANCIA_PAGO, Math.ceil(tasa)) : TOLERANCIA_PAGO;
}

/** Lo que se aplica a la factura: si queda a menos de la tolerancia de lo pendiente, salda exacto; nunca más de lo pendiente. */
export function ajustarPagoCruzado(aplicado: number, pendiente: number, tolerancia: number): number {
  return Math.abs(pendiente - aplicado) <= tolerancia ? pendiente : Math.min(aplicado, pendiente);
}

/** null si el pago es válido. `aplicado`/`pendiente` en moneda de la factura; `montoCuenta`/`saldoCuenta` en la de la cuenta. */
export function validarPago(aplicado: number, pendiente: number, saldoCuenta: number, montoCuenta: number, tolerancia = TOLERANCIA_PAGO): string | null {
  if (!(montoCuenta > 0) || !(aplicado > 0)) return 'El monto del pago debe ser mayor que cero.';
  if (pendiente <= 0) return 'La factura ya está pagada.';
  if (aplicado > pendiente + tolerancia) return 'El pago supera lo pendiente de la factura.';
  if (montoCuenta > saldoCuenta) return 'Saldo insuficiente en la cuenta de origen.';
  return null;
}
