/**
 * Clave para comparar médicos, idéntica a `upper(trim(medico))` de Postgres (candados, saldos e índice): solo recorta
 * espacios, no tabulaciones ni espacios duros. Sin dependencias, para usarla también en componentes de cliente.
 */
export const claveMedico = (medico: string): string => medico.replace(/^ +| +$/g, '').toUpperCase();
