/**
 * Tablero de control fiscal: qué se cobró, qué se facturó y qué falta.
 * Regla: todo cobro no anulado debe terminar con su factura fiscal; lo que no la tiene se señala.
 */

export type EstadoCobroFiscal = 'EMITIDA' | 'CONTINGENCIA' | 'EN_PROCESO' | 'RECHAZADA' | 'DIFERIDA' | 'DIFERIDA_VENCIDA' | 'SIN_FACTURA';
export const ESTADOS_COBRO: EstadoCobroFiscal[] = ['EMITIDA', 'CONTINGENCIA', 'EN_PROCESO', 'RECHAZADA', 'DIFERIDA', 'DIFERIDA_VENCIDA', 'SIN_FACTURA'];

export interface FilaCobro {
  id: number;
  fecha: string;
  paciente: string;
  /** Centavos. */
  totalUsd: number;
  totalBs: number;
  docId: number | null;
  docEstado: string | null;
  docNumero: string | null;
  docControl: string | null;
  motivoDiferido: string | null;
  facturarAntesDe: string | null;
}

export function clasificar(f: FilaCobro, hoy: string): EstadoCobroFiscal {
  if (f.docId !== null) {
    if (f.docEstado === 'EMITIDO') return 'EMITIDA';
    if (f.docEstado === 'ERROR') return 'RECHAZADA';
    // Emitida en talonario: válida, pero falta remitirla a la imprenta digital (art. 7).
    if (f.docEstado === 'CONTINGENCIA') return 'CONTINGENCIA';
    return 'EN_PROCESO';
  }
  if (f.motivoDiferido) return f.facturarAntesDe !== null && f.facturarAntesDe < hoy ? 'DIFERIDA_VENCIDA' : 'DIFERIDA';
  return 'SIN_FACTURA';
}

interface Suma { n: number; usd: number; bs: number }
const cero = (): Suma => ({ n: 0, usd: 0, bs: 0 });

export interface Resumen {
  cobrado: Suma;
  porEstado: Record<EstadoCobroFiscal, Suma>;
  alertas: { vencidas: number; sinFactura: number; rechazadas: number };
  /** Nada vencido, rechazado ni sin factura. */
  alDia: boolean;
}

export function resumen(filas: FilaCobro[], hoy: string): Resumen {
  const cobrado = cero();
  const porEstado = Object.fromEntries(ESTADOS_COBRO.map((e) => [e, cero()])) as Record<EstadoCobroFiscal, Suma>;
  for (const f of filas) {
    for (const s of [cobrado, porEstado[clasificar(f, hoy)]]) { s.n++; s.usd += f.totalUsd; s.bs += f.totalBs; }
  }
  const alertas = { vencidas: porEstado.DIFERIDA_VENCIDA.n, sinFactura: porEstado.SIN_FACTURA.n, rechazadas: porEstado.RECHAZADA.n };
  return { cobrado, porEstado, alertas, alDia: alertas.vencidas + alertas.sinFactura + alertas.rechazadas === 0 };
}

export interface DocVsCobros { docId: number; numero: string; ventaUsd: number; cobrosUsd: number }

/** Facturas cuyo monto de venta (sin IVA ni IGTF) no coincide con la suma de los cobros que cubren. */
export function diferenciasDocumentos(docs: DocVsCobros[]): Array<DocVsCobros & { diferenciaUsd: number }> {
  return docs.filter((d) => d.ventaUsd !== d.cobrosUsd).map((d) => ({ ...d, diferenciaUsd: d.ventaUsd - d.cobrosUsd }));
}

/** Fila que devuelve GET /api/fiscal/tablero. */
export type FilaTablero = FilaCobro & { cedula: string; facturarA: string | null; estado: EstadoCobroFiscal };

export interface RespuestaTablero {
  inicioFacturacion: string | null;
  desde: string;
  hasta: string;
  filas: FilaTablero[];
  resumen: Resumen;
  diferencias: Array<DocVsCobros & { diferenciaUsd: number }>;
  notas: { credito: { n: number; usd: number; bs: number }; debito: { n: number; usd: number; bs: number } };
  /** Cobros anulados cuya factura no tiene nota de crédito (art. 12). */
  anuladosSinNota: Array<{ id: number; fecha: string; paciente: string; numero: string }>;
  /** Contingencia aún no remitida a la imprenta digital (art. 7), o null. */
  contingencia: ContingenciaTablero | null;
}

export interface ContingenciaTablero {
  id: number;
  motivo: string;
  fechaInicio: string;
  horaInicio: string;
  fechaFin: string | null;
  horaFin: string | null;
  documentos: number;
  estado: 'ACTIVA' | 'POR_ENVIAR' | 'VENCE_HOY' | 'VENCIDA' | 'ENVIADA';
  plazoEnvio: string | null;
  ultimoError: string | null;
}

export const ETIQUETA_ESTADO: Record<EstadoCobroFiscal, string> = {
  EMITIDA: 'Facturada',
  CONTINGENCIA: 'Talonario sin remitir',
  EN_PROCESO: 'En proceso',
  RECHAZADA: 'Rechazada',
  DIFERIDA: 'Diferida',
  DIFERIDA_VENCIDA: 'Diferida vencida',
  SIN_FACTURA: 'Sin factura',
};

/** Cobros que todavía se pueden facturar desde el tablero (no tienen documento fiscal). */
export const facturable = (e: EstadoCobroFiscal): boolean => e === 'DIFERIDA' || e === 'DIFERIDA_VENCIDA' || e === 'SIN_FACTURA';
