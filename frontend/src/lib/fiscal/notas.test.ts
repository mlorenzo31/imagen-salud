import { describe, expect, it } from 'vitest';
import { CONFIG_EMISOR_DEFECTO, construirFactura } from './factura';
import { entradaParaCobros, type CobroDiferido } from './emision';
import { notaAjuste, notaCreditoPorAnulacion } from './notas';

const EMISOR = { ...CONFIG_EMISOR_DEFECTO, razonSocial: 'DEMO, C.A.', rif: 'J000000000', domicilioFiscal: 'Caracas' };
const cobroA: CobroDiferido = { id: 11, paciente: { nombre: 'ANA PÉREZ', cedula: 'V111', direccion: '' }, facturarA: null, pagoDivisasUsd: 0,
  servicios: [{ codigo: 'ECO-AM-03', estudio: 'Mamario', area: 'ECOGRAFIA_AM', precioLista: 2000, descuento: 0 }] };
const cobroB: CobroDiferido = { id: 12, paciente: { nombre: 'LUIS RÍOS', cedula: 'V222', direccion: '' }, facturarA: null, pagoDivisasUsd: 0,
  servicios: [{ codigo: 'RX-02', estudio: 'Tórax PA', area: 'RADIOLOGIA', precioLista: 2500, descuento: 500 }] };
const comun = { fecha: '2026-10-22', hora: '09:00:00', tasa: '211.67', emisor: EMISOR };
const nc = { fecha: '2026-10-23', hora: '10:00:00', emisor: EMISOR, numero: '00000001', motivo: 'Estudio no realizado' };

describe('notaCreditoPorAnulacion', () => {
  it('factura de un solo cobro: acredita todas sus líneas con su tipo de cambio', () => {
    const original = { ...construirFactura(entradaParaCobros({ ...comun, numero: '00000010', cobros: [cobroB], receptor: null })), numeroControl: '00-00000040' };
    const n = notaCreditoPorAnulacion({ ...nc, original, cobro: cobroB, consolidada: false, acreditadoPrevioUsd: 0 });
    expect(n.denominacion).toBe('Nota de Crédito');
    expect(n.lineas.map((l) => l.descripcion)).toEqual(['Tórax PA (E)']);
    expect(n.totales.total).toEqual(original.totales.total);
    expect(n.tipoCambio).toBe('211.67');
    expect(n.referencia).toEqual({ numero: '00000010', numeroControl: '00-00000040', fechaEmision: '22/10/2026', total: original.totales.total });
    expect(n.motivo).toBe('Anulación del cobro #12: Estudio no realizado');
  });

  it('factura consolidada: solo las líneas del paciente anulado', () => {
    const receptor = { razonSocial: 'SEGUROS DEMO, C.A.', rif: 'J123456789' };
    const original = construirFactura(entradaParaCobros({ ...comun, numero: '00000011', cobros: [cobroA, cobroB], receptor }));
    const n = notaCreditoPorAnulacion({ ...nc, original, cobro: cobroB, consolidada: true, acreditadoPrevioUsd: 0 });
    expect(n.lineas.map((l) => l.descripcion)).toEqual(['Tórax PA — LUIS RÍOS (V222) (E)']);
    expect(n.totales.total.usd).toBe(2000);
    expect(n.receptor.nombre).toBe('SEGUROS DEMO, C.A.');
  });

  it('no acredita más que el saldo de la factura', () => {
    const original = construirFactura(entradaParaCobros({ ...comun, numero: '00000010', cobros: [cobroB], receptor: null }));
    expect(() => notaCreditoPorAnulacion({ ...nc, original, cobro: cobroB, consolidada: false, acreditadoPrevioUsd: 1 })).toThrow(/excede/);
  });
});

describe('notaAjuste (notas manuales)', () => {
  const original = construirFactura(entradaParaCobros({ ...comun, numero: '00000010', cobros: [cobroA], receptor: null }));

  it('nota de crédito parcial con una línea de ajuste exenta', () => {
    const n = notaAjuste({ ...nc, tipo: 'NOTA_CREDITO', original, montoUsd: 500, acreditadoPrevioUsd: 0, motivo: 'Descuento posterior' });
    expect(n.lineas).toHaveLength(1);
    expect(n.lineas[0]).toMatchObject({ codigo: 'AJUSTE', descripcion: 'Descuento posterior (E)', monto: { usd: 500, bs: 105835 } });
  });

  it('nota de débito por un cargo adicional', () => {
    const n = notaAjuste({ ...nc, tipo: 'NOTA_DEBITO', original, montoUsd: 1000, acreditadoPrevioUsd: 0, motivo: 'Proyección adicional' });
    expect(n.denominacion).toBe('Nota de Débito');
    expect(n.totales.total.usd).toBe(1000);
  });

  it('rechaza montos no positivos', () => {
    expect(() => notaAjuste({ ...nc, tipo: 'NOTA_CREDITO', original, montoUsd: 0, acreditadoPrevioUsd: 0, motivo: 'x' })).toThrow();
  });
});

describe('serviciosDeJson', () => {
  it('convierte el JSON de facturas_caja a centavos con precio de lista y descuento', async () => {
    const { serviciosDeJson } = await import('./cobros');
    expect(serviciosDeJson([{ codigo: 'RX-02', estudio: 'Tórax PA', area: 'RADIOLOGIA', precioUSD: 20, precioLista: 25 }, { estudio: 'X', area: 'Y', precioUSD: 10 }]))
      .toEqual([
        { codigo: 'RX-02', estudio: 'Tórax PA', area: 'RADIOLOGIA', precioLista: 2500, descuento: 500 },
        { codigo: null, estudio: 'X', area: 'Y', precioLista: 1000, descuento: 0 },
      ]);
    expect(serviciosDeJson(null)).toEqual([]);
  });
});
