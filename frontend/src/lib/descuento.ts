import { toCents } from '@/lib/money';

/** Descuento máximo (puntos básicos) que un cajero puede dar sin autorización de un admin o asistente: 20 %. */
export const TOPE_DESCUENTO_CAJERO_BP = 2000;

export type ModoReparto = 'CLINICA' | 'PROPORCIONAL';

/** Servicio con su precio de lista y reparto original (centavos USD). `honorarios` incluye al patólogo. */
export interface ServicioBase { area: string; estudio: string; precio: number; honorarios: number; honPatologo: number }

export interface ServicioNeto {
  precioLista: number; descuento: number; precio: number;
  honorarios: number; honMedico: number; honPatologo: number; ganancia: number;
  promoId: number | null; modo: ModoReparto | null;
}

/** `valor`: puntos básicos si es PCT (2000 = 20 %), centavos si es USD. */
export interface DescuentoManual { tipo: 'PCT' | 'USD'; valor: number; modo: ModoReparto }

/** PCT: descuento en % · USD: descuento en dólares · FIJO: el servicio queda en ese precio. */
export type TipoPromo = 'PCT' | 'USD' | 'FIJO';

/**
 * `valor`: puntos básicos si es PCT (2000 = 20 %), centavos si es USD o FIJO.
 * `areas`/`estudios`: servicios que reciben el descuento. `requiere`: estudios que deben ir también en la factura.
 */
export interface Promo {
  id: number; nombre: string; tipo: TipoPromo; valor: number; modo: ModoReparto;
  areas: string[]; estudios: string[]; requiere: string[]; desde: string; hasta: string; activa: boolean;
}

export class DescuentoError extends Error {}

const norm = (s: string) => s.trim().toLowerCase();

/** Reparte `total` centavos entre `precios` en proporción a cada precio, por resto mayor (suma exacta). */
export function repartirDescuento(precios: number[], total: number): number[] {
  const suma = precios.reduce((a, b) => a + b, 0);
  if (suma <= 0 || total <= 0) return precios.map(() => 0);
  const base = precios.map((p) => Math.floor((p * total) / suma));
  let resto = total - base.reduce((a, b) => a + b, 0);
  const orden = precios
    .map((p, i) => ({ i, frac: (p * total) % suma }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of orden) {
    if (resto <= 0) break;
    base[i] += 1;
    resto -= 1;
  }
  return base;
}

/** Descuento total en centavos de un descuento manual sobre `totalLista`; debe quedar 0 < D < total. */
export function descuentoTotalManual(totalLista: number, d: DescuentoManual): number {
  if (!Number.isInteger(d.valor) || d.valor <= 0) throw new DescuentoError('El descuento debe ser mayor a cero.');
  const monto = d.tipo === 'PCT' ? Math.round((totalLista * d.valor) / 10000) : d.valor;
  if (monto <= 0) throw new DescuentoError('El descuento debe ser mayor a cero.');
  if (monto >= totalLista) throw new DescuentoError('El descuento no puede igualar ni superar el total: el total a cobrar debe ser mayor a cero.');
  return monto;
}

function netoDe(s: ServicioBase, descuento: number, modo: ModoReparto, promoId: number | null): ServicioNeto {
  if (descuento <= 0) {
    return {
      precioLista: s.precio, descuento: 0, precio: s.precio, honorarios: s.honorarios,
      honMedico: s.honorarios - s.honPatologo, honPatologo: s.honPatologo, ganancia: s.precio - s.honorarios, promoId: null, modo: null,
    };
  }
  const precio = s.precio - descuento;
  if (precio <= 0) throw new DescuentoError(`El descuento deja en cero el servicio «${s.estudio}».`);
  let honorarios = s.honorarios;
  let honPatologo = s.honPatologo;
  if (modo === 'PROPORCIONAL') {
    honorarios = Math.round((s.honorarios * precio) / s.precio);
    honPatologo = Math.round((s.honPatologo * precio) / s.precio);
  } else if (honorarios > precio) {
    throw new DescuentoError(`El descuento deja la ganancia de la clínica en negativo en «${s.estudio}». Use el reparto proporcional o reduzca el descuento.`);
  }
  return {
    precioLista: s.precio, descuento, precio, honorarios, honMedico: honorarios - honPatologo, honPatologo,
    ganancia: precio - honorarios, promoId, modo,
  };
}

/** Aplica descuentos por servicio (centavos) con un mismo modo de reparto. */
export function aplicarDescuento(servicios: ServicioBase[], descuentos: number[], modo: ModoReparto, promoIds: (number | null)[] = []): ServicioNeto[] {
  return servicios.map((s, i) => netoDe(s, descuentos[i] ?? 0, modo, promoIds[i] ?? null));
}

/** Descuento en centavos que la promo da a un servicio de `precio` centavos (0 si no baja el precio). */
export function descuentoDePromo(p: Pick<Promo, 'tipo' | 'valor'>, precio: number): number {
  if (p.tipo === 'PCT') return Math.round((precio * p.valor) / 10000);
  const d = p.tipo === 'USD' ? p.valor : precio - p.valor;
  return d > 0 && d < precio ? d : 0;
}

/**
 * Promo vigente que aplica a un servicio (la de mayor descuento en dinero si hay varias), o null.
 * `otros`: nombres de los demás estudios de la factura, para las promos que exigen compañía.
 */
export function promoAplicable(promos: Promo[], s: { area: string; estudio: string; precio?: number }, fecha: string, otros: string[] = []): Promo | null {
  const presentes = otros.map(norm);
  const coinciden = promos.filter((p) => {
    if (!p.activa || fecha < p.desde || fecha > p.hasta) return false;
    if (!p.requiere.every((r) => presentes.includes(norm(r)))) return false;
    if (p.estudios.length > 0) return p.estudios.some((e) => norm(e) === norm(s.estudio));
    return p.areas.some((a) => norm(a) === norm(s.area));
  });
  const monto = (p: Promo) => (s.precio === undefined ? p.valor : descuentoDePromo(p, s.precio));
  return coinciden.filter((p) => s.precio === undefined || monto(p) > 0).sort((a, b) => monto(b) - monto(a))[0] ?? null;
}

/**
 * Calcula el neto de cada servicio: promociones por servicio coincidente o, si no hay promo, el descuento manual.
 * Una factura no mezcla promo y descuento manual.
 */
export function calcularFactura(servicios: ServicioBase[], promos: Promo[], fecha: string, manual: DescuentoManual | null): ServicioNeto[] {
  const coincidencias = servicios.map((s, i) => promoAplicable(promos, s, fecha, servicios.filter((_, k) => k !== i).map((o) => o.estudio)));
  if (coincidencias.some((p) => p !== null)) {
    if (manual) throw new DescuentoError('Esta factura ya tiene una promoción; no admite descuento manual.');
    return servicios.map((s, i) => {
      const p = coincidencias[i];
      return p ? netoDe(s, descuentoDePromo(p, s.precio), p.modo, p.id) : netoDe(s, 0, 'CLINICA', null);
    });
  }
  if (!manual) return servicios.map((s) => netoDe(s, 0, 'CLINICA', null));
  const totalLista = servicios.reduce((a, s) => a + s.precio, 0);
  const partes = repartirDescuento(servicios.map((s) => s.precio), descuentoTotalManual(totalLista, manual));
  return servicios.map((s, i) => netoDe(s, partes[i], manual.modo, null));
}

/** Porcentaje efectivo del descuento en puntos básicos (2500 = 25 %). */
export const porcentajeEfectivoBp = (totalLista: number, totalDescuento: number): number =>
  totalLista > 0 ? Math.round((totalDescuento * 10000) / totalLista) : 0;

/** Precio de lista en centavos de una factura; las anteriores a los descuentos no lo tienen y valen lo cobrado. */
export const precioListaCents = (f: { precio_lista_usd?: string | number | null; precio_usd: string | number }): number =>
  toCents(f.precio_lista_usd ?? f.precio_usd);
