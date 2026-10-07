/** Beneficiario de la parte de patología (Ginecología). Se liquida aparte del ginecólogo. */
export const BENEFICIARIO_PATOLOGO = 'PATOLOGO';

export interface RepartoCents {
  precio: number;
  imagen: number;
  medico: number;
  eco: number;
  patologo: number;
}

/**
 * Regla de la clínica (hoja validada):
 *  - Ganancia de la clínica = imagen + eco (la parte "eco" NO es un pago a terceros).
 *  - Honorarios (lo que se paga) = médico + patólogo.
 */
export function gananciaCents(r: RepartoCents): number {
  return r.imagen + r.eco;
}

export function honorariosCents(r: RepartoCents): number {
  return r.medico + r.patologo;
}
