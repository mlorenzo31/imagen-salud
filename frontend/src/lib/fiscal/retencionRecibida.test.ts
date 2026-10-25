import { describe, expect, it } from 'vitest';
import { retencionRecibidaSchema, validarContraFactura } from './retencionRecibida';

const base = {
  agenteRif: 'J-123456789', agenteRazonSocial: 'Seguros Ejemplo C.A.', numeroComprobante: '20270300000042',
  fechaComprobante: '2027-03-20', facturaNumero: '00000015', ivaRetenido: '0', islrRetenido: '45.50',
};

describe('retencionRecibidaSchema', () => {
  it('normaliza RIF y montos a centavos', () => {
    const r = retencionRecibidaSchema.parse(base);
    expect(r).toMatchObject({ agenteRif: 'J123456789', ivaRetenido: 0, islrRetenido: 4550, numeroComprobante: '20270300000042' });
  });
  it('el N° de comprobante del agente sigue el art. 18 (14 dígitos AAAAMMSSSSSSSS)', () => {
    expect(() => retencionRecibidaSchema.parse({ ...base, numeroComprobante: '2027030000042' })).toThrow(/art. 18/);
  });
  it('algo tiene que estar retenido', () => {
    expect(() => retencionRecibidaSchema.parse({ ...base, islrRetenido: '0' })).toThrow(/monto retenido/);
  });
});

describe('validarContraFactura', () => {
  const factura = { ivaBs: 0, baseBs: 1_000_000, receptorDocumento: 'J123456789', anulada: false };
  it('servicio exento: no admite IVA retenido', () => {
    expect(validarContraFactura({ ivaRetenido: 100, islrRetenido: 0, agenteRif: 'J123456789' }, factura)).toMatch(/IVA/);
  });
  it('ISLR retenido no puede superar la base', () => {
    expect(validarContraFactura({ ivaRetenido: 0, islrRetenido: 1_000_001, agenteRif: 'J123456789' }, factura)).toMatch(/ISLR/);
  });
  it('el agente debe ser el receptor de la factura', () => {
    expect(validarContraFactura({ ivaRetenido: 0, islrRetenido: 2000, agenteRif: 'J999999999' }, factura)).toMatch(/receptor/);
  });
  it('factura anulada no admite retención', () => {
    expect(validarContraFactura({ ivaRetenido: 0, islrRetenido: 2000, agenteRif: 'J123456789' }, { ...factura, anulada: true })).toMatch(/anulada/);
  });
  it('suma las retenciones ya registradas sobre la misma factura', () => {
    expect(validarContraFactura({ ivaRetenido: 0, islrRetenido: 600_000, agenteRif: 'J123456789' }, { ...factura, islrPrevio: 500_000 })).toMatch(/ISLR/);
    expect(validarContraFactura({ ivaRetenido: 0, islrRetenido: 500_000, agenteRif: 'J123456789' }, { ...factura, islrPrevio: 500_000 })).toBeNull();
  });
  it('válida', () => {
    expect(validarContraFactura({ ivaRetenido: 0, islrRetenido: 2000, agenteRif: 'J123456789' }, factura)).toBeNull();
  });
});
