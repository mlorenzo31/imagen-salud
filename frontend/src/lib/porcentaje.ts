import { ApiError } from '@/lib/apiHelpers';

const PCT = /^\d{1,3}(\.\d{1,2})?$/;

/** Porcentaje exacto (0–100, máx. 2 decimales) como texto, listo para una columna NUMERIC. Sin pasar por float. */
export function leerPorcentaje(valor: unknown, etiqueta = 'El porcentaje'): string {
  const txt = String(valor ?? '').trim().replace(',', '.');
  if (!PCT.test(txt) || Number(txt) > 100) {
    throw new ApiError(400, `${etiqueta} debe estar entre 0 y 100, con máximo 2 decimales.`);
  }
  return txt;
}
