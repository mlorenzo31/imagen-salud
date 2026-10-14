import { ApiError } from '@/lib/apiHelpers';
import { centsToStr, mulRate } from '@/lib/money';

/** Venta de divisas a la tasa de mercado pactada: Bs recibidos (centavos) brutos y netos de la comisión bancaria. */
export function calcularVenta(usdCents: number, tasa: number, comisionBs: number): { brutoBs: number; netoBs: number } {
  if (!(usdCents > 0)) throw new ApiError(400, 'Indique cuántos dólares se venden.');
  if (!Number.isFinite(tasa) || tasa <= 0) throw new ApiError(400, 'Tasa de cambio inválida.');
  if (comisionBs < 0) throw new ApiError(400, 'La comisión bancaria no puede ser negativa.');
  const brutoBs = mulRate(usdCents, tasa);
  const netoBs = brutoBs - comisionBs;
  if (netoBs <= 0) throw new ApiError(400, 'La comisión no puede ser igual o mayor que lo recibido por la venta.');
  return { brutoBs, netoBs };
}

interface CuentaTransferencia { id: number; moneda: string; saldo: number; nombre: string }

/** Transferencia entre cuentas en Bs: cuentas distintas, ambas en Bs, monto positivo y saldo para monto + comisión. */
export function validarTransferencia(origen: CuentaTransferencia, destino: CuentaTransferencia, monto: number, comision: number): void {
  if (origen.id === destino.id) throw new ApiError(400, 'El origen y el destino no pueden ser la misma cuenta.');
  if (origen.moneda !== 'BS' || destino.moneda !== 'BS') throw new ApiError(400, 'Solo se puede transferir entre cuentas en bolívares.');
  if (!(monto > 0)) throw new ApiError(400, 'El monto a transferir debe ser mayor que cero.');
  if (comision < 0) throw new ApiError(400, 'La comisión bancaria no puede ser negativa.');
  if (origen.saldo < monto + comision) {
    throw new ApiError(400, `Saldo insuficiente en ${origen.nombre}. Disponible: ${centsToStr(origen.saldo)} Bs, requerido: ${centsToStr(monto + comision)} Bs.`);
  }
}

/** Operación para el reporte: `bs` son los Bs pagados (compra) o recibidos brutos (venta), sin la comisión. */
export interface OperacionResumen { tipo: 'COMPRA' | 'VENTA'; usd: number; bs: number; comisionBs: number }
export interface TotalCambiario { cantidad: number; usd: number; bs: number; comisionBs: number; tasaPromedio: number | null }

function totalizar(ops: OperacionResumen[]): TotalCambiario {
  const t = ops.reduce((a, o) => ({ cantidad: a.cantidad + 1, usd: a.usd + o.usd, bs: a.bs + o.bs, comisionBs: a.comisionBs + o.comisionBs }),
    { cantidad: 0, usd: 0, bs: 0, comisionBs: 0 });
  // Tasa promedio ponderada por monto (Bs por $), a 2 decimales.
  return { ...t, tasaPromedio: t.usd > 0 ? Math.round((t.bs / t.usd) * 100) / 100 : null };
}

/** Totales de compras y ventas del período; `netoUsd` = $ comprados − $ vendidos (centavos). */
export function resumirOperaciones(ops: OperacionResumen[]): { compras: TotalCambiario; ventas: TotalCambiario; netoUsd: number } {
  const compras = totalizar(ops.filter((o) => o.tipo === 'COMPRA'));
  const ventas = totalizar(ops.filter((o) => o.tipo === 'VENTA'));
  return { compras, ventas, netoUsd: compras.usd - ventas.usd };
}
