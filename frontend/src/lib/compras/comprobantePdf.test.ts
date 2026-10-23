import { describe, expect, it } from 'vitest';
import { pdfComprobanteRetencion } from './comprobantePdf';

describe('pdfComprobanteRetencion (art. 18)', () => {
  it('lleva todos los datos exigidos', () => {
    const pdf = pdfComprobanteRetencion({
      numero: '20270300000042', fechaEmision: '2027-03-15', fechaEntrega: '2027-03-16', periodoImposicion: '2027-03',
      agente: { razonSocial: 'CLINICA X C.A.', rif: 'J123456789', domicilio: 'Caracas' },
      proveedor: { razonSocial: 'INSUMOS Y C.A.', rif: 'J987654321', domicilio: 'Valencia', correo: 'ventas@insumos.com' },
      factura: { numero: 'A-001', numeroControl: '00-00001234', fecha: '2027-03-10' },
      montos: { total: 11600, base: 10000, iva: 1600, ivaRetenido: 1200, islrRetenido: 200 },
      leyenda: 'Emitido conforme a la Providencia.',
    });
    const t = new TextDecoder('latin1').decode(pdf);
    expect(t.startsWith('%PDF')).toBe(true);
    for (const x of ['20270300000042', 'J987654321', 'ventas@insumos.com', '00-00001234', 'A-001', '03/2027', '16/03/2027', '12,00']) expect(t).toContain(x);
  });
});
