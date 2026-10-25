import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

import { emitirDocumento, entradaDesdeCobro, entradaParaCobros, esperaReintento } from './emision';
import { CONFIG_EMISOR_DEFECTO, construirFactura } from './factura';
import { ErrorRechazo, type ProveedorFiscal } from './proveedor';

const EMISOR = { ...CONFIG_EMISOR_DEFECTO, razonSocial: 'DEMO, C.A.', rif: 'J000000000', domicilioFiscal: 'Caracas' };

describe('entradaDesdeCobro', () => {
  const cobro = {
    numero: '00000010', fecha: '2026-10-22', hora: '14:04:07', tasa: '211.67', pagoDivisasUsd: 2000, emisor: EMISOR,
    paciente: { nombre: 'CARLA MÉNDEZ', cedula: 'V18456323', direccion: 'GUATIRE' },
    facturarA: null,
    servicios: [
      { codigo: 'ECO-AM-03', estudio: 'Mamario', area: 'ECOGRAFIA_AM', precioLista: 2000, descuento: 0 },
      { codigo: null, estudio: 'Tórax PA', area: 'RADIOLOGIA', precioLista: 2500, descuento: 500 },
    ],
  };

  it('factura al paciente: nombre, cédula y dirección', () => {
    const e = entradaDesdeCobro(cobro);
    expect(e.receptor).toEqual({ nombre: 'CARLA MÉNDEZ', documento: 'V18456323', domicilio: 'GUATIRE' });
  });

  it('"Facturar a" reemplaza al paciente como receptor', () => {
    const e = entradaDesdeCobro({ ...cobro, facturarA: { razonSocial: 'SEGUROS DEMO, C.A.', rif: 'J123456789', domicilio: 'CARACAS' } });
    expect(e.receptor).toEqual({ nombre: 'SEGUROS DEMO, C.A.', documento: 'J123456789', domicilio: 'CARACAS' });
  });

  it('una línea por servicio: precio de lista, descuento y exento (servicios médicos)', () => {
    const e = entradaDesdeCobro(cobro);
    expect(e.lineas).toEqual([
      { codigo: 'ECO-AM-03', descripcion: 'Mamario', cantidad: 1, precioUnitarioUsd: 2000, descuentoUsd: 0, alicuota: 0 },
      { codigo: 'RADIOLOGIA', descripcion: 'Tórax PA', cantidad: 1, precioUnitarioUsd: 2500, descuentoUsd: 500, alicuota: 0 },
    ]);
    expect(construirFactura(e).totales.total.usd).toBe(4000);
  });

  it('sin N° de control: lo asigna la imprenta al emitir', () => {
    expect(entradaDesdeCobro(cobro).numeroControl).toBeNull();
  });
});

describe('esperaReintento', () => {
  it('crece exponencialmente desde 30 s y se topa en 30 min', () => {
    expect(esperaReintento(1)).toBe(30);
    expect(esperaReintento(2)).toBe(60);
    expect(esperaReintento(3)).toBe(120);
    expect(esperaReintento(20)).toBe(1800);
  });
});

describe('emitirDocumento', () => {
  const documento = construirFactura(entradaDesdeCobro({
    numero: '00000010', fecha: '2026-10-22', hora: '14:04:07', tasa: '211.67', pagoDivisasUsd: 0, emisor: EMISOR,
    paciente: { nombre: 'X', cedula: 'V1234567', direccion: '' }, facturarA: null,
    servicios: [{ codigo: 'A', estudio: 'Estudio', area: 'X', precioLista: 2000, descuento: 0 }],
  }));

  /** BD falsa: la consulta que "toma" el documento devuelve fila si `tomado`; las demás se registran. */
  const bd = (tomado: boolean) => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    return {
      calls,
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        if (/SET estado = 'ENVIANDO'/.test(sql)) return { rows: tomado ? [{ payload: documento, intentos: 1 }] : [] };
        return { rows: [] };
      }),
    };
  };
  const prov = (emitir: ProveedorFiscal['emitir']): ProveedorFiscal => ({ nombre: 'prueba', emitir: vi.fn(emitir), registrarContingencia: vi.fn(async () => ({})) });

  it('éxito: guarda N° de control, fecha, PDF y lo marca EMITIDO', async () => {
    const db = bd(true);
    const p = prov(async () => ({ numeroControl: '00-00000077', fechaAsignacion: '2026-10-22', pdfUrl: 'https://imprenta/77.pdf', qr: 'qr77' }));
    const r = await emitirDocumento(db as never, p, 7, '2026-10-22');
    expect(r).toEqual({ estado: 'EMITIDO', numeroControl: '00-00000077', pdfUrl: 'https://imprenta/77.pdf' });
    expect(p.emitir).toHaveBeenCalledWith({ id: 7, documento, hoy: '2026-10-22' });
    const fin = db.calls[2];
    expect(fin.sql).toMatch(/estado = 'EMITIDO'/);
    expect(fin.params).toEqual(expect.arrayContaining([7, '00-00000077', '2026-10-22', 'https://imprenta/77.pdf', 'qr77', '22/10/2026']));
  });

  it('falla temporal: vuelve a PENDIENTE con reintento programado', async () => {
    const db = bd(true);
    const r = await emitirDocumento(db as never, prov(async () => { throw new Error('timeout'); }), 7, '2026-10-22');
    expect(r).toEqual({ estado: 'PENDIENTE', error: 'timeout' });
    expect(db.calls[2].sql).toMatch(/estado = 'PENDIENTE'/);
    expect(db.calls[2].params).toEqual([7, 'timeout', 30]);
  });

  it('rechazo de la imprenta: queda en ERROR (no se reintenta)', async () => {
    const db = bd(true);
    const r = await emitirDocumento(db as never, prov(async () => { throw new ErrorRechazo('RIF inválido'); }), 7, '2026-10-22');
    expect(r).toEqual({ estado: 'ERROR', error: 'RIF inválido' });
    expect(db.calls[2].sql).toMatch(/estado = 'ERROR'/);
  });

  it('respuesta inválida de la imprenta cuenta como rechazo', async () => {
    const db = bd(true);
    const r = await emitirDocumento(db as never, prov(async () => ({ numeroControl: '77', fechaAsignacion: '2026-10-22' })), 7, '2026-10-22');
    expect(r.estado).toBe('ERROR');
  });

  it('si otro proceso ya lo tomó o ya fue emitido, no lo envía de nuevo', async () => {
    const db = bd(false);
    const p = prov(async () => ({ numeroControl: '00-00000001', fechaAsignacion: '2026-10-22' }));
    expect(await emitirDocumento(db as never, p, 7, '2026-10-22')).toEqual({ estado: 'OMITIDO' });
    expect(p.emitir).not.toHaveBeenCalled();
    expect(db.calls).toHaveLength(2);
  });

  it('antes de tomarlo, una nota cuya factura fue rechazada pasa a ERROR', async () => {
    const db = bd(false);
    await emitirDocumento(db as never, prov(async () => ({ numeroControl: '00-00000001', fechaAsignacion: '2026-10-22' })), 7, '2026-10-22');
    expect(db.calls[0].sql).toMatch(/estado = 'ERROR'.*factura original fue rechazada/s);
    expect(db.calls[0].sql).toMatch(/doc_referencia_id/);
  });

  it('SQL de toma: exige la factura original EMITIDA y actualiza referencia.numeroControl', async () => {
    const db = bd(true);
    await emitirDocumento(db as never, prov(async () => ({ numeroControl: '00-00000002', fechaAsignacion: '2026-10-22' })), 7, '2026-10-22');
    const toma = db.calls[1].sql;
    expect(toma).toMatch(/r\.estado = 'EMITIDO'/);
    expect(toma).toMatch(/jsonb_set\(d\.payload, '\{referencia,numeroControl\}'/);
  });
});

describe('entradaParaCobros (facturar cobros diferidos)', () => {
  const cobroA = { id: 11, paciente: { nombre: 'ANA PÉREZ', cedula: 'V111', direccion: 'CARACAS' }, facturarA: null, pagoDivisasUsd: 2000,
    servicios: [{ codigo: 'ECO-AM-03', estudio: 'Mamario', area: 'ECOGRAFIA_AM', precioLista: 2000, descuento: 0 }] };
  const cobroB = { id: 12, paciente: { nombre: 'LUIS RÍOS', cedula: 'V222', direccion: '' }, facturarA: null, pagoDivisasUsd: 0,
    servicios: [{ codigo: 'RX-02', estudio: 'Tórax PA', area: 'RADIOLOGIA', precioLista: 2500, descuento: 500 }] };
  const comun = { numero: '00000020', fecha: '2026-10-31', hora: '16:00:00', tasa: '215.10', emisor: EMISOR };

  it('un solo cobro: factura al paciente (o a su "Facturar a")', () => {
    const e = entradaParaCobros({ ...comun, cobros: [cobroA], receptor: null });
    expect(e.receptor).toEqual({ nombre: 'ANA PÉREZ', documento: 'V111', domicilio: 'CARACAS' });
    expect(e.lineas[0].descripcion).toBe('Mamario');
    expect(e.tasa).toBe('215.10');
  });

  it('consolidada: un receptor (aseguradora) y una línea por servicio con el paciente', () => {
    const receptor = { razonSocial: 'SEGUROS DEMO, C.A.', rif: 'J123456789', domicilio: 'CARACAS' };
    const e = entradaParaCobros({ ...comun, cobros: [cobroA, cobroB], receptor });
    expect(e.receptor).toEqual({ nombre: 'SEGUROS DEMO, C.A.', documento: 'J123456789', domicilio: 'CARACAS' });
    expect(e.lineas.map((l) => l.descripcion)).toEqual(['Mamario — ANA PÉREZ (V111)', 'Tórax PA — LUIS RÍOS (V222)']);
    expect(e.pagoDivisasUsd).toBe(2000);
    expect(construirFactura(e).totales.total.usd).toBe(4000);
  });

  it('consolidar varios cobros exige el receptor', () => {
    expect(() => entradaParaCobros({ ...comun, cobros: [cobroA, cobroB], receptor: null })).toThrow(/receptor/i);
  });
  it('exige al menos un cobro', () => {
    expect(() => entradaParaCobros({ ...comun, cobros: [], receptor: null })).toThrow();
  });
});
