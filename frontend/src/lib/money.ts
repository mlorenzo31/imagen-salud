/**
 * Aritmética monetaria exacta: los montos se manejan como centavos enteros (number seguro < 2^53)
 * y se envían a Postgres NUMERIC como texto decimal, sin pasar por float.
 */

/** Convierte un valor (string/number) a centavos con redondeo "half up" a 2 decimales. Lanza si no es numérico. */
export function toCents(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error(`Monto inválido: ${String(value)}`);
  // Se parte de la representación decimal en texto para evitar errores binarios (p. ej. 1.005).
  const text = typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim().replace(',', '.'))
    ? value.trim().replace(',', '.')
    : n.toFixed(8);
  const neg = text.startsWith('-');
  const [int, frac = ''] = text.replace('-', '').split('.');
  const padded = (frac + '000').slice(0, 3);
  let cents = BigInt(int) * 100n + BigInt(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1n;
  const result = Number(cents);
  return neg ? -result : result;
}

/** Centavos → texto decimal "123.45" apto para columnas NUMERIC. */
export function centsToStr(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}

/** Centavos → number solo para mostrar o responder al cliente. */
export function centsToNumber(cents: number): number {
  return Math.round(cents) / 100;
}

/** Multiplica centavos por una tasa (p. ej. USD→Bs) con redondeo half-up a centavo. */
export function mulRate(cents: number, rate: unknown): number {
  const rateNum = typeof rate === 'number' ? rate : Number(String(rate).replace(',', '.'));
  if (!Number.isFinite(rateNum) || rateNum <= 0) throw new Error(`Tasa inválida: ${String(rate)}`);
  // Tasa con 6 decimales de precisión, aritmética entera.
  const scaled = BigInt(Math.round(rateNum * 1_000_000));
  const product = BigInt(Math.round(cents)) * scaled;
  const q = product / 1_000_000n;
  const r = product % 1_000_000n;
  return Number(r * 2n >= 1_000_000n ? q + 1n : q);
}
