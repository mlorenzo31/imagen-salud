import { ApiError } from '@/lib/apiHelpers';

const norm = (s: string) => s.trim().toUpperCase();

/**
 * Una liquidación solo procede si TODOS los honorarios elegidos existen, siguen PENDIENTE y son del médico liquidado.
 * Pagar un subconjunto en silencio, o mezclar médicos bajo un solo nombre, descuadra lo que se le debe a cada uno.
 */
export function validarSeleccionHonorarios(
  idsPedidos: number[],
  filas: { id: number; medico: string; estado: string }[],
  medico: string,
): void {
  const pedidos = new Set(idsPedidos);
  const porId = new Map(filas.map((f) => [Number(f.id), f]));
  const faltan = [...pedidos].filter((id) => !porId.has(id));
  if (faltan.length > 0) throw new ApiError(400, `Honorarios inexistentes: ${faltan.join(', ')}.`);
  const noPendientes = [...pedidos].filter((id) => porId.get(id)!.estado !== 'PENDIENTE');
  if (noPendientes.length > 0) {
    throw new ApiError(409, `Los honorarios ${noPendientes.join(', ')} ya no están pendientes. Actualice la lista antes de liquidar.`);
  }
  const ajenos = [...pedidos].filter((id) => norm(porId.get(id)!.medico) !== norm(medico));
  if (ajenos.length > 0) throw new ApiError(400, `Los honorarios ${ajenos.join(', ')} son de otro médico, no de ${medico}.`);
}
