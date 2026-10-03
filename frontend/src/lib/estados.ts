/** Estados de factura que equivalen a "anulada" (cuentan como no facturado y ya revirtieron tesorería). */
export const ESTADOS_ANULADOS = ['ANULADA', 'ANULADA_SALA'] as const;

export const esAnulada = (estado: string | null | undefined): boolean =>
  !!estado && (ESTADOS_ANULADOS as readonly string[]).includes(estado);
