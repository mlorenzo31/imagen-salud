/**
 * Cálculos de facturas de compra, en centavos enteros. Sin dependencias de servidor: lo usan las rutas y la vista previa
 * del formulario. Los errores se lanzan como `Error`; las rutas los traducen a 400.
 */

export type Moneda = 'BS' | 'USD';
export type TipoPersona = 'NATURAL' | 'JURIDICA';

/** Línea de factura: cantidad en milésimas (1 = 1000), precio unitario en centavos, alícuota en % entero (16, 8, 0). */
export interface LineaCompra { cantidad: number; precio: number; alicuota: number }

/** Configuración fiscal editable: nada de esto se fija en el código porque la normativa puede cambiar. */
export interface ConfigFiscal {
  retencionesActivas: boolean;
  ivaRetenidoPct: 75 | 100;
  islr: { concepto: string; tipoPersona: TipoPersona; pct: number; sustraendo: number }[];
  alicuotas: number[];
}

export interface TotalesFactura {
  porAlicuota: { alicuota: number; base: number; iva: number }[];
  exento: number;
  totalBase: number;
  totalIva: number;
  total: number;
  ivaRetenido: number;
  islrRetenido: number;
  netoAPagar: number;
}

export const CONFIG_FISCAL_DEFECTO: ConfigFiscal = { retencionesActivas: false, ivaRetenidoPct: 75, islr: [], alicuotas: [16, 8, 0] };

export const subtotalLinea = (l: LineaCompra): number => Math.round((l.cantidad * l.precio) / 1000);

export function calcularTotales(
  lineas: LineaCompra[],
  cfg: ConfigFiscal,
  retencion: { contribuyenteEspecial: boolean; conceptoIslr?: string; tipoPersona: TipoPersona },
): TotalesFactura {
  const bases = new Map<number, number>();
  let exento = 0;
  for (const l of lineas) {
    if (!cfg.alicuotas.includes(l.alicuota)) throw new Error(`La alícuota ${l.alicuota} % no está vigente en la configuración fiscal.`);
    const sub = subtotalLinea(l);
    if (l.alicuota === 0) exento += sub;
    else bases.set(l.alicuota, (bases.get(l.alicuota) ?? 0) + sub);
  }
  const porAlicuota = [...bases.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([alicuota, base]) => ({ alicuota, base, iva: Math.round((base * alicuota) / 100) }));
  const totalBase = porAlicuota.reduce((a, p) => a + p.base, 0);
  const totalIva = porAlicuota.reduce((a, p) => a + p.iva, 0);
  const total = totalBase + exento + totalIva;

  let ivaRetenido = 0;
  let islrRetenido = 0;
  if (cfg.retencionesActivas) {
    ivaRetenido = Math.round((totalIva * cfg.ivaRetenidoPct) / 100);
    const regla = cfg.islr.find((r) => r.concepto === retencion.conceptoIslr && r.tipoPersona === retencion.tipoPersona);
    if (regla) islrRetenido = Math.max(0, Math.round((totalBase * regla.pct) / 100) - regla.sustraendo);
  }
  return { porAlicuota, exento, totalBase, totalIva, total, ivaRetenido, islrRetenido, netoAPagar: total - ivaRetenido - islrRetenido };
}

const RIF = /^([JVEGP])-?(\d{7,9})$/;

/** RIF a la forma `J-12345678-9` (cuerpo de 8 dígitos + dígito verificador). Supone un RIF válido. */
export function normalizarRif(rif: string): string {
  const m = rif.trim().toUpperCase().replace(/[\s.]/g, '').replace(/-/g, '').match(/^([JVEGP])(\d{7,9})$/)!;
  const digitos = m[2];
  return `${m[1]}-${digitos.slice(0, -1).padStart(8, '0')}-${digitos.slice(-1)}`;
}

/** null si el RIF es válido (letra J, V, E, G o P y 7 a 9 dígitos); si no, el mensaje de error. */
export function validarRif(rif: string): string | null {
  const limpio = rif.trim().toUpperCase().replace(/[\s.]/g, '').replace(/-/g, '');
  return RIF.test(limpio) ? null : 'RIF inválido: use una letra (J, V, E, G o P) seguida de 7 a 9 dígitos, p. ej. J-12345678-9.';
}
