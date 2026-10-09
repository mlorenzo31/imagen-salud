import { describe, expect, it } from 'vitest';
import { calcularNetosUI, carritoABase, type DescuentoUI } from './descuentoUI';
import type { Promo } from './descuento';

const item = (estudio: string, precioUSD: number, medico: number, area = 'ECOGRAFIA_AM') =>
  ({ area, estudio, precioUSD, dist: { imagen: precioUSD - medico, medico, eco: 0, patologo: 0 } });
const manual = (p: Partial<DescuentoUI> = {}): DescuentoUI => ({ tipo: 'PCT', valor: 25, modo: 'CLINICA', motivo: 'Paciente frecuente', pin: 'x', autorizador: null, ...p });
const promo: Promo = { id: 1, nombre: 'Mes Rosa', tipo: 'PCT', valor: 2000, modo: 'CLINICA', areas: ['MAMOGRAFIA'], estudios: [], requiere: [], desde: '2026-10-01', hasta: '2026-10-31', activa: true };

describe('carritoABase', () => {
  it('convierte dólares a centavos sin errores de coma flotante', () => {
    expect(carritoABase([item('ABDOMINAL', 20.1, 6.03)])).toEqual([{ area: 'ECOGRAFIA_AM', estudio: 'ABDOMINAL', precio: 2010, honorarios: 603, honPatologo: 0 }]);
  });
});

describe('calcularNetosUI', () => {
  it('sin descuento devuelve la lista', () => {
    const r = calcularNetosUI([item('ABDOMINAL', 20, 6)], [], '2026-10-15', null);
    expect(r.error).toBeNull();
    expect(r.netos?.[0].precio).toBe(2000);
  });
  it('descuento manual del 25 % deja 1500', () => {
    const r = calcularNetosUI([item('ABDOMINAL', 20, 6)], [], '2026-10-15', manual());
    expect(r.netos?.[0]).toMatchObject({ precio: 1500, descuento: 500 });
  });
  it('devuelve el error en vez de lanzarlo', () => {
    const r = calcularNetosUI([item('ABDOMINAL', 20, 6)], [], '2026-10-15', manual({ valor: 100 }));
    expect(r.netos).toBeNull();
    expect(r.error).toMatch(/menor|cero|igualar/i);
  });
  it('promo vigente aplica sola y bloquea el manual', () => {
    const i = item('Mamografia Digital', 30, 0, 'MAMOGRAFIA');
    expect(calcularNetosUI([i], [promo], '2026-10-15', null).netos?.[0]).toMatchObject({ descuento: 600, promoId: 1 });
    expect(calcularNetosUI([i], [promo], '2026-10-15', manual()).error).toMatch(/promoción/);
  });
});
