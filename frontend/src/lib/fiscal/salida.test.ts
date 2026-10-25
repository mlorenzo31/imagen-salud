import { describe, expect, it } from 'vitest';
import { CONFIG_EMISOR_DEFECTO } from './factura';
import { verificarSalida, VIGENCIA, type DatosSalida } from './salida';

const listo: DatosSalida = {
  hoy: '2027-03-20',
  emisor: {
    ...CONFIG_EMISOR_DEFECTO, razonSocial: 'CLINICA X C.A.', rif: 'J123456789', domicilioFiscal: 'Caracas', inicioFacturacion: '2027-04-01',
    imprenta: { razonSocial: 'IMPRENTA D C.A.', rif: 'J111111111', providencia: 'SNAT/2027/1', fechaProvidencia: '2027-01-10' },
  },
  env: { FISCAL_PROVEEDOR: 'imprentax', NODE_ENV: 'production' },
  talonarios: [{ serie: 'C', disponibles: 400 }],
  estudiosSinCodigo: 0, documentosRechazados: 0, documentosPendientes: 0, contingenciaVencida: false, proveedoresSinCorreo: 0,
};
const estado = (d: DatosSalida, id: string) => verificarSalida(d).items.find((i) => i.id === id)?.estado;

describe('verificarSalida', () => {
  it('todo en orden → lista', () => {
    const r = verificarSalida(listo);
    expect(r.lista).toBe(true);
    expect(r.items.every((i) => i.estado === 'OK')).toBe(true);
  });
  it('datos del emisor incompletos', () => {
    expect(estado({ ...listo, emisor: { ...listo.emisor, rif: '' } }, 'emisor')).toBe('FALTA');
  });
  it('sin imprenta digital configurada', () => {
    expect(estado({ ...listo, emisor: { ...listo.emisor, imprenta: null } }, 'imprenta')).toBe('FALTA');
  });
  it('proveedor: desactivado o simulado en producción falta; simulado fuera de producción es aviso', () => {
    expect(estado({ ...listo, env: { NODE_ENV: 'production' } }, 'proveedor')).toBe('FALTA');
    expect(estado({ ...listo, env: { FISCAL_PROVEEDOR: 'simulado', NODE_ENV: 'production', FISCAL_PERMITIR_SIMULADO: 'true' } }, 'proveedor')).toBe('FALTA');
    expect(estado({ ...listo, env: { FISCAL_PROVEEDOR: 'simulado', NODE_ENV: 'development' } }, 'proveedor')).toBe('AVISO');
  });
  it('inicio de la facturación: requerido y no después de la vigencia', () => {
    expect(estado({ ...listo, emisor: { ...listo.emisor, inicioFacturacion: null } }, 'inicio')).toBe('FALTA');
    expect(estado({ ...listo, emisor: { ...listo.emisor, inicioFacturacion: '2027-05-01' } }, 'inicio')).toBe('FALTA');
    expect(VIGENCIA).toBe('2027-04-19');
  });
  it('talonarios: sin ninguno falta; con pocos formatos avisa', () => {
    expect(estado({ ...listo, talonarios: [] }, 'talonarios')).toBe('FALTA');
    expect(estado({ ...listo, talonarios: [{ serie: 'C', disponibles: 20 }] }, 'talonarios')).toBe('AVISO');
  });
  it('rechazados y contingencia vencida faltan; pendientes, códigos y correos avisan', () => {
    expect(estado({ ...listo, documentosRechazados: 2 }, 'documentos')).toBe('FALTA');
    expect(estado({ ...listo, documentosPendientes: 3 }, 'documentos')).toBe('AVISO');
    expect(estado({ ...listo, contingenciaVencida: true }, 'contingencia')).toBe('FALTA');
    expect(estado({ ...listo, estudiosSinCodigo: 4 }, 'codigos')).toBe('AVISO');
    expect(estado({ ...listo, proveedoresSinCorreo: 1 }, 'correos')).toBe('AVISO');
  });
  it('lista = sin ningún FALTA (los avisos no bloquean); cuenta los días a la vigencia', () => {
    const r = verificarSalida({ ...listo, estudiosSinCodigo: 4 });
    expect(r.lista).toBe(true);
    expect(r.diasParaVigencia).toBe(30);
    expect(verificarSalida({ ...listo, talonarios: [] }).lista).toBe(false);
  });
});
