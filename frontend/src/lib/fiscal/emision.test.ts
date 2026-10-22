import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

import { emitirDocumento, entradaDesdeCobro, esperaReintento } from './emision';
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

  /** BD falsa: la 1.ª consulta "toma" el documento; las siguientes se registran. */
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
  const prov = (emitir: ProveedorFiscal['emitir']): ProveedorFiscal => ({ nombre: 'prueba', emitir: vi.fn(emitir) });

  it('éxito: guarda N° de control, fecha, PDF y lo marca EMITIDO', async () => {
    const db = bd(true);
    const p = prov(async () => ({ numeroControl: '00-00000077', fechaAsignacion: '2026-10-22', pdfUrl: 'https://imprenta/77.pdf', qr: 'qr77' }));
    const r = await emitirDocumento(db as never, p, 7, '2026-10-22');
    expect(r).toEqual({ estado: 'EMITIDO', numeroControl: '00-00000077', pdfUrl: 'https://imprenta/77.pdf' });
    expect(p.emitir).toHaveBeenCalledWith({ id: 7, documento, hoy: '2026-10-22' });
    const fin = db.calls[1];
    expect(fin.sql).toMatch(/estado = 'EMITIDO'/);
    expect(fin.params).toEqual(expect.arrayContaining([7, '00-00000077', '2026-10-22', 'https://imprenta/77.pdf', 'qr77', '22/10/2026']));
  });

  it('falla temporal: vuelve a PENDIENTE con reintento programado', async () => {
    const db = bd(true);
    const r = await emitirDocumento(db as never, prov(async () => { throw new Error('timeout'); }), 7, '2026-10-22');
    expect(r).toEqual({ estado: 'PENDIENTE', error: 'timeout' });
    expect(db.calls[1].sql).toMatch(/estado = 'PENDIENTE'/);
    expect(db.calls[1].params).toEqual([7, 'timeout', 30]);
  });

  it('rechazo de la imprenta: queda en ERROR (no se reintenta)', async () => {
    const db = bd(true);
    const r = await emitirDocumento(db as never, prov(async () => { throw new ErrorRechazo('RIF inválido'); }), 7, '2026-10-22');
    expect(r).toEqual({ estado: 'ERROR', error: 'RIF inválido' });
    expect(db.calls[1].sql).toMatch(/estado = 'ERROR'/);
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
    expect(db.calls).toHaveLength(1);
  });
});
