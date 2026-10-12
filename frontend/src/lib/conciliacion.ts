/**
 * Reparte `total` (centavos) entre partidas proporcionalmente a sus montos, sin perder ni crear centavos
 * (método del mayor residuo): cada partida recibe el piso de su parte y los centavos sobrantes van, uno a uno,
 * a las de mayor residuo (empate: la primera). Ninguna parte queda negativa. Aritmética entera exacta (BigInt).
 */
export function repartirProporcional(montos: number[], total: number): number[] {
  const suma = montos.reduce((a, m) => a + m, 0);
  if (montos.length === 0) return [];
  if (suma <= 0) return montos.map((_, i) => (i === montos.length - 1 ? total : 0));
  const T = BigInt(total), S = BigInt(suma);
  const partes = montos.map((m) => {
    const p = T * BigInt(m);
    return { piso: Number(p / S), residuo: p % S };
  });
  let sobrante = total - partes.reduce((a, p) => a + p.piso, 0);
  const orden = partes.map((_, i) => i).sort((a, b) => (partes[b].residuo > partes[a].residuo ? 1 : partes[b].residuo < partes[a].residuo ? -1 : a - b));
  const res = partes.map((p) => p.piso);
  for (const i of orden) {
    if (sobrante <= 0) break;
    res[i] += 1;
    sobrante -= 1;
  }
  return res;
}
