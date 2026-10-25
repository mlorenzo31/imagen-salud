import { describe, expect, it } from 'vitest';
import { configEmisorSchema, leerConfigGuardada, receptorAlternoSchema } from './configEmisor';
import { CONFIG_EMISOR_DEFECTO } from './factura';

const valida = {
  razonSocial: 'Centro Clínico Demo, C.A.',
  rif: 'j-00000000-0',
  domicilioFiscal: 'Av. Principal, Caracas',
  condicionIva: 'FORMAL',
  percibeIgtf: false,
  igtfPct: 3,
  leyendaProvidencia: 'Emitida conforme a la Providencia Administrativa SNAT/2026/000123.',
  imprenta: null,
};

describe('configEmisorSchema', () => {
  it('normaliza el RIF y conserva el resto', () => {
    const c = configEmisorSchema.parse(valida);
    expect(c.rif).toBe('J000000000');
    expect(c.condicionIva).toBe('FORMAL');
  });

  it('exige un RIF jurídico o gubernamental válido para el emisor', () => {
    expect(() => configEmisorSchema.parse({ ...valida, rif: 'V12345678' })).toThrow();
    expect(() => configEmisorSchema.parse({ ...valida, rif: 'J123' })).toThrow();
  });

  it('solo admite condición ORDINARIO o FORMAL', () => {
    expect(() => configEmisorSchema.parse({ ...valida, condicionIva: 'ESPECIAL' })).toThrow();
  });

  it('valida los datos de la imprenta digital cuando se informan', () => {
    const imprenta = { razonSocial: 'Imprenta Demo, C.A.', rif: 'J111111111', providencia: 'SNAT/2024/000999', fechaProvidencia: '2024-12-19' };
    expect(configEmisorSchema.parse({ ...valida, imprenta }).imprenta).toEqual(imprenta);
    expect(() => configEmisorSchema.parse({ ...valida, imprenta: { ...imprenta, fechaProvidencia: '19/12/2024' } })).toThrow();
  });

  it('rechaza un IGTF fuera de rango', () => {
    expect(() => configEmisorSchema.parse({ ...valida, igtfPct: 0 })).toThrow();
    expect(() => configEmisorSchema.parse({ ...valida, igtfPct: 50 })).toThrow();
  });
});

describe('leerConfigGuardada', () => {
  it('sin nada guardado devuelve los valores por defecto', () => {
    expect(leerConfigGuardada(undefined)).toEqual(CONFIG_EMISOR_DEFECTO);
  });
  it('completa con valores por defecto lo que falte', () => {
    expect(leerConfigGuardada({ razonSocial: 'X' })).toEqual({ ...CONFIG_EMISOR_DEFECTO, razonSocial: 'X' });
  });
});

describe('receptorAlternoSchema ("Facturar a")', () => {
  it('acepta empresa con RIF y normaliza', () => {
    expect(receptorAlternoSchema.parse({ razonSocial: ' Seguros Demo ', rif: 'j-12345678-9', domicilio: 'Caracas' }))
      .toEqual({ razonSocial: 'Seguros Demo', rif: 'J123456789', domicilio: 'Caracas' });
  });
  it('exige razón social y RIF', () => {
    expect(() => receptorAlternoSchema.parse({ razonSocial: '', rif: 'J123456789' })).toThrow();
    expect(() => receptorAlternoSchema.parse({ razonSocial: 'X', rif: '123' })).toThrow();
  });
});
