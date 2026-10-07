/** Ejecuta `fn` fuera del cuerpo del efecto (evita setState síncrono en useEffect). Devuelve la limpieza. */
export function diferir(fn: () => void): () => void {
  const t = setTimeout(fn, 0);
  return () => clearTimeout(t);
}
