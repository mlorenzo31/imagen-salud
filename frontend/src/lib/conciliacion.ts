/**
 * Reparte `total` (centavos) entre partidas proporcionalmente a sus montos, sin perder ni crear centavos:
 * cada partida recibe el redondeo de su parte y la última absorbe el resto.
 */
export function repartirProporcional(montos: number[], total: number): number[] {
  const suma = montos.reduce((a, m) => a + m, 0);
  if (montos.length === 0) return [];
  if (suma <= 0) return montos.map((_, i) => (i === montos.length - 1 ? total : 0));
  let asignado = 0;
  return montos.map((m, i) => {
    if (i === montos.length - 1) return total - asignado;
    const parte = Math.round((total * m) / suma);
    asignado += parte;
    return parte;
  });
}
