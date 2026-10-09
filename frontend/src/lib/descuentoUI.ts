import { DescuentoError, calcularFactura, type DescuentoManual, type ModoReparto, type Promo, type ServicioBase, type ServicioNeto } from '@/lib/descuento';

/** Descuento manual tal como lo captura la pantalla: `valor` en % (PCT) o en dólares (USD). */
export interface DescuentoUI {
  tipo: 'PCT' | 'USD'; valor: number; modo: ModoReparto; motivo: string; pin: string;
  autorizador: { usuario: string; clave: string } | null;
}

export interface ItemCarrito {
  area: string; estudio: string; precioUSD: number;
  dist: { imagen: number; medico: number; eco: number; patologo: number };
}

const cents = (usd: number) => Math.round(usd * 100);

/** Carrito en dólares → servicios en centavos (honorarios = médico + patólogo). */
export const carritoABase = (carrito: ItemCarrito[]): ServicioBase[] =>
  carrito.map((c) => ({
    area: c.area, estudio: c.estudio, precio: cents(c.precioUSD), honorarios: cents(c.dist.medico) + cents(c.dist.patologo), honPatologo: cents(c.dist.patologo),
  }));

export const aDescuentoManual = (d: DescuentoUI): DescuentoManual => ({ tipo: d.tipo, modo: d.modo, valor: cents(d.valor) });

/** Misma cuenta que hace el servidor, sin lanzar: devuelve el mensaje de error para mostrarlo. */
export function calcularNetosUI(carrito: ItemCarrito[], promos: Promo[], fecha: string, manual: DescuentoUI | null): { netos: ServicioNeto[] | null; error: string | null } {
  try {
    return { netos: calcularFactura(carritoABase(carrito), promos, fecha, manual ? aDescuentoManual(manual) : null), error: null };
  } catch (err) {
    if (err instanceof DescuentoError) return { netos: null, error: err.message };
    throw err;
  }
}
