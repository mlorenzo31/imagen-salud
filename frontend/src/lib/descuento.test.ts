import { describe, expect, it } from 'vitest';
import {
  DescuentoError, aplicarDescuento, calcularFactura, descuentoTotalManual, porcentajeEfectivoBp, precioListaCents,
  promoAplicable, repartirDescuento, type Promo, type ServicioBase,
} from './descuento';

const srv = (estudio: string, precio: number, honorarios: number, area = 'ECOGRAFIA_AM', honPatologo = 0): ServicioBase =>
  ({ area, estudio, precio, honorarios, honPatologo });

const promo = (p: Partial<Promo> = {}): Promo => ({
  id: 1, nombre: 'Mes Rosa', tipo: 'PCT', valor: 2000, modo: 'CLINICA', areas: ['MAMOGRAFIA'], estudios: [], requiere: [],
  desde: '2026-10-01', hasta: '2026-10-31', activa: true, ...p,
});

describe('repartirDescuento', () => {
  it('reparte por resto mayor y suma exacto', () => {
    const r = repartirDescuento([1000, 1000, 1000], 100);
    expect(r.reduce((a, b) => a + b, 0)).toBe(100);
    r.forEach((x) => expect([33, 34]).toContain(x));
  });
  it('es proporcional al precio', () => {
    expect(repartirDescuento([3000, 1000], 400)).toEqual([300, 100]);
  });
});

describe('descuentoTotalManual', () => {
  it('porcentaje en puntos básicos', () => {
    expect(descuentoTotalManual(2000, { tipo: 'PCT', valor: 2500, modo: 'CLINICA' })).toBe(500);
  });
  it('monto en centavos', () => {
    expect(descuentoTotalManual(2000, { tipo: 'USD', valor: 300, modo: 'CLINICA' })).toBe(300);
  });
  it('rechaza dejar el total en cero o negativo', () => {
    expect(() => descuentoTotalManual(2000, { tipo: 'PCT', valor: 10000, modo: 'CLINICA' })).toThrow(DescuentoError);
    expect(() => descuentoTotalManual(2000, { tipo: 'USD', valor: 2000, modo: 'CLINICA' })).toThrow(DescuentoError);
    expect(() => descuentoTotalManual(2000, { tipo: 'USD', valor: 3000, modo: 'CLINICA' })).toThrow(DescuentoError);
  });
  it('rechaza descuento cero o negativo', () => {
    expect(() => descuentoTotalManual(2000, { tipo: 'USD', valor: 0, modo: 'CLINICA' })).toThrow(DescuentoError);
  });
});

describe('aplicarDescuento', () => {
  it('CLINICA: honorarios intactos, baja la ganancia', () => {
    const [n] = aplicarDescuento([srv('ABDOMINAL', 2000, 600)], [500], 'CLINICA');
    expect(n).toMatchObject({ precioLista: 2000, descuento: 500, precio: 1500, honorarios: 600, ganancia: 900 });
  });
  it('PROPORCIONAL: doctor y clínica reducen igual', () => {
    const [n] = aplicarDescuento([srv('ABDOMINAL', 2000, 600)], [500], 'PROPORCIONAL');
    expect(n).toMatchObject({ precio: 1500, honorarios: 450, ganancia: 1050 });
  });
  it('PROPORCIONAL separa el patólogo y suma exacto', () => {
    const [n] = aplicarDescuento([srv('CITOLOGIA', 2500, 1000, 'GINECOLOGIA', 600)], [333], 'PROPORCIONAL');
    expect(n.honMedico + n.honPatologo).toBe(n.honorarios);
    expect(n.honorarios + n.ganancia).toBe(n.precio);
  });
  it('CLINICA rechaza si los honorarios superan el neto', () => {
    expect(() => aplicarDescuento([srv('ABDOMINAL', 2000, 600)], [1500], 'CLINICA')).toThrow(DescuentoError);
  });
});

describe('promoAplicable', () => {
  const s = { area: 'MAMOGRAFIA', estudio: 'Mamografia Digital' };
  it('por área cuando estudios está vacío', () => {
    expect(promoAplicable([promo()], s, '2026-10-15')?.id).toBe(1);
  });
  it('por estudio cuando se indica', () => {
    const p = promo({ areas: [], estudios: ['mamografia digital'] });
    expect(promoAplicable([p], s, '2026-10-15')?.id).toBe(1);
    expect(promoAplicable([promo({ areas: ['MAMOGRAFIA'], estudios: ['otro'] })], s, '2026-10-15')).toBeNull();
  });
  it('no aplica si está inactiva o fuera de fecha', () => {
    expect(promoAplicable([promo({ activa: false })], s, '2026-10-15')).toBeNull();
    expect(promoAplicable([promo()], s, '2026-09-30')).toBeNull();
    expect(promoAplicable([promo()], s, '2026-11-01')).toBeNull();
  });
  it('no aplica a otra área', () => {
    expect(promoAplicable([promo()], { area: 'RADIOLOGIA', estudio: 'Tórax PA' }, '2026-10-15')).toBeNull();
  });
});

describe('calcularFactura', () => {
  it('sin promo ni manual no cambia nada', () => {
    const r = calcularFactura([srv('A', 2000, 600)], [], '2026-10-15', null);
    expect(r[0]).toMatchObject({ precio: 2000, descuento: 0, honorarios: 600, ganancia: 1400, promoId: null });
  });
  it('promo se calcula por servicio coincidente', () => {
    const r = calcularFactura([srv('Mamografia Digital', 3000, 0, 'MAMOGRAFIA'), srv('ABDOMINAL', 2000, 600)], [promo()], '2026-10-15', null);
    expect(r[0]).toMatchObject({ descuento: 600, precio: 2400, promoId: 1, modo: 'CLINICA' });
    expect(r[1]).toMatchObject({ descuento: 0, precio: 2000, promoId: null });
  });
  it('promo + manual se rechaza', () => {
    expect(() => calcularFactura([srv('Mamografia Digital', 3000, 0, 'MAMOGRAFIA')], [promo()], '2026-10-15', { tipo: 'PCT', valor: 500, modo: 'CLINICA' }))
      .toThrow(/ya tiene una promoción/);
  });
  it('manual reparte sin perder centavos', () => {
    const r = calcularFactura([srv('A', 1000, 0), srv('B', 1000, 0), srv('C', 1000, 0)], [], '2026-10-15', { tipo: 'USD', valor: 100, modo: 'CLINICA' });
    expect(r.reduce((a, x) => a + x.descuento, 0)).toBe(100);
    expect(r.reduce((a, x) => a + x.precio + x.descuento, 0)).toBe(3000);
  });
});

describe('porcentajeEfectivoBp', () => {
  it('calcula el porcentaje efectivo', () => {
    expect(porcentajeEfectivoBp(2000, 500)).toBe(2500);
    expect(porcentajeEfectivoBp(0, 0)).toBe(0);
  });
});

describe('precioListaCents', () => {
  it('facturas antiguas (sin lista) usan el neto como lista', () => {
    expect(precioListaCents({ precio_lista_usd: null, precio_usd: '20.00' })).toBe(2000);
    expect(precioListaCents({ precio_lista_usd: '25.00', precio_usd: '20.00' })).toBe(2500);
  });
});

describe('promociones con monto y con servicios requeridos', () => {
  const mamo = srv('Mamografia Digital', 5000, 0, 'MAMOGRAFIA');
  const eco = srv('ECO MAMARIO', 3500, 0, 'ECOGRAFIA_AM');
  const mesRosa = promo({ tipo: 'FIJO', valor: 2500, areas: [], estudios: ['Mamografia Digital'], requiere: ['Eco Mamario'] });

  it('precio fijo: la mamografía queda en $25 solo si va con el eco', () => {
    const r = calcularFactura([mamo, eco], [mesRosa], '2026-10-15', null);
    expect(r[0]).toMatchObject({ precio: 2500, descuento: 2500, promoId: 1 });
    expect(r[1]).toMatchObject({ precio: 3500, descuento: 0, promoId: null });
  });
  it('sin el servicio requerido no aplica', () => {
    const r = calcularFactura([mamo], [mesRosa], '2026-10-15', null);
    expect(r[0]).toMatchObject({ precio: 5000, descuento: 0, promoId: null });
  });
  it('el servicio requerido es otra línea, no la misma', () => {
    const solo = promo({ tipo: 'FIJO', valor: 2500, estudios: ['Mamografia Digital'], requiere: ['Mamografia Digital'] });
    expect(promoAplicable([solo], mamo, '2026-10-15', ['Eco Mamario'])).toBeNull();
  });
  it('exige todos los requeridos', () => {
    const p = promo({ tipo: 'FIJO', valor: 2500, estudios: ['Mamografia Digital'], requiere: ['Eco Mamario', 'Citologia'] });
    expect(promoAplicable([p], mamo, '2026-10-15', ['Eco Mamario'])).toBeNull();
    expect(promoAplicable([p], mamo, '2026-10-15', ['eco mamario', 'CITOLOGIA'])?.id).toBe(1);
  });
  it('descuento en dólares', () => {
    const p = promo({ tipo: 'USD', valor: 500, areas: ['MAMOGRAFIA'] });
    expect(calcularFactura([mamo], [p], '2026-10-15', null)[0]).toMatchObject({ precio: 4500, descuento: 500 });
  });
  it('precio fijo mayor o igual al precio de lista no aplica', () => {
    const p = promo({ tipo: 'FIJO', valor: 5000, areas: ['MAMOGRAFIA'] });
    expect(calcularFactura([mamo], [p], '2026-10-15', null)[0]).toMatchObject({ precio: 5000, descuento: 0, promoId: null });
  });
  it('gana la promoción de mayor descuento en dólares', () => {
    const a = promo({ id: 1, tipo: 'PCT', valor: 1000, areas: ['MAMOGRAFIA'] }); // $5
    const b = promo({ id: 2, tipo: 'USD', valor: 800, areas: ['MAMOGRAFIA'] }); // $8
    expect(promoAplicable([a, b], mamo, '2026-10-15', [])?.id).toBe(2);
  });
  it('reparto proporcional con precio fijo ajusta honorarios', () => {
    const m = srv('Mamografia Digital', 5000, 1000, 'MAMOGRAFIA');
    const p = promo({ tipo: 'FIJO', valor: 2500, modo: 'PROPORCIONAL', areas: ['MAMOGRAFIA'] });
    expect(calcularFactura([m], [p], '2026-10-15', null)[0]).toMatchObject({ precio: 2500, honorarios: 500, ganancia: 2000 });
  });
  it('promo + manual sigue rechazado', () => {
    expect(() => calcularFactura([mamo, eco], [mesRosa], '2026-10-15', { tipo: 'PCT', valor: 500, modo: 'CLINICA' })).toThrow(/ya tiene una promoción/);
  });
});
