/** Un servicio facturado (centavos USD): `cobrado` es el neto; `lista − cobrado` es el descuento. */
export interface FilaServicio { area: string; estudio: string; medico: string; lista: number; cobrado: number; honorarios: number; ganancia: number }

export interface Totales { cantidad: number; lista: number; descuento: number; cobrado: number; honorarios: number; ganancia: number }
export interface GrupoEstudio extends Totales { estudio: string }
export interface GrupoArea extends Totales { area: string; estudios: GrupoEstudio[] }
export interface GrupoDoctor extends Totales { medico: string }

export interface ResumenPeriodo { porArea: GrupoArea[]; porDoctor: GrupoDoctor[]; total: Totales; cuadra: boolean }

const cero = (): Totales => ({ cantidad: 0, lista: 0, descuento: 0, cobrado: 0, honorarios: 0, ganancia: 0 });

function sumar(t: Totales, f: FilaServicio): void {
  t.cantidad += 1;
  t.lista += f.lista;
  t.descuento += f.lista - f.cobrado;
  t.cobrado += f.cobrado;
  t.honorarios += f.honorarios;
  t.ganancia += f.ganancia;
}

const porCobrado = <T extends Totales>(a: T, b: T, nombre: (x: T) => string) => b.cobrado - a.cobrado || nombre(a).localeCompare(nombre(b));

/** Agrupa servicios por área → estudio y por doctor; `cuadra` compara lo cobrado con el total facturado de las facturas. */
export function agruparResumen(filas: FilaServicio[], totalFacturado: number): ResumenPeriodo {
  const total = cero();
  const areas = new Map<string, GrupoArea>();
  const estudios = new Map<string, GrupoEstudio>();
  const doctores = new Map<string, GrupoDoctor>();
  for (const f of filas) {
    sumar(total, f);
    const a = areas.get(f.area) ?? { area: f.area, ...cero(), estudios: [] };
    areas.set(f.area, a);
    sumar(a, f);
    const clave = `${f.area}|${f.estudio}`;
    let e = estudios.get(clave);
    if (!e) { e = { estudio: f.estudio, ...cero() }; estudios.set(clave, e); a.estudios.push(e); }
    sumar(e, f);
    const d = doctores.get(f.medico) ?? { medico: f.medico, ...cero() };
    doctores.set(f.medico, d);
    sumar(d, f);
  }
  const porArea = Array.from(areas.values()).sort((x, y) => porCobrado(x, y, (g) => g.area));
  porArea.forEach((a) => a.estudios.sort((x, y) => porCobrado(x, y, (g) => g.estudio)));
  const porDoctor = Array.from(doctores.values()).sort((x, y) => porCobrado(x, y, (g) => g.medico));
  return { porArea, porDoctor, total, cuadra: total.cobrado === totalFacturado };
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

/** null si el rango Desde–Hasta es válido; si no, el mensaje de error. */
export function rangoValido(desde: string, hasta: string): string | null {
  if (!FECHA.test(desde) || !FECHA.test(hasta)) return 'Fecha inválida (use AAAA-MM-DD).';
  if (desde > hasta) return 'La fecha inicial no puede ser posterior a la final.';
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1;
  if (dias > MAX_DIAS) return `El rango no puede superar ${MAX_DIAS} días.`;
  return null;
}
