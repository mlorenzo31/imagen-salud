import { describe, expect, it } from 'vitest';
import { avisoFiscal } from './aviso';

describe('avisoFiscal (mensaje para la caja tras cobrar)', () => {
  it('emitida', () => {
    expect(avisoFiscal({ estado: 'EMITIDO', numero: '00000012', numeroControl: '00-00000040' }))
      .toEqual({ tipo: 'exito', mensaje: 'Factura fiscal N° 00000012 emitida · N° de control 00-00000040.' });
  });
  it('pendiente de envío', () => {
    expect(avisoFiscal({ estado: 'PENDIENTE', numero: '00000012', error: 'timeout' })?.tipo).toBe('alerta');
    expect(avisoFiscal({ estado: 'PENDIENTE', numero: '00000012', error: 'timeout' })?.mensaje).toMatch(/00000012.*reintent/);
  });
  it('rechazada o no generada', () => {
    expect(avisoFiscal({ estado: 'ERROR', numero: '00000012', error: 'RIF inválido' })).toEqual({ tipo: 'error', mensaje: 'La imprenta rechazó la factura fiscal N° 00000012: RIF inválido' });
    expect(avisoFiscal({ estado: 'NO_EMITIDA', error: 'Falta configurar el emisor' })?.tipo).toBe('error');
  });
  it('desactivada: sin aviso salvo error de configuración', () => {
    expect(avisoFiscal({ estado: 'DESACTIVADA', aviso: null })).toBeNull();
    expect(avisoFiscal({ estado: 'DESACTIVADA', aviso: 'Proveedor fiscal desconocido: x' })?.tipo).toBe('error');
    expect(avisoFiscal(undefined)).toBeNull();
  });
});
