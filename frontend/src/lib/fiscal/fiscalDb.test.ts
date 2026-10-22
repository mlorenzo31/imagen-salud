import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

import { CONFIG_EMISOR_DEFECTO, construirFactura } from './factura';
import { filaDocumento, formatearNumero, siguienteNumero } from './fiscalDb';

describe('formatearNumero', () => {
  it('8 dígitos con ceros a la izquierda', () => {
    expect(formatearNumero(1)).toBe('00000001');
    expect(formatearNumero(365)).toBe('00000365');
  });
  it('rechaza valores no válidos', () => {
    expect(() => formatearNumero(0)).toThrow();
    expect(() => formatearNumero(100_000_000)).toThrow();
  });
});

describe('siguienteNumero', () => {
  it('incrementa la secuencia del tipo dentro de la transacción y la formatea', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ ultimo: '366' }] });
    await expect(siguienteNumero({ query } as never, 'FACTURA')).resolves.toBe('00000366');
    expect(query.mock.calls[0][0]).toMatch(/ON CONFLICT \(tipo\) DO UPDATE SET ultimo = secuencias_fiscales\.ultimo \+ 1/);
    expect(query.mock.calls[0][1]).toEqual(['FACTURA']);
  });
});

describe('filaDocumento', () => {
  const emisor = { ...CONFIG_EMISOR_DEFECTO, razonSocial: 'DEMO, C.A.', rif: 'J000000000', domicilioFiscal: 'Caracas', percibeIgtf: true };
  const doc = construirFactura({
    numero: '00000001', numeroControl: null, fecha: '2026-10-15', hora: '14:04:07',
    receptor: { nombre: 'PACIENTE', documento: 'V1234567' },
    lineas: [{ codigo: 'A', descripcion: 'Estudio', cantidad: 1, precioUnitarioUsd: 4500, descuentoUsd: 0, alicuota: 0 }],
    tasa: '211.67', pagoDivisasUsd: 4500, emisor,
  });

  it('lleva los totales a texto decimal para NUMERIC y conserva el documento completo', () => {
    const f = filaDocumento(doc, { facturaCajaId: 7, usuario: 'admin', fecha: '2026-10-15', hora: '14:04:07' });
    expect(f).toMatchObject({
      tipo: 'FACTURA', numero: '00000001', numero_control: null, factura_caja_id: 7, doc_referencia_id: null,
      fecha_emision: '2026-10-15', hora_emision: '14:04:07', receptor_nombre: 'PACIENTE', receptor_documento: 'V1234567',
      total_exento_usd: '45.00', total_iva_usd: '0.00', total_igtf_usd: '1.35', total_usd: '46.35',
      total_exento_bs: '9525.15', total_iva_bs: '0.00', total_igtf_bs: '285.75', total_bs: '9810.90',
      tipo_cambio: '211.67', motivo: null, usuario: 'admin',
    });
    expect(JSON.parse(f.payload)).toEqual(doc);
  });
});
