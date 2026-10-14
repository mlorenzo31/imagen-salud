import { centsToNumber, mulRate } from '@/lib/money';

/** Reporte de egresos contra ingresos y Libro de Compras. Puro (sin servidor): montos en centavos. */

export type TipoMovCaja = 'INGRESO_FACTURA' | 'INGRESO_EXTRA' | 'PAGO_COMPRA' | 'GASTO_MENOR' | 'HONORARIOS' | 'COMISION';
/** Entrada o salida real de dinero: `bs` y `usd` son equivalentes a la tasa de su día. */
export interface MovCaja { fecha: string; tipo: TipoMovCaja; bs: number; usd: number; proveedor?: string; categoria?: string }
export interface Monto { bs: number; usd: number }
export interface LineaReporte { producto: string; categoria: string; cantidad: number /* milésimas */; bs: number; usd: number }

const INGRESOS: TipoMovCaja[] = ['INGRESO_FACTURA', 'INGRESO_EXTRA'];
const CATEGORIA_TIPO: Partial<Record<TipoMovCaja, string>> = {
  PAGO_COMPRA: 'Compras con factura', HONORARIOS: 'Honorarios médicos', COMISION: 'Comisiones bancarias',
};
const sumar = (a: Monto, b: Monto): Monto => ({ bs: a.bs + b.bs, usd: a.usd + b.usd });
const CERO: Monto = { bs: 0, usd: 0 };

export function armarReporte(movs: MovCaja[], porPagar: { proveedor: string; bs: number; usd: number }[], lineas: LineaReporte[], desde: string, hasta: string) {
  let ingresos = CERO;
  let total = CERO;
  const porTipo: Partial<Record<TipoMovCaja, Monto>> = {};
  const proveedores = new Map<string, { pagadoBs: number; pagadoUsd: number; pendienteBs: number; pendienteUsd: number }>();
  const categorias = new Map<string, Monto>();
  const periodos = new Map<string, { ingresos: number; egresos: number }>();
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1;
  const periodoDe = (f: string) => (dias <= 31 ? f : f.slice(0, 7));
  const prov = (n: string) => {
    if (!proveedores.has(n)) proveedores.set(n, { pagadoBs: 0, pagadoUsd: 0, pendienteBs: 0, pendienteUsd: 0 });
    return proveedores.get(n)!;
  };

  for (const m of movs) {
    const p = periodos.get(periodoDe(m.fecha)) ?? { ingresos: 0, egresos: 0 };
    periodos.set(periodoDe(m.fecha), p);
    if (INGRESOS.includes(m.tipo)) { ingresos = sumar(ingresos, m); p.ingresos += m.usd; continue; }
    total = sumar(total, m);
    p.egresos += m.usd;
    porTipo[m.tipo] = sumar(porTipo[m.tipo] ?? CERO, m);
    if (m.tipo === 'PAGO_COMPRA' && m.proveedor) { const x = prov(m.proveedor); x.pagadoBs += m.bs; x.pagadoUsd += m.usd; }
    const cat = m.categoria ?? CATEGORIA_TIPO[m.tipo] ?? 'Otros';
    categorias.set(cat, sumar(categorias.get(cat) ?? CERO, m));
  }
  for (const d of porPagar) { const x = prov(d.proveedor); x.pendienteBs += d.bs; x.pendienteUsd += d.usd; }
  const comprometido = porPagar.reduce((a, d) => sumar(a, d), CERO);

  const productos = new Map<string, LineaReporte>();
  for (const l of lineas) {
    const k = `${l.categoria}|${l.producto}`;
    const x = productos.get(k) ?? { ...l, cantidad: 0, bs: 0, usd: 0 };
    productos.set(k, { ...x, cantidad: x.cantidad + l.cantidad, bs: x.bs + l.bs, usd: x.usd + l.usd });
  }

  return {
    ingresos,
    egresos: { total, porTipo },
    resultado: { bs: ingresos.bs - total.bs, usd: ingresos.usd - total.usd },
    comprometido,
    porProveedor: [...proveedores.entries()].map(([proveedor, v]) => ({ proveedor, ...v })).sort((a, b) => b.pagadoUsd + b.pendienteUsd - a.pagadoUsd - a.pendienteUsd),
    porCategoria: [...categorias.entries()].map(([categoria, v]) => ({ categoria, ...v })).sort((a, b) => b.usd - a.usd),
    porProducto: [...productos.values()].sort((a, b) => b.usd - a.usd),
    porPeriodo: [...periodos.entries()].sort().map(([periodo, v]) => ({ periodo, ...v })),
  };
}

/** Factura para el Libro de Compras: montos en centavos de su moneda; `detalle_iva` por alícuota. */
export interface FacturaLibro {
  fecha: string; rif: string; razon_social: string; numero_factura: string; numero_control: string | null; estado: string;
  moneda: 'BS' | 'USD'; tasa: number; base_exenta: number; total: number; iva_retenido: number; comprobante: string | null;
  detalle_iva: { alicuota: number; base: number; iva: number }[];
}

/** Filas del Libro de Compras (Bs): una por alícuota; total, exento y retención en la primera. Anuladas en cero. */
export function filasLibroCompras(facturas: FacturaLibro[]) {
  const totales = new Map<number, { alicuota: number; base: number; iva: number }>();
  const filas: Record<string, string | number>[] = [];
  for (const f of facturas) {
    const bs = (c: number) => (f.moneda === 'USD' ? mulRate(c, f.tasa) : c);
    const anulada = f.estado === 'ANULADA';
    const tramos = anulada || f.detalle_iva.length === 0 ? [{ alicuota: 0, base: 0, iva: 0 }] : f.detalle_iva;
    tramos.forEach((t, i) => {
      const primera = i === 0 && !anulada;
      const base = anulada ? 0 : bs(t.base);
      const iva = anulada ? 0 : bs(t.iva);
      filas.push({
        FECHA: f.fecha, RIF: f.rif, 'RAZÓN SOCIAL': f.razon_social, 'N° FACTURA': f.numero_factura, 'N° CONTROL': f.numero_control ?? '',
        'TIPO TRANSACCIÓN': anulada ? '03-ANU' : '01-REG',
        'TOTAL COMPRA CON IVA': primera ? centsToNumber(bs(f.total)) : 0,
        'COMPRAS EXENTAS': primera ? centsToNumber(bs(f.base_exenta)) : 0,
        'BASE IMPONIBLE': centsToNumber(base), '% ALÍCUOTA': t.alicuota, IVA: centsToNumber(iva),
        'IVA RETENIDO': primera ? centsToNumber(bs(f.iva_retenido)) : 0, 'N° COMPROBANTE': primera ? f.comprobante ?? '' : '',
      });
      if (!anulada && t.alicuota > 0) {
        const x = totales.get(t.alicuota) ?? { alicuota: t.alicuota, base: 0, iva: 0 };
        totales.set(t.alicuota, { alicuota: t.alicuota, base: x.base + base, iva: x.iva + iva });
      }
    });
  }
  return { filas, totales: [...totales.values()].sort((a, b) => b.alicuota - a.alicuota) };
}
