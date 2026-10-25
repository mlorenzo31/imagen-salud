import { describe, expect, it } from 'vitest';
import {
  estadoContingencia, leerControl, numeroFacturaContingencia, plazoEnvio, rangoControlTexto, talonarioSchema, type RangoTalonario,
} from './contingencia';

const t: RangoTalonario = { serie: 'C', controlDesde: '00-00000101', controlHasta: '00-00000150', facturaDesde: 1, facturaHasta: 50 };

const base = {
  serie: 'C', imprentaRazonSocial: 'Imprenta Ejemplo C.A.', imprentaRif: 'J-123456789', imprentaProvidencia: 'SNAT/2026/0001',
  imprentaFechaProvidencia: '2026-01-10', fechaElaboracion: '2026-10-01',
  controlDesde: '00-00000101', controlHasta: '00-00000150', facturaDesde: 1, facturaHasta: 50,
};

describe('leerControl', () => {
  it('separa identificador y secuencial', () => {
    expect(leerControl('03-00001234')).toEqual({ identificador: 3, secuencial: 1234 });
  });
  it('rechaza formatos inválidos', () => {
    expect(() => leerControl('0300001234')).toThrow(/N° de control/);
    expect(() => leerControl('00-00000000')).toThrow(/N° de control/);
  });
});

describe('numeroFacturaContingencia', () => {
  it('el N° de factura sigue al N° de control dentro del talonario', () => {
    expect(numeroFacturaContingencia(t, '00-00000101')).toBe(1);
    expect(numeroFacturaContingencia(t, '00-00000150')).toBe(50);
    expect(numeroFacturaContingencia(t, '00-00000120')).toBe(20);
  });
  it('fuera del rango o con otro identificador → null', () => {
    expect(numeroFacturaContingencia(t, '00-00000100')).toBeNull();
    expect(numeroFacturaContingencia(t, '00-00000151')).toBeNull();
    expect(numeroFacturaContingencia(t, '01-00000120')).toBeNull();
  });
});

describe('talonarioSchema', () => {
  it('acepta un talonario válido y normaliza la serie', () => {
    const r = talonarioSchema.parse({ ...base, serie: ' c1 ' });
    expect(r.serie).toBe('C1');
  });
  it('rangos de control y de factura del mismo tamaño', () => {
    expect(() => talonarioSchema.parse({ ...base, facturaHasta: 49 })).toThrow(/misma cantidad/);
  });
  it('el control inicial y el final llevan el mismo identificador y van en orden', () => {
    expect(() => talonarioSchema.parse({ ...base, controlHasta: '01-00000150' })).toThrow(/identificador/);
    expect(() => talonarioSchema.parse({ ...base, controlDesde: '00-00000151' })).toThrow(/mayor/);
  });
  it('RIF de la imprenta J/G + 9 dígitos', () => {
    expect(() => talonarioSchema.parse({ ...base, imprentaRif: 'V-12345678' })).toThrow(/RIF/);
  });
});

describe('rangoControlTexto (art. 11.2)', () => {
  it('"N° de Control desde el N° … hasta el N° …"', () => {
    expect(rangoControlTexto(t)).toBe('N° de Control desde el N° 00-00000101 hasta el N° 00-00000150');
  });
});

describe('plazo del art. 7: envío al día siguiente de cesar la contingencia', () => {
  it('plazoEnvio = fin + 1 día (cruza mes y año)', () => {
    expect(plazoEnvio('2027-02-10')).toBe('2027-02-11');
    expect(plazoEnvio('2027-02-28')).toBe('2027-03-01');
    expect(plazoEnvio('2026-12-31')).toBe('2027-01-01');
  });
  it('estados según hoy', () => {
    expect(estadoContingencia({ fechaFin: null, enviada: false }, '2027-02-10')).toBe('ACTIVA');
    expect(estadoContingencia({ fechaFin: '2027-02-10', enviada: false }, '2027-02-10')).toBe('POR_ENVIAR');
    expect(estadoContingencia({ fechaFin: '2027-02-10', enviada: false }, '2027-02-11')).toBe('VENCE_HOY');
    expect(estadoContingencia({ fechaFin: '2027-02-10', enviada: false }, '2027-02-12')).toBe('VENCIDA');
    expect(estadoContingencia({ fechaFin: '2027-02-10', enviada: true }, '2027-02-20')).toBe('ENVIADA');
  });
});

describe('documentoContingencia (art. 11)', () => {
  it('lleva serie, imprenta del talonario, rango de control y fecha de elaboración', async () => {
    const { construirFactura, CONFIG_EMISOR_DEFECTO } = await import('./factura');
    const { documentoContingencia } = await import('./contingencia');
    const emisor = { ...CONFIG_EMISOR_DEFECTO, razonSocial: 'Clínica X C.A.', rif: 'J123456789', domicilioFiscal: 'Caracas' };
    const doc = construirFactura({
      numero: '00000020', numeroControl: '00-00000120', fecha: '2027-02-10', hora: '10:00:00', emisor, tasa: '50',
      pagoDivisasUsd: 0, receptor: { nombre: 'Ana', documento: 'V12345678', domicilio: '' },
      lineas: [{ codigo: 'RX', descripcion: 'Rayos X', cantidad: 1, precioUnitarioUsd: 1000, descuentoUsd: 0, alicuota: 0 }],
    });
    const talon = talonarioSchema.parse(base);
    const r = documentoContingencia(doc, talon);
    expect(r.serie).toBe('C');
    expect(r.numeroControl).toBe('00-00000120');
    expect(r.imprenta).toEqual({ razonSocial: 'Imprenta Ejemplo C.A.', rif: 'J123456789', providencia: 'SNAT/2026/0001', fechaProvidencia: '10/01/2026' });
    expect(r.contingencia).toEqual({ rangoControl: 'N° de Control desde el N° 00-00000101 hasta el N° 00-00000150', fechaElaboracion: '01/10/2026' });
  });
});

describe('rangosSeSolapan', () => {
  it('detecta talonarios con N° de control repetidos', async () => {
    const { rangosSeSolapan } = await import('./contingencia');
    expect(rangosSeSolapan(t, { ...t, controlDesde: '00-00000150', controlHasta: '00-00000200' })).toBe(true);
    expect(rangosSeSolapan(t, { ...t, controlDesde: '00-00000151', controlHasta: '00-00000200' })).toBe(false);
    expect(rangosSeSolapan(t, { ...t, controlDesde: '01-00000101', controlHasta: '01-00000150' })).toBe(false);
  });
});

describe('cumplimientoEnvio (art. 7)', () => {
  it('a tiempo si se remitió a más tardar al día siguiente de cesar', async () => {
    const { cumplimientoEnvio } = await import('./contingencia');
    expect(cumplimientoEnvio('2027-02-10', '2027-02-10')).toBe('A_TIEMPO');
    expect(cumplimientoEnvio('2027-02-10', '2027-02-11')).toBe('A_TIEMPO');
    expect(cumplimientoEnvio('2027-02-10', '2027-02-12')).toBe('TARDE');
    expect(cumplimientoEnvio('2027-02-10', null)).toBe('SIN_ENVIAR');
    expect(cumplimientoEnvio(null, null)).toBe('ACTIVA');
  });
});
