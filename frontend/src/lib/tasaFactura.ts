import { ApiError } from '@/lib/apiHelpers';

/** Diferencia máxima (1 %) entre la tasa enviada por la pantalla y la vigente: cubre una pestaña con la tasa de hace unos minutos. */
export const TOLERANCIA_TASA = 0.01;

export interface DecisionTasa { tasa: number; manual: boolean }

/**
 * Tasa BCV que se aplica a una factura. La gobierna el servidor: solo un admin (con su clave, verificada por quien llama)
 * puede fijarla a mano; para el resto, la enviada debe coincidir con la vigente dentro de la tolerancia.
 */
export function decidirTasa(a: { cliente: number; vigente: number | null; rol: string; manual: boolean }): DecisionTasa {
  const hayCliente = Number.isFinite(a.cliente) && a.cliente > 0;
  if (a.manual) {
    if (a.rol !== 'admin') throw new ApiError(403, 'Solo el administrador puede fijar la tasa BCV manualmente.');
    if (!hayCliente) throw new ApiError(400, 'Indique una tasa BCV válida mayor a cero.');
    return { tasa: a.cliente, manual: true };
  }
  if (a.vigente === null) throw new ApiError(503, 'No hay tasa BCV disponible (proveedores caídos y sin historial). Solicite a un administrador fijarla.');
  if (!hayCliente) return { tasa: a.vigente, manual: false };
  if (Math.abs(a.cliente - a.vigente) / a.vigente > TOLERANCIA_TASA) {
    throw new ApiError(400, `La tasa enviada (${a.cliente}) difiere de la tasa BCV vigente (${a.vigente}). Recargue la pantalla; solo un administrador puede fijar otra tasa.`);
  }
  return { tasa: a.cliente, manual: false };
}
