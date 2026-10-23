/**
 * Construcción de facturas y notas de crédito/débito según la Providencia SENIAT de facturación (G.O. 21/10/2026).
 * Funciones puras: reciben todo lo necesario y devuelven el documento listo para enviar a la imprenta digital.
 * Montos en centavos enteros (USD y Bs); la conversión usa `mulRate` con la tasa de la propia factura.
 */
import { mulRate } from '@/lib/money';
import { esNumeroControl, fechaFiscal, horaFiscal, marcarExento } from './formato';

export type CondicionIva = 'ORDINARIO' | 'FORMAL';
export type TipoDocumento = 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';

export interface DatosImprenta {
  razonSocial: string;
  rif: string;
  /** Nomenclatura de la providencia de autorización de la imprenta (art. 9.3). */
  providencia: string;
  /** Fecha de esa providencia, ISO 'AAAA-MM-DD'. */
  fechaProvidencia: string;
}

export interface ConfigEmisor {
  razonSocial: string;
  rif: string;
  domicilioFiscal: string;
  condicionIva: CondicionIva;
  /** Si la clínica percibe IGTF sobre los pagos en divisas. */
  percibeIgtf: boolean;
  igtfPct: number;
  /** Leyenda del art. 19 ("se emite conforme a la Providencia…"). */
  leyendaProvidencia: string;
  imprenta: DatosImprenta | null;
  /** Desde esta fecha (AAAA-MM-DD) todo cobro debe tener factura fiscal; null = aún no se factura. */
  inicioFacturacion: string | null;
}

export const CONFIG_EMISOR_DEFECTO: ConfigEmisor = {
  razonSocial: '',
  rif: '',
  domicilioFiscal: '',
  condicionIva: 'ORDINARIO',
  percibeIgtf: false,
  igtfPct: 3,
  leyendaProvidencia: 'Documento emitido conforme a la Providencia Administrativa del SENIAT publicada en Gaceta Oficial del 21/10/2026.',
  imprenta: null,
  inicioFacturacion: null,
};

export const FRASE_FORMAL = 'Contribuyentes Formales del IVA';

export interface LineaEntrada {
  /** Código de la operación (art. 9.2). */
  codigo: string;
  descripcion: string;
  cantidad: number;
  /** Centavos USD. */
  precioUnitarioUsd: number;
  /** Centavos USD de descuento sobre la línea completa. */
  descuentoUsd: number;
  /** Porcentaje de IVA; 0 = exento, exonerado o no gravado. */
  alicuota: number;
}

export interface Receptor {
  nombre: string;
  /** Cédula, pasaporte o RIF (art. 8.6). */
  documento: string;
  domicilio?: string;
}

/** Monto expresado en divisa y en bolívares (centavos). */
export interface Par { usd: number; bs: number }

export interface LineaFactura {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: Par;
  descuento: Par;
  monto: Par;
  alicuota: number;
}

export interface TotalesFactura {
  exento: Par;
  alicuotas: Array<{ pct: number; base: Par; iva: Par }>;
  descuentos: Par;
  iva: Par;
  igtf: { pct: number; base: Par; monto: Par } | null;
  total: Par;
}

export interface DocumentoFiscal {
  tipo: TipoDocumento;
  denominacion: 'Factura' | 'Nota de Crédito' | 'Nota de Débito';
  numero: string;
  numeroControl: string | null;
  fechaAsignacionControl: string | null;
  fechaEmision: string;
  horaEmision: string;
  emisor: { razonSocial: string; rif: string; domicilioFiscal: string };
  receptor: Receptor;
  lineas: LineaFactura[];
  totales: TotalesFactura;
  /** Tipo de cambio aplicado (art. 8.12), tal como se recibió. */
  tipoCambio: string;
  leyendas: string[];
  imprenta: DatosImprenta | null;
  referencia?: { numero: string; numeroControl: string | null; fechaEmision: string; total: Par };
  motivo?: string;
  /** Art. 20: serie del talonario de contingencia (la numeración digital no lleva serie). */
  serie?: string;
  /** Art. 11: datos del formato de contingencia. */
  contingencia?: { rangoControl: string; fechaElaboracion: string };
}

interface Comun {
  numero: string;
  numeroControl?: string | null;
  fechaAsignacionControl?: string | null;
  fecha: string;
  hora: string;
  lineas: LineaEntrada[];
  emisor: ConfigEmisor;
}

export interface EntradaFactura extends Comun {
  receptor: Receptor;
  tasa: string | number;
  /** Centavos USD cobrados en divisas (base del IGTF). */
  pagoDivisasUsd: number;
}

export interface EntradaNota extends Comun {
  tipo: 'NOTA_CREDITO' | 'NOTA_DEBITO';
  motivo: string;
  original: DocumentoFiscal;
  /** Centavos USD ya acreditados con notas de crédito anteriores a la misma factura. */
  acreditadoPrevioUsd?: number;
}

/** Porcentaje entero (o con decimales) aplicado a centavos, redondeo half-up. */
function pctDe(cents: number, pct: number): number {
  const bp = Math.round(pct * 100); // puntos básicos
  return Math.floor((cents * bp + 5000) / 10000);
}

const sumar = (a: Par, b: Par): Par => ({ usd: a.usd + b.usd, bs: a.bs + b.bs });
const CERO: Par = { usd: 0, bs: 0 };

function validarEmisor(e: ConfigEmisor) {
  if (!e.razonSocial.trim() || !e.rif.trim() || !e.domicilioFiscal.trim()) {
    throw new Error('Falta configurar el emisor (razón social, RIF y domicilio fiscal).');
  }
}

function construirLineas(lineas: LineaEntrada[], tasa: string | number, condicion: CondicionIva): LineaFactura[] {
  if (lineas.length === 0) throw new Error('El documento debe tener al menos una línea.');
  return lineas.map((l) => {
    if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) throw new Error(`Cantidad inválida en "${l.descripcion}".`);
    if (!Number.isInteger(l.precioUnitarioUsd) || l.precioUnitarioUsd < 0) throw new Error(`Precio inválido en "${l.descripcion}".`);
    if (!Number.isInteger(l.descuentoUsd) || l.descuentoUsd < 0) throw new Error(`Descuento inválido en "${l.descripcion}".`);
    if (!(l.alicuota >= 0 && l.alicuota <= 100)) throw new Error(`Alícuota inválida en "${l.descripcion}".`);
    if (condicion === 'FORMAL' && l.alicuota > 0) {
      throw new Error(`Un contribuyente formal del IVA no puede facturar operaciones gravadas ("${l.descripcion}").`);
    }
    const bruto = l.cantidad * l.precioUnitarioUsd;
    if (l.descuentoUsd > bruto) throw new Error(`El descuento supera el monto de "${l.descripcion}".`);
    const montoUsd = bruto - l.descuentoUsd;
    return {
      codigo: l.codigo.trim(),
      descripcion: l.alicuota === 0 ? marcarExento(l.descripcion) : l.descripcion.trim(),
      cantidad: l.cantidad,
      precioUnitario: { usd: l.precioUnitarioUsd, bs: mulRate(l.precioUnitarioUsd, tasa) },
      descuento: { usd: l.descuentoUsd, bs: mulRate(l.descuentoUsd, tasa) },
      monto: { usd: montoUsd, bs: mulRate(montoUsd, tasa) },
      alicuota: l.alicuota,
    };
  });
}

function totalizar(lineas: LineaFactura[], igtf: TotalesFactura['igtf']): TotalesFactura {
  const exento = lineas.filter((l) => l.alicuota === 0).reduce((a, l) => sumar(a, l.monto), CERO);
  const pcts = [...new Set(lineas.filter((l) => l.alicuota > 0).map((l) => l.alicuota))].sort((a, b) => b - a);
  const alicuotas = pcts.map((pct) => {
    const baseP = lineas.filter((l) => l.alicuota === pct).reduce((a, l) => sumar(a, l.monto), CERO);
    return { pct, base: baseP, iva: { usd: pctDe(baseP.usd, pct), bs: pctDe(baseP.bs, pct) } };
  });
  const iva = alicuotas.reduce((a, x) => sumar(a, x.iva), CERO);
  const descuentos = lineas.reduce((a, l) => sumar(a, l.descuento), CERO);
  const venta = alicuotas.reduce((a, x) => sumar(a, x.base), exento);
  let total = sumar(venta, iva);
  if (igtf) total = sumar(total, igtf.monto);
  return { exento, alicuotas, descuentos, iva, igtf, total };
}

function encabezado(tipo: TipoDocumento, e: Comun) {
  validarEmisor(e.emisor);
  if (!e.numero.trim()) throw new Error('Falta el número del documento.');
  const control = e.numeroControl ?? null;
  if (control !== null && !esNumeroControl(control)) throw new Error(`N° de control inválido: ${control}`);
  const denominacion = tipo === 'FACTURA' ? 'Factura' : tipo === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito';
  const leyendas = [e.emisor.leyendaProvidencia.trim()];
  if (e.emisor.condicionIva === 'FORMAL') leyendas.push(FRASE_FORMAL);
  return {
    tipo,
    denominacion,
    numero: e.numero.trim(),
    numeroControl: control,
    fechaAsignacionControl: e.fechaAsignacionControl ? fechaFiscal(e.fechaAsignacionControl) : null,
    fechaEmision: fechaFiscal(e.fecha),
    horaEmision: horaFiscal(e.hora),
    emisor: { razonSocial: e.emisor.razonSocial.trim(), rif: e.emisor.rif.trim(), domicilioFiscal: e.emisor.domicilioFiscal.trim() },
    leyendas,
    imprenta: e.emisor.imprenta ? { ...e.emisor.imprenta, fechaProvidencia: fechaFiscal(e.emisor.imprenta.fechaProvidencia) } : null,
  } as const;
}

function validarReceptor(r: Receptor): Receptor {
  const nombre = r.nombre.trim(), documento = r.documento.trim();
  if (!nombre) throw new Error('Falta el nombre o razón social del receptor.');
  if (!documento) throw new Error('Falta la cédula, pasaporte o RIF del receptor.');
  return r.domicilio?.trim() ? { nombre, documento, domicilio: r.domicilio.trim() } : { nombre, documento };
}

/** Factura con los requisitos de los arts. 8, 9 y 19. */
export function construirFactura(e: EntradaFactura): DocumentoFiscal {
  const cab = encabezado('FACTURA', e);
  const receptor = validarReceptor(e.receptor);
  const lineas = construirLineas(e.lineas, e.tasa, e.emisor.condicionIva);
  if (!Number.isInteger(e.pagoDivisasUsd) || e.pagoDivisasUsd < 0) throw new Error('Pago en divisas inválido.');
  let igtf: TotalesFactura['igtf'] = null;
  if (e.emisor.percibeIgtf && e.pagoDivisasUsd > 0) {
    const sinIgtf = totalizar(lineas, null).total.usd;
    const baseUsd = Math.min(e.pagoDivisasUsd, sinIgtf);
    const montoUsd = pctDe(baseUsd, e.emisor.igtfPct);
    igtf = { pct: e.emisor.igtfPct, base: { usd: baseUsd, bs: mulRate(baseUsd, e.tasa) }, monto: { usd: montoUsd, bs: mulRate(montoUsd, e.tasa) } };
  }
  return { ...cab, receptor, lineas, totales: totalizar(lineas, igtf), tipoCambio: String(e.tasa) };
}

/** Nota de crédito o débito (arts. 12-13): mismo receptor y tipo de cambio de la factura original, con referencia a ella. */
export function construirNota(e: EntradaNota): DocumentoFiscal {
  if (!e.motivo.trim()) throw new Error('Indique el motivo de la nota.');
  if (e.original.tipo !== 'FACTURA') throw new Error('La nota debe referirse a una factura.');
  const cab = encabezado(e.tipo, e);
  const lineas = construirLineas(e.lineas, e.original.tipoCambio, e.emisor.condicionIva);
  const totales = totalizar(lineas, null);
  if (e.tipo === 'NOTA_CREDITO') {
    const pendiente = e.original.totales.total.usd - (e.acreditadoPrevioUsd ?? 0);
    if (totales.total.usd > pendiente) throw new Error('La nota de crédito excede el saldo pendiente de la factura.');
  }
  return {
    ...cab,
    receptor: e.original.receptor,
    lineas,
    totales,
    tipoCambio: e.original.tipoCambio,
    referencia: { numero: e.original.numero, numeroControl: e.original.numeroControl, fechaEmision: e.original.fechaEmision, total: e.original.totales.total },
    motivo: e.motivo.trim(),
  };
}
