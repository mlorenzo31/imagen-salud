import { describe, expect, it } from 'vitest';
import { CONFIG_EMISOR_DEFECTO, construirFactura, construirNota, type ConfigEmisor, type EntradaFactura } from './factura';

const EMISOR: ConfigEmisor = {
  ...CONFIG_EMISOR_DEFECTO,
  razonSocial: 'CENTRO CLÍNICO DEMO, C.A.',
  rif: 'J000000000',
  domicilioFiscal: 'Av. Principal, Caracas',
};

// Ecografía mamaria $20 + Tórax PA $25, tasa 211,67 → Bs 4.233,40 + 5.291,75 = 9.525,15 (montos en centavos).
const base = (over: Partial<EntradaFactura> = {}): EntradaFactura => ({
  numero: '00000365',
  numeroControl: '00-00000365',
  fechaAsignacionControl: '2026-10-15',
  fecha: '2026-10-15',
  hora: '10:24:18',
  receptor: { nombre: 'CARLA DANIELA MÉNDEZ', documento: 'V18456323' },
  lineas: [
    { codigo: 'ECO-AM-03', descripcion: 'Ecografía mamaria', cantidad: 1, precioUnitarioUsd: 2000, descuentoUsd: 0, alicuota: 0 },
    { codigo: 'RX-02', descripcion: 'Tórax PA (1 proyección)', cantidad: 1, precioUnitarioUsd: 2500, descuentoUsd: 0, alicuota: 0 },
  ],
  tasa: '211.67',
  pagoDivisasUsd: 0,
  emisor: EMISOR,
  ...over,
});

describe('construirFactura — requisitos del art. 8', () => {
  const f = construirFactura(base());

  it('denominación, numeración, fecha y hora en formato fiscal', () => {
    expect(f.tipo).toBe('FACTURA');
    expect(f.denominacion).toBe('Factura');
    expect(f.numero).toBe('00000365');
    expect(f.numeroControl).toBe('00-00000365');
    expect(f.fechaEmision).toBe('15/10/2026');
    expect(f.horaEmision).toBe('10.24.18 a.m.');
    expect(f.fechaAsignacionControl).toBe('15/10/2026');
  });

  it('identifica emisor y receptor', () => {
    expect(f.emisor).toEqual({ razonSocial: 'CENTRO CLÍNICO DEMO, C.A.', rif: 'J000000000', domicilioFiscal: 'Av. Principal, Caracas' });
    expect(f.receptor).toEqual({ nombre: 'CARLA DANIELA MÉNDEZ', documento: 'V18456323' });
  });

  it('marca los exentos con (E) y conserva el código de operación', () => {
    expect(f.lineas.map((l) => l.descripcion)).toEqual(['Ecografía mamaria (E)', 'Tórax PA (1 proyección) (E)']);
    expect(f.lineas.map((l) => l.codigo)).toEqual(['ECO-AM-03', 'RX-02']);
  });

  it('expresa cada monto en divisa y en bolívares con el tipo de cambio (art. 8.12)', () => {
    expect(f.tipoCambio).toBe('211.67');
    expect(f.lineas[0].monto).toEqual({ usd: 2000, bs: 423340 });
    expect(f.lineas[1].monto).toEqual({ usd: 2500, bs: 529175 });
    expect(f.totales.exento).toEqual({ usd: 4500, bs: 952515 });
    expect(f.totales.alicuotas).toEqual([]);
    expect(f.totales.iva).toEqual({ usd: 0, bs: 0 });
    expect(f.totales.igtf).toBeNull();
    expect(f.totales.total).toEqual({ usd: 4500, bs: 952515 });
  });

  it('incluye la leyenda del art. 19', () => {
    expect(f.leyendas[0]).toMatch(/Providencia Administrativa/);
  });

  it('la tasa que llega como número da el mismo resultado', () => {
    expect(construirFactura(base({ tasa: 211.67 })).totales.total).toEqual({ usd: 4500, bs: 952515 });
  });
});

describe('construirFactura — contribuyente ordinario con operaciones gravadas', () => {
  it('discrimina base e IVA por alícuota y suma al total (arts. 8.9 a 8.11)', () => {
    const f = construirFactura(base({
      lineas: [
        { codigo: 'ECO-AM-03', descripcion: 'Ecografía mamaria', cantidad: 1, precioUnitarioUsd: 2000, descuentoUsd: 0, alicuota: 0 },
        { codigo: 'INS-01', descripcion: 'Gel conductor', cantidad: 3, precioUnitarioUsd: 333, descuentoUsd: 0, alicuota: 16 },
        { codigo: 'INS-02', descripcion: 'Sobre de resultados', cantidad: 1, precioUnitarioUsd: 101, descuentoUsd: 0, alicuota: 8 },
      ],
      tasa: '100',
    }));
    expect(f.lineas[1].descripcion).toBe('Gel conductor');
    expect(f.lineas[1].monto).toEqual({ usd: 999, bs: 99900 });
    expect(f.totales.exento).toEqual({ usd: 2000, bs: 200000 });
    expect(f.totales.alicuotas).toEqual([
      { pct: 16, base: { usd: 999, bs: 99900 }, iva: { usd: 160, bs: 15984 } }, // 9,99 × 16 % = 1,5984 → 1,60
      { pct: 8, base: { usd: 101, bs: 10100 }, iva: { usd: 8, bs: 808 } },      // 1,01 × 8 % = 0,0808 → 0,08
    ]);
    expect(f.totales.iva).toEqual({ usd: 168, bs: 16792 });
    expect(f.totales.total).toEqual({ usd: 3268, bs: 326792 });
  });
});

describe('construirFactura — contribuyente formal del IVA (art. 8, parágrafo único)', () => {
  const formal = { ...EMISOR, condicionIva: 'FORMAL' as const };

  it('agrega la frase "Contribuyentes Formales del IVA"', () => {
    expect(construirFactura(base({ emisor: formal })).leyendas).toContain('Contribuyentes Formales del IVA');
    expect(construirFactura(base()).leyendas).not.toContain('Contribuyentes Formales del IVA');
  });

  it('no admite operaciones gravadas', () => {
    const lineas = [{ codigo: 'X', descripcion: 'Gravado', cantidad: 1, precioUnitarioUsd: 100, descuentoUsd: 0, alicuota: 16 }];
    expect(() => construirFactura(base({ emisor: formal, lineas }))).toThrow(/formal/i);
  });
});

describe('construirFactura — descuentos (art. 8.8)', () => {
  it('muestra el descuento por línea y en el total, y cobra el neto', () => {
    const f = construirFactura(base({
      lineas: [{ codigo: 'RX-02', descripcion: 'Tórax PA', cantidad: 1, precioUnitarioUsd: 2500, descuentoUsd: 500, alicuota: 0 }],
      tasa: '200',
    }));
    expect(f.lineas[0].precioUnitario).toEqual({ usd: 2500, bs: 500000 });
    expect(f.lineas[0].descuento).toEqual({ usd: 500, bs: 100000 });
    expect(f.lineas[0].monto).toEqual({ usd: 2000, bs: 400000 });
    expect(f.totales.descuentos).toEqual({ usd: 500, bs: 100000 });
    expect(f.totales.total).toEqual({ usd: 2000, bs: 400000 });
  });

  it('rechaza un descuento mayor que el monto de la línea', () => {
    const lineas = [{ codigo: 'RX-02', descripcion: 'Tórax PA', cantidad: 1, precioUnitarioUsd: 2500, descuentoUsd: 2600, alicuota: 0 }];
    expect(() => construirFactura(base({ lineas }))).toThrow(/descuento/i);
  });
});

describe('construirFactura — IGTF sobre pagos en divisas', () => {
  it('no se cobra si el emisor no lo percibe', () => {
    expect(construirFactura(base({ pagoDivisasUsd: 4500 })).totales.igtf).toBeNull();
  });

  it('3 % sobre lo pagado en divisas, sumado al total', () => {
    const f = construirFactura(base({ pagoDivisasUsd: 4500, emisor: { ...EMISOR, percibeIgtf: true } }));
    expect(f.totales.igtf).toEqual({ pct: 3, base: { usd: 4500, bs: 952515 }, monto: { usd: 135, bs: 28575 } });
    expect(f.totales.total).toEqual({ usd: 4635, bs: 981090 });
  });

  it('la base no excede el monto de la venta (vuelto en divisas)', () => {
    const f = construirFactura(base({ pagoDivisasUsd: 5000, emisor: { ...EMISOR, percibeIgtf: true } }));
    expect(f.totales.igtf?.base.usd).toBe(4500);
  });

  it('pago mixto: solo la parte en divisas', () => {
    const f = construirFactura(base({ pagoDivisasUsd: 2000, emisor: { ...EMISOR, percibeIgtf: true } }));
    expect(f.totales.igtf?.monto).toEqual({ usd: 60, bs: 12700 });
  });
});

describe('construirFactura — datos de la imprenta digital (art. 9.3)', () => {
  it('se imprimen cuando están configurados', () => {
    const f = construirFactura(base({ emisor: { ...EMISOR, imprenta: { razonSocial: 'IMPRENTA DEMO, C.A.', rif: 'J111111111', providencia: 'SNAT/2024/000999', fechaProvidencia: '2024-12-19' } } }));
    expect(f.imprenta).toEqual({ razonSocial: 'IMPRENTA DEMO, C.A.', rif: 'J111111111', providencia: 'SNAT/2024/000999', fechaProvidencia: '19/12/2024' });
  });
});

describe('construirFactura — validaciones', () => {
  it('exige al menos una línea', () => expect(() => construirFactura(base({ lineas: [] }))).toThrow());
  it('exige cédula, pasaporte o RIF del receptor (art. 8.6)', () => {
    expect(() => construirFactura(base({ receptor: { nombre: 'X', documento: ' ' } }))).toThrow(/receptor/i);
  });
  it('exige nombre o razón social del receptor', () => {
    expect(() => construirFactura(base({ receptor: { nombre: '', documento: 'V1' } }))).toThrow(/receptor/i);
  });
  it('rechaza un N° de control mal formado', () => {
    expect(() => construirFactura(base({ numeroControl: '365' }))).toThrow(/control/i);
  });
  it('permite emitir sin N° de control todavía (lo asigna la imprenta)', () => {
    expect(construirFactura(base({ numeroControl: null, fechaAsignacionControl: null })).numeroControl).toBeNull();
  });
  it('rechaza cantidades y precios no válidos', () => {
    const l = (o: object) => [{ codigo: 'A', descripcion: 'A', cantidad: 1, precioUnitarioUsd: 100, descuentoUsd: 0, alicuota: 0, ...o }];
    expect(() => construirFactura(base({ lineas: l({ cantidad: 0 }) }))).toThrow();
    expect(() => construirFactura(base({ lineas: l({ precioUnitarioUsd: -1 }) }))).toThrow();
    expect(() => construirFactura(base({ lineas: l({ alicuota: 101 }) }))).toThrow();
  });
  it('exige el emisor configurado', () => {
    expect(() => construirFactura(base({ emisor: CONFIG_EMISOR_DEFECTO }))).toThrow(/emisor/i);
  });
});

describe('construirNota — notas de crédito y débito (arts. 12-13)', () => {
  const original = construirFactura(base());
  const nc = (over: object = {}) => construirNota({
    tipo: 'NOTA_CREDITO', numero: '00000012', numeroControl: '00-00000366', fechaAsignacionControl: '2026-10-16',
    fecha: '2026-10-16', hora: '15:00:00', motivo: 'Estudio no realizado', original, emisor: EMISOR,
    lineas: [{ codigo: 'RX-02', descripcion: 'Tórax PA (1 proyección)', cantidad: 1, precioUnitarioUsd: 2500, descuentoUsd: 0, alicuota: 0 }],
    ...over,
  });

  it('referencia fecha, número, N° de control y monto de la factura original', () => {
    const n = nc();
    expect(n.tipo).toBe('NOTA_CREDITO');
    expect(n.denominacion).toBe('Nota de Crédito');
    expect(n.referencia).toEqual({ numero: '00000365', numeroControl: '00-00000365', fechaEmision: '15/10/2026', total: { usd: 4500, bs: 952515 } });
    expect(n.motivo).toBe('Estudio no realizado');
  });

  it('usa el tipo de cambio y el receptor de la factura original', () => {
    const n = nc();
    expect(n.tipoCambio).toBe('211.67');
    expect(n.receptor).toEqual(original.receptor);
    expect(n.totales.total).toEqual({ usd: 2500, bs: 529175 });
  });

  it('puede acreditar justo lo pendiente de la factura', () => {
    expect(() => nc({ acreditadoPrevioUsd: 2000 })).not.toThrow(); // 45 − 20 = 25 pendientes = NC de 25
  });

  it('rechaza una NC que excede el saldo de la factura', () => {
    expect(() => nc({ acreditadoPrevioUsd: 2100 })).toThrow(/excede/i);
  });

  it('la nota de débito no tiene tope', () => {
    const nd = construirNota({
      tipo: 'NOTA_DEBITO', numero: '00000003', numeroControl: '00-00000367', fechaAsignacionControl: '2026-10-16',
      fecha: '2026-10-16', hora: '15:00:00', motivo: 'Proyección adicional', original, emisor: EMISOR,
      lineas: [{ codigo: 'RX-03', descripcion: 'Proyección adicional', cantidad: 1, precioUnitarioUsd: 10000, descuentoUsd: 0, alicuota: 0 }],
    });
    expect(nd.denominacion).toBe('Nota de Débito');
    expect(nd.totales.total.usd).toBe(10000);
  });

  it('exige motivo', () => expect(() => nc({ motivo: '  ' })).toThrow(/motivo/i));
});
