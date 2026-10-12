import { ApiError } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';

/** Movimientos del libro de deudas de honorarios: el CARGO suma a la deuda del médico, los ABONO la restan. */
export type TipoMovDeuda = 'CARGO' | 'ABONO_LIQUIDACION' | 'ABONO_DEVOLUCION';

/** Clave para comparar médicos: mismo criterio que la validación de la liquidación. */
export const claveMedico = (medico: string): string => medico.trim().toUpperCase();

/** Saldo en centavos (cargos − abonos). */
export function saldoDeuda(movs: { tipo: TipoMovDeuda; monto_usd: string | number }[]): number {
  return movs.reduce((acc, m) => acc + (m.tipo === 'CARGO' ? 1 : -1) * toCents(m.monto_usd), 0);
}

/** Un saldo negativo solo puede venir de datos corruptos: se rechaza en vez de operar con él. */
export function exigirSaldoValido(cents: number): number {
  if (cents < 0) throw new ApiError(500, 'El saldo de deuda del médico es negativo: revise deudas_honorarios.');
  return cents;
}

/** Descuento automático y parcial en la liquidación: todo lo posible, sin bajar de cero. */
export const descuentoAplicable = (deudaCents: number, adeudadoCents: number): number =>
  Math.max(0, Math.min(deudaCents, adeudadoCents));

/** Lo entregado debe igualar lo que hay que pagar, con 2 céntimos de tolerancia por la conversión de Bs. */
export const cuadraPago = (entregadoCents: number, aPagarCents: number): boolean =>
  Math.abs(entregadoCents - aPagarCents) <= 2;

/** Bolívares (centavos) a USD (centavos) con la tasa dada. */
export function usdDeBs(bsCents: number, tasa: number): number {
  if (!(tasa > 0)) throw new ApiError(400, 'Debe indicar una tasa BCV válida.');
  return Math.round(bsCents / tasa);
}

/** La devolución debe ser positiva y no superar la deuda (ya convertida a USD). */
export function validarDevolucion(montoUsdCents: number, deudaCents: number): void {
  if (montoUsdCents <= 0) throw new ApiError(400, 'El monto de la devolución debe ser mayor que cero.');
  if (deudaCents <= 0) throw new ApiError(400, 'El médico no tiene deuda pendiente.');
  if (montoUsdCents > deudaCents) {
    throw new ApiError(400, `La devolución ($${centsToStr(montoUsdCents)}) supera la deuda del médico ($${centsToStr(deudaCents)}).`);
  }
}

/**
 * Montos de una liquidación: si la deuda cubre todo, no sale dinero de ninguna cuenta (ni céntimos dentro de la
 * tolerancia del cuadre, ni una comisión suelta); y nunca se cobra comisión de pago móvil sin pago móvil.
 */
export function validarMontosLiquidacion(aPagarCents: number, m: { pm: number; comPm: number; efBs: number; efUsd: number }): void {
  if (aPagarCents === 0 && (m.pm !== 0 || m.comPm !== 0 || m.efBs !== 0 || m.efUsd !== 0)) {
    throw new ApiError(400, 'La deuda del médico cubre toda la liquidación: no escriba montos de pago.');
  }
  if (m.comPm > 0 && m.pm === 0) throw new ApiError(400, 'Hay comisión de pago móvil sin monto de pago móvil.');
}
