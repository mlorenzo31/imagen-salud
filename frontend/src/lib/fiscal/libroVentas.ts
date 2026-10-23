/**
 * Libro de ventas del mes (Fase 7) a partir de los documentos fiscales emitidos, en Bs. Igual que el libro de compras:
 * una fila por alícuota y los totales del documento solo en la primera. Las notas de crédito restan.
 */
import { centsToNumber } from '@/lib/money';
import type { TipoDocumento, TotalesFactura } from './factura';

export interface DocLibro {
  id: number;
  tipo: TipoDocumento;
  serie: string;
  numero: string;
  numeroControl: string | null;
  /** AAAA-MM-DD. */
  fecha: string;
  medio: 'DIGITAL' | 'CONTINGENCIA';
  receptorNombre: string;
  receptorDocumento: string;
  totales: TotalesFactura;
  referencia: { numero: string; numeroControl: string | null } | null;
  /** Centavos de Bs retenidos por el cliente (retenciones recibidas vigentes). */
  ivaRetenido: number;
  comprobanteRetencion: string | null;
}

const SIGLA: Record<TipoDocumento, string> = { FACTURA: 'FAC', NOTA_CREDITO: 'NC', NOTA_DEBITO: 'ND' };

export interface ResumenLibro {
  documentos: number;
  exento: number;
  alicuotas: Array<{ alicuota: number; base: number; iva: number }>;
  igtf: number;
  total: number;
  ivaRetenido: number;
}

export function libroVentas(docs: DocLibro[]): { filas: Record<string, string | number>[]; resumen: ResumenLibro } {
  const orden = [...docs].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.serie.localeCompare(b.serie) || a.numero.localeCompare(b.numero) || a.id - b.id);
  const filas: Record<string, string | number>[] = [];
  const porAlicuota = new Map<number, { alicuota: number; base: number; iva: number }>();
  const r: ResumenLibro = { documentos: 0, exento: 0, alicuotas: [], igtf: 0, total: 0, ivaRetenido: 0 };
  for (const d of orden) {
    const s = d.tipo === 'NOTA_CREDITO' ? -1 : 1;
    const t = d.totales;
    const tramos = t.alicuotas.length ? t.alicuotas : [{ pct: 0, base: { usd: 0, bs: 0 }, iva: { usd: 0, bs: 0 } }];
    const igtf = t.igtf?.monto.bs ?? 0;
    tramos.forEach((a, i) => {
      const primera = i === 0;
      filas.push({
        FECHA: d.fecha, 'TIPO DOCUMENTO': SIGLA[d.tipo], 'TIPO TRANSACCIÓN': d.tipo === 'FACTURA' ? '01-REG' : '02-COMP',
        MEDIO: d.medio, SERIE: d.serie, 'N° FACTURA': d.numero, 'N° CONTROL': d.numeroControl ?? '',
        'FACTURA AFECTADA': d.referencia?.numero ?? '', 'RIF / CÉDULA': d.receptorDocumento, 'NOMBRE O RAZÓN SOCIAL': d.receptorNombre,
        'TOTAL VENTA CON IVA': primera ? centsToNumber(s * t.total.bs) : 0,
        'VENTAS EXENTAS': primera ? centsToNumber(s * t.exento.bs) : 0,
        'BASE IMPONIBLE': centsToNumber(s * a.base.bs), '% ALÍCUOTA': a.pct, IVA: centsToNumber(s * a.iva.bs),
        IGTF: primera ? centsToNumber(s * igtf) : 0,
        'IVA RETENIDO': primera ? centsToNumber(d.ivaRetenido) : 0, 'N° COMPROBANTE RETENCIÓN': primera ? d.comprobanteRetencion ?? '' : '',
      });
      if (a.pct > 0) {
        const x = porAlicuota.get(a.pct) ?? { alicuota: a.pct, base: 0, iva: 0 };
        porAlicuota.set(a.pct, { alicuota: a.pct, base: x.base + s * a.base.bs, iva: x.iva + s * a.iva.bs });
      }
    });
    r.documentos++;
    r.exento += s * t.exento.bs;
    r.igtf += s * igtf;
    r.total += s * t.total.bs;
    r.ivaRetenido += d.ivaRetenido;
  }
  r.alicuotas = [...porAlicuota.values()].sort((a, b) => b.alicuota - a.alicuota);
  return { filas, resumen: r };
}
