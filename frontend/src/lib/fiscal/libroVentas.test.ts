import { describe, expect, it } from 'vitest';
import { libroVentas, type DocLibro } from './libroVentas';

const par = (bs: number) => ({ usd: 0, bs });
const totales = (o: { exento?: number; alicuotas?: Array<[number, number, number]>; igtf?: number }) => {
  const exento = o.exento ?? 0;
  const alic = (o.alicuotas ?? []).map(([pct, base, iva]) => ({ pct, base: par(base), iva: par(iva) }));
  const total = exento + alic.reduce((a, x) => a + x.base.bs + x.iva.bs, 0) + (o.igtf ?? 0);
  return {
    exento: par(exento), alicuotas: alic, descuentos: par(0), iva: par(alic.reduce((a, x) => a + x.iva.bs, 0)),
    igtf: o.igtf ? { pct: 3, base: par(0), monto: par(o.igtf) } : null, total: par(total),
  };
};
const doc = (o: Partial<DocLibro>): DocLibro => ({
  id: 1, tipo: 'FACTURA', serie: '', numero: '00000001', numeroControl: '00-00000001', fecha: '2027-03-05', medio: 'DIGITAL',
  receptorNombre: 'ANA', receptorDocumento: 'V12345678', totales: totales({ exento: 10000 }), referencia: null,
  ivaRetenido: 0, comprobanteRetencion: null, ...o,
});

describe('libroVentas', () => {
  it('factura exenta: una fila 01-REG con ventas exentas', () => {
    const r = libroVentas([doc({})]);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({ 'TIPO TRANSACCIÓN': '01-REG', 'N° FACTURA': '00000001', 'N° CONTROL': '00-00000001', 'VENTAS EXENTAS': 100, 'TOTAL VENTA CON IVA': 100 });
    expect(r.resumen.exento).toBe(10000);
  });

  it('una fila por alícuota; los totales del documento solo en la primera', () => {
    const r = libroVentas([doc({ totales: totales({ exento: 500, alicuotas: [[16, 1000, 160], [8, 2000, 160]] }) })]);
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toMatchObject({ '% ALÍCUOTA': 16, 'BASE IMPONIBLE': 10, IVA: 1.6, 'VENTAS EXENTAS': 5, 'TOTAL VENTA CON IVA': 38.2 });
    expect(r.filas[1]).toMatchObject({ '% ALÍCUOTA': 8, 'BASE IMPONIBLE': 20, IVA: 1.6, 'VENTAS EXENTAS': 0, 'TOTAL VENTA CON IVA': 0 });
    expect(r.resumen.alicuotas).toEqual([{ alicuota: 16, base: 1000, iva: 160 }, { alicuota: 8, base: 2000, iva: 160 }]);
  });

  it('la nota de crédito resta, es 02-COMP y cita la factura afectada', () => {
    const r = libroVentas([
      doc({}),
      doc({ id: 2, tipo: 'NOTA_CREDITO', numero: '00000001', numeroControl: '00-00000002', referencia: { numero: '00000001', numeroControl: '00-00000001' } }),
    ]);
    expect(r.filas[1]).toMatchObject({ 'TIPO DOCUMENTO': 'NC', 'TIPO TRANSACCIÓN': '02-COMP', 'FACTURA AFECTADA': '00000001', 'VENTAS EXENTAS': -100 });
    expect(r.resumen.exento).toBe(0);
    expect(r.resumen.total).toBe(0);
  });

  it('nota de débito suma', () => {
    const r = libroVentas([doc({ tipo: 'NOTA_DEBITO', referencia: { numero: '00000001', numeroControl: '00-00000001' } })]);
    expect(r.filas[0]).toMatchObject({ 'TIPO DOCUMENTO': 'ND', 'VENTAS EXENTAS': 100 });
  });

  it('marca la contingencia con la serie del talonario y lleva IGTF y la retención recibida', () => {
    const r = libroVentas([doc({ medio: 'CONTINGENCIA', serie: 'C', totales: totales({ exento: 10000, igtf: 300 }), ivaRetenido: 0, comprobanteRetencion: '20270300000009' })]);
    expect(r.filas[0]).toMatchObject({ MEDIO: 'CONTINGENCIA', SERIE: 'C', IGTF: 3, 'N° COMPROBANTE RETENCIÓN': '20270300000009' });
    expect(r.resumen.igtf).toBe(300);
  });

  it('ordena por fecha, serie y número', () => {
    const r = libroVentas([doc({ id: 2, numero: '00000002', fecha: '2027-03-06' }), doc({ id: 1, numero: '00000001', fecha: '2027-03-06' }), doc({ id: 3, numero: '00000009', fecha: '2027-03-01' })]);
    expect(r.filas.map((f) => f['N° FACTURA'])).toEqual(['00000009', '00000001', '00000002']);
  });
});
