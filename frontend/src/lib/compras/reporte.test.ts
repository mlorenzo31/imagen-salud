import { describe, expect, it } from 'vitest';
import { armarReporte, filasLibroCompras, type FacturaLibro, type MovCaja } from './reporte';

const movs: MovCaja[] = [
  { fecha: '2026-10-01', tipo: 'INGRESO_FACTURA', bs: 1000000, usd: 1000 },
  { fecha: '2026-10-02', tipo: 'INGRESO_EXTRA', bs: 200000, usd: 200 },
  { fecha: '2026-10-02', tipo: 'PAGO_COMPRA', bs: 300000, usd: 300, proveedor: 'ACME' },
  { fecha: '2026-10-03', tipo: 'GASTO_MENOR', bs: 50000, usd: 50, categoria: 'Limpieza' },
  { fecha: '2026-10-03', tipo: 'HONORARIOS', bs: 400000, usd: 400 },
  { fecha: '2026-10-03', tipo: 'COMISION', bs: 1000, usd: 1 },
];

describe('armarReporte', () => {
  const r = armarReporte(movs, [{ proveedor: 'ACME', bs: 80000, usd: 80 }], [], '2026-10-01', '2026-10-03');
  it('resultado = ingresos − egresos, y lo comprometido no resta', () => {
    expect(r.ingresos).toEqual({ bs: 1200000, usd: 1200 });
    expect(r.egresos.total).toEqual({ bs: 751000, usd: 751 });
    expect(r.resultado).toEqual({ bs: 449000, usd: 449 });
    expect(r.comprometido).toEqual({ bs: 80000, usd: 80 });
    expect(r.egresos.porTipo.PAGO_COMPRA).toEqual({ bs: 300000, usd: 300 });
  });
  it('detalla por proveedor (pagado y pendiente) y por categoría', () => {
    expect(r.porProveedor).toEqual([{ proveedor: 'ACME', pagadoBs: 300000, pagadoUsd: 300, pendienteBs: 80000, pendienteUsd: 80 }]);
    expect(r.porCategoria.find((c) => c.categoria === 'Limpieza')).toEqual({ categoria: 'Limpieza', bs: 50000, usd: 50 });
  });
  it('agrupa por día en rangos cortos y por mes en largos', () => {
    expect(r.porPeriodo.map((p) => p.periodo)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(armarReporte(movs, [], [], '2026-08-01', '2026-10-31').porPeriodo.map((p) => p.periodo)).toEqual(['2026-10']);
  });
});

describe('filasLibroCompras', () => {
  const base: FacturaLibro = {
    fecha: '2026-10-05', rif: 'J-12345678-9', razon_social: 'ACME', numero_factura: '0001', numero_control: '00-01', estado: 'PAGADA',
    moneda: 'BS', tasa: 877, base_exenta: 5000, total: 18760, iva_retenido: 1320, comprobante: '20261000000001',
    detalle_iva: [{ alicuota: 16, base: 10000, iva: 1600 }, { alicuota: 8, base: 2000, iva: 160 }],
  };
  it('una fila por alícuota; exento y totales solo en la primera', () => {
    const { filas, totales } = filasLibroCompras([base]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ 'TIPO TRANSACCIÓN': '01-REG', 'TOTAL COMPRA CON IVA': 187.6, 'COMPRAS EXENTAS': 50, 'BASE IMPONIBLE': 100, '% ALÍCUOTA': 16, IVA: 16, 'IVA RETENIDO': 13.2 });
    expect(filas[1]).toMatchObject({ 'TOTAL COMPRA CON IVA': 0, 'COMPRAS EXENTAS': 0, 'BASE IMPONIBLE': 20, '% ALÍCUOTA': 8, IVA: 1.6, 'IVA RETENIDO': 0 });
    expect(totales).toEqual([{ alicuota: 16, base: 10000, iva: 1600 }, { alicuota: 8, base: 2000, iva: 160 }]);
  });
  it('anulada: tipo 03-ANU con montos en cero', () => {
    const { filas } = filasLibroCompras([{ ...base, estado: 'ANULADA' }]);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ 'TIPO TRANSACCIÓN': '03-ANU', 'TOTAL COMPRA CON IVA': 0, 'BASE IMPONIBLE': 0, IVA: 0 });
  });
  it('factura en $ se expresa en Bs a la tasa de la factura', () => {
    const { filas } = filasLibroCompras([{ ...base, moneda: 'USD', tasa: 100, detalle_iva: [{ alicuota: 16, base: 1000, iva: 160 }], base_exenta: 0, total: 1160, iva_retenido: 0 }]);
    expect(filas[0]).toMatchObject({ 'TOTAL COMPRA CON IVA': 1160, 'BASE IMPONIBLE': 1000, IVA: 160 });
  });
  it('solo exenta: una fila con alícuota 0', () => {
    const { filas } = filasLibroCompras([{ ...base, detalle_iva: [], base_exenta: 5000, total: 5000, iva_retenido: 0 }]);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ 'COMPRAS EXENTAS': 50, 'BASE IMPONIBLE': 0, '% ALÍCUOTA': 0 });
  });
});
