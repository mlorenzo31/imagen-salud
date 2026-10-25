import { describe, expect, it } from 'vitest';
import { clasificar, diferenciasDocumentos, resumen, type FilaCobro } from './tablero';

const HOY = '2026-10-22';
const fila = (o: Partial<FilaCobro>): FilaCobro => ({
  id: 1, fecha: '2026-10-20', paciente: 'X', totalUsd: 2000, totalBs: 423340,
  docId: null, docEstado: null, docNumero: null, docControl: null, motivoDiferido: null, facturarAntesDe: null, ...o,
});

describe('clasificar: estado fiscal de un cobro', () => {
  it('con factura emitida', () => expect(clasificar(fila({ docId: 9, docEstado: 'EMITIDO' }), HOY)).toBe('EMITIDA'));
  it('con factura en cola o enviándose', () => {
    expect(clasificar(fila({ docId: 9, docEstado: 'PENDIENTE' }), HOY)).toBe('EN_PROCESO');
    expect(clasificar(fila({ docId: 9, docEstado: 'ENVIANDO' }), HOY)).toBe('EN_PROCESO');
  });
  it('con factura rechazada por la imprenta', () => expect(clasificar(fila({ docId: 9, docEstado: 'ERROR' }), HOY)).toBe('RECHAZADA'));
  it('factura de talonario aún sin remitir a la imprenta', () => {
    expect(clasificar(fila({ docId: 9, docEstado: 'CONTINGENCIA' }), HOY)).toBe('CONTINGENCIA');
  });
  it('diferido dentro del plazo (el día límite aún vale)', () => {
    expect(clasificar(fila({ motivoDiferido: 'ANTICIPO', facturarAntesDe: '2026-10-22' }), HOY)).toBe('DIFERIDA');
  });
  it('diferido con el plazo vencido', () => {
    expect(clasificar(fila({ motivoDiferido: 'ASEGURADORA', facturarAntesDe: '2026-10-21' }), HOY)).toBe('DIFERIDA_VENCIDA');
  });
  it('sin factura ni diferimiento: anomalía', () => expect(clasificar(fila({}), HOY)).toBe('SIN_FACTURA'));
  it('una factura gana sobre el diferimiento (ya se facturó)', () => {
    expect(clasificar(fila({ docId: 9, docEstado: 'EMITIDO', motivoDiferido: 'ANTICIPO', facturarAntesDe: '2026-10-01' }), HOY)).toBe('EMITIDA');
  });
});

describe('resumen', () => {
  const filas = [
    fila({ id: 1, docId: 9, docEstado: 'EMITIDO', totalUsd: 2000, totalBs: 400000 }),
    fila({ id: 2, docId: 10, docEstado: 'PENDIENTE', totalUsd: 1000, totalBs: 200000 }),
    fila({ id: 3, motivoDiferido: 'ANTICIPO', facturarAntesDe: '2026-11-01', totalUsd: 3000, totalBs: 600000 }),
    fila({ id: 4, motivoDiferido: 'ASEGURADORA', facturarAntesDe: '2026-10-01', totalUsd: 500, totalBs: 100000 }),
    fila({ id: 5, totalUsd: 700, totalBs: 140000 }),
  ];
  const r = resumen(filas, HOY);

  it('cobrado = suma de todos los cobros', () => expect(r.cobrado).toEqual({ n: 5, usd: 7200, bs: 1440000 }));
  it('reparte por estado', () => {
    expect(r.porEstado.EMITIDA).toEqual({ n: 1, usd: 2000, bs: 400000 });
    expect(r.porEstado.EN_PROCESO).toEqual({ n: 1, usd: 1000, bs: 200000 });
    expect(r.porEstado.DIFERIDA).toEqual({ n: 1, usd: 3000, bs: 600000 });
    expect(r.porEstado.DIFERIDA_VENCIDA).toEqual({ n: 1, usd: 500, bs: 100000 });
    expect(r.porEstado.SIN_FACTURA).toEqual({ n: 1, usd: 700, bs: 140000 });
    expect(r.porEstado.RECHAZADA).toEqual({ n: 0, usd: 0, bs: 0 });
  });
  it('alertas: vencidos, sin factura y rechazadas', () => {
    expect(r.alertas).toEqual({ vencidas: 1, sinFactura: 1, rechazadas: 0 });
    expect(r.alDia).toBe(false);
  });
  it('al día cuando todo está facturado o diferido en plazo', () => {
    expect(resumen(filas.slice(0, 3), HOY).alDia).toBe(true);
  });
});

describe('diferenciasDocumentos: la factura debe sumar lo cobrado', () => {
  it('detecta una factura cuyo monto no coincide con sus cobros', () => {
    expect(diferenciasDocumentos([
      { docId: 9, numero: '00000001', ventaUsd: 2000, cobrosUsd: 2000 },
      { docId: 10, numero: '00000002', ventaUsd: 4500, cobrosUsd: 4000 },
    ])).toEqual([{ docId: 10, numero: '00000002', ventaUsd: 4500, cobrosUsd: 4000, diferenciaUsd: 500 }]);
  });
});
