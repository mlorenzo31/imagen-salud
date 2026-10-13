import { centsToNumber, mulRate } from '@/lib/money';

/** Una factura no anulada del período (centavos USD; pagos en Bs en centavos de Bs, divisas en centavos de $). */
export interface FacturaHoja {
  fecha: string;
  cedula: string;
  tasa: number;
  precio: number;
  honorarios: number;
  pagos: { punto: number; movil: number; efectivoBs: number; divisas: number };
  /** Ganancia de la clínica por servicio; ginecología trae su reparto imagen/eco cuando está guardado. */
  servicios: { area: string; ganancia: number; imagen?: number; eco?: number }[];
}

export const AREAS_HOJA = ['ECOGRAFIA_AM', 'ECOGRAFIA_PM', 'MAMOGRAFIA', 'RADIOLOGIA', 'CONSULTAS', 'GINECO_IMAGEN', 'GINECO_ECO'] as const;
export type AreaHoja = (typeof AREAS_HOJA)[number];

/** Fila de la hoja de cierre diario: todo en centavos de Bs, salvo `divisas` (centavos de $). */
export interface FilaHoja {
  fecha: string;
  pacientes: number;
  ingreso: number;
  movil: number;
  punto: number;
  efectivo: number;
  divisas: number;
  cobrado: number;
  saldoPendiente: number;
  gananciaTotal: number;
  honorarios: number;
  porArea: Record<AreaHoja, number>;
  /** (precio − ganancia − honorarios) en Bs: distinto de 0 delata una factura mal repartida. */
  cuadre: number;
  gananciaClinica: number;
}

const ceroAreas = (): Record<AreaHoja, number> => Object.fromEntries(AREAS_HOJA.map((a) => [a, 0])) as Record<AreaHoja, number>;
const bs = (cents: number, tasa: number) => (cents < 0 ? -mulRate(-cents, tasa) : mulRate(cents, tasa));

const filaVacia = (fecha: string): FilaHoja => ({
  fecha, pacientes: 0, ingreso: 0, movil: 0, punto: 0, efectivo: 0, divisas: 0, cobrado: 0, saldoPendiente: 0,
  gananciaTotal: 0, honorarios: 0, porArea: ceroAreas(), cuadre: 0, gananciaClinica: 0,
});

function diasDelRango(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += 86_400_000) {
    dias.push(new Date(t).toISOString().slice(0, 10));
  }
  return dias;
}

/** Montos en centavos USD de un día a una misma tasa: se convierten a Bs una sola vez, como en la hoja. */
interface BolsaUsd { ingreso: number; honorarios: number; divisas: number; cuadre: number; porArea: Record<AreaHoja, number> }

function sumarFactura(fila: FilaHoja, bolsas: Map<number, BolsaUsd>, f: FacturaHoja): void {
  if (!bolsas.has(f.tasa)) bolsas.set(f.tasa, { ingreso: 0, honorarios: 0, divisas: 0, cuadre: 0, porArea: ceroAreas() });
  const b = bolsas.get(f.tasa)!;
  b.ingreso += f.precio;
  b.honorarios += f.honorarios;
  b.divisas += f.pagos.divisas;
  fila.punto += f.pagos.punto;
  fila.movil += f.pagos.movil;
  fila.efectivo += f.pagos.efectivoBs;
  fila.divisas += f.pagos.divisas;
  let ganancia = 0;
  for (const s of f.servicios) {
    ganancia += s.ganancia;
    if (s.area === 'GINECOLOGIA') {
      // El eco se toma del reparto guardado (sin pasar la ganancia neta); el resto es imagen.
      const eco = Math.min(Math.max(s.eco ?? 0, 0), Math.max(s.ganancia, 0));
      b.porArea.GINECO_ECO += eco;
      b.porArea.GINECO_IMAGEN += s.ganancia - eco;
    } else if ((AREAS_HOJA as readonly string[]).includes(s.area)) {
      b.porArea[s.area as AreaHoja] += s.ganancia;
    } else {
      b.porArea.CONSULTAS += s.ganancia; // áreas fuera de la hoja: se agrupan con consultas
    }
  }
  b.cuadre += f.precio - ganancia - f.honorarios;
}

function convertirBolsas(fila: FilaHoja, bolsas: Map<number, BolsaUsd>): void {
  for (const [tasa, b] of bolsas) {
    fila.ingreso += bs(b.ingreso, tasa);
    fila.honorarios += bs(b.honorarios, tasa);
    fila.cuadre += bs(b.cuadre, tasa);
    fila.cobrado += bs(b.divisas, tasa);
    for (const a of AREAS_HOJA) fila.porArea[a] += bs(b.porArea[a], tasa);
  }
  fila.cobrado += fila.punto + fila.movil + fila.efectivo;
}

function cerrarFila(fila: FilaHoja): void {
  fila.gananciaTotal = AREAS_HOJA.reduce((a, k) => a + fila.porArea[k], 0);
  fila.saldoPendiente = fila.ingreso - fila.cobrado;
  fila.gananciaClinica = fila.cobrado - fila.honorarios;
}

/** Hoja de cierre diario del rango: una fila por día (también los días sin actividad) y el total. */
export function construirHojaCierre(facturas: FacturaHoja[], desde: string, hasta: string): { filas: FilaHoja[]; total: FilaHoja } {
  const porDia = new Map(diasDelRango(desde, hasta).map((d) => [d, filaVacia(d)]));
  const personasDia = new Map<string, Set<string>>();
  const personas = new Set<string>();
  const bolsasDia = new Map<string, Map<number, BolsaUsd>>();
  for (const f of facturas) {
    const fila = porDia.get(f.fecha);
    if (!fila) continue;
    if (!bolsasDia.has(f.fecha)) bolsasDia.set(f.fecha, new Map());
    sumarFactura(fila, bolsasDia.get(f.fecha)!, f);
    const clave = f.cedula.trim().toUpperCase();
    if (!personasDia.has(f.fecha)) personasDia.set(f.fecha, new Set());
    personasDia.get(f.fecha)!.add(clave);
    personas.add(clave);
  }
  const filas = [...porDia.values()];
  const total = filaVacia('TOTAL');
  for (const fila of filas) {
    fila.pacientes = personasDia.get(fila.fecha)?.size ?? 0;
    convertirBolsas(fila, bolsasDia.get(fila.fecha) ?? new Map());
    cerrarFila(fila);
    for (const k of ['ingreso', 'movil', 'punto', 'efectivo', 'divisas', 'cobrado', 'honorarios', 'cuadre'] as const) total[k] += fila[k];
    for (const a of AREAS_HOJA) total.porArea[a] += fila.porArea[a];
  }
  total.pacientes = personas.size;
  cerrarFila(total);
  return { filas, total };
}

const ETIQUETA_AREA: Record<AreaHoja, string> = {
  ECOGRAFIA_AM: 'GANANCIA ECO AM', ECOGRAFIA_PM: 'GANANCIA ECO PM', MAMOGRAFIA: 'GANANCIA MAMOGRAFÍA', RADIOLOGIA: 'GANANCIA RADIOLOGÍA',
  CONSULTAS: 'GANANCIA CONSULTAS', GINECO_IMAGEN: 'GANANCIA GINECO. IMAGEN', GINECO_ECO: 'GANANCIA GINECO. ECO',
};

const ddmmaaaa = (f: string) => (f === 'TOTAL' ? f : `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`);

/** Filas listas para Excel con las columnas de la hoja CIERRE DIARIO (montos en unidades, Bs salvo divisas). */
export function filasExcelHojaCierre(hoja: { filas: FilaHoja[]; total: FilaHoja }): Record<string, string | number>[] {
  return [...hoja.filas, hoja.total].map((f) => ({
    FECHA: ddmmaaaa(f.fecha),
    PACIENTES: f.pacientes,
    'INGRESO TOTAL': centsToNumber(f.ingreso),
    'PAGO MÓVIL': centsToNumber(f.movil),
    'PUNTO (TDD)': centsToNumber(f.punto),
    EFECTIVO: centsToNumber(f.efectivo),
    'DIVISAS ($)': centsToNumber(f.divisas),
    'TOTAL COBRADO (Bs)': centsToNumber(f.cobrado),
    'SALDO PENDIENTE (Bs)': centsToNumber(f.saldoPendiente),
    'GANANCIA IMAGEN (TOTAL)': centsToNumber(f.gananciaTotal),
    'HONORARIOS MÉDICOS': centsToNumber(f.honorarios),
    ...Object.fromEntries(AREAS_HOJA.map((a) => [ETIQUETA_AREA[a], centsToNumber(f.porArea[a])])),
    'CUADRE (debe ser 0)': centsToNumber(f.cuadre),
    'GANANCIA CLÍNICA (cobrado − honorarios)': centsToNumber(f.gananciaClinica),
  }));
}
