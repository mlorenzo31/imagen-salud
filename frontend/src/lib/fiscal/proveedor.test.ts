import { describe, expect, it } from 'vitest';
import { ErrorRechazo, obtenerProveedor, proveedorSimulado, validarRespuesta } from './proveedor';
import { CONFIG_EMISOR_DEFECTO, construirFactura } from './factura';

const doc = construirFactura({
  numero: '00000001', numeroControl: null, fecha: '2026-10-22', hora: '10:00:00',
  receptor: { nombre: 'PACIENTE', documento: 'V1234567' },
  lineas: [{ codigo: 'A', descripcion: 'Estudio', cantidad: 1, precioUnitarioUsd: 2000, descuentoUsd: 0, alicuota: 0 }],
  tasa: '211.67', pagoDivisasUsd: 0,
  emisor: { ...CONFIG_EMISOR_DEFECTO, razonSocial: 'DEMO, C.A.', rif: 'J000000000', domicilioFiscal: 'Caracas' },
});

describe('obtenerProveedor', () => {
  it('sin FISCAL_PROVEEDOR la emisión fiscal está desactivada', () => {
    expect(obtenerProveedor({})).toBeNull();
    expect(obtenerProveedor({ FISCAL_PROVEEDOR: '  ' })).toBeNull();
  });
  it('el simulado se permite fuera de producción', () => {
    expect(obtenerProveedor({ FISCAL_PROVEEDOR: 'simulado', NODE_ENV: 'development' })?.nombre).toBe('simulado');
  });
  it('en producción el simulado exige permiso explícito (sus números de control no son fiscales)', () => {
    expect(() => obtenerProveedor({ FISCAL_PROVEEDOR: 'simulado', NODE_ENV: 'production' })).toThrow(/simulado/i);
    expect(obtenerProveedor({ FISCAL_PROVEEDOR: 'simulado', NODE_ENV: 'production', FISCAL_PERMITIR_SIMULADO: 'true' })?.nombre).toBe('simulado');
  });
  it('un proveedor desconocido es un error de configuración', () => {
    expect(() => obtenerProveedor({ FISCAL_PROVEEDOR: 'otra' })).toThrow(/desconocido/i);
  });
});

describe('proveedorSimulado', () => {
  it('asigna un N° de control determinista por documento (idempotente ante reintentos)', async () => {
    const a = await proveedorSimulado.emitir({ id: 365, documento: doc, hoy: '2026-10-22' });
    const b = await proveedorSimulado.emitir({ id: 365, documento: doc, hoy: '2026-10-22' });
    expect(a).toEqual(b);
    expect(a.numeroControl).toBe('00-00000365');
    expect(a.fechaAsignacion).toBe('2026-10-22');
  });
});

describe('validarRespuesta', () => {
  it('acepta una respuesta con N° de control y fecha válidos', () => {
    expect(validarRespuesta({ numeroControl: '00-00000001', fechaAsignacion: '2026-10-22', pdfUrl: 'https://x/1.pdf' }).pdfUrl).toBe('https://x/1.pdf');
  });
  it('rechaza un N° de control mal formado', () => {
    expect(() => validarRespuesta({ numeroControl: '1', fechaAsignacion: '2026-10-22' })).toThrow(ErrorRechazo);
  });
  it('rechaza una fecha de asignación inválida', () => {
    expect(() => validarRespuesta({ numeroControl: '00-00000001', fechaAsignacion: '22/10/2026' })).toThrow(ErrorRechazo);
  });
});
