import { NextResponse, type NextRequest } from 'next/server';
import pool from '@/lib/db';
import { errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { centsToNumber, toCents } from '@/lib/money';
import { sumarDias } from '@/lib/date';
import { obtenerTasaBcv } from '@/lib/tasaBcv';

export type PeriodoResumen = 'HOY' | '7DIAS' | 'MES' | 'TODO';

const ETIQUETA_GRUPO: Record<string, string> = {
  A: 'Ecografía & Ginecología (Grupo A)',
  B: 'Mamografía & Rayos X (Grupo B)',
  C: 'Consultas Médicas (Grupo C)',
};
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function rango(periodo: PeriodoResumen, hoy: string): { desde: string; hasta: string } {
  if (periodo === 'HOY') return { desde: hoy, hasta: hoy };
  if (periodo === '7DIAS') return { desde: sumarDias(hoy, -6), hasta: hoy };
  if (periodo === 'MES') return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
  return { desde: '1900-01-01', hasta: hoy };
}

const etiquetaDia = (f: string) => {
  const [y, m, d] = f.split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${String(d).padStart(2, '0')}`;
};

/** Métricas financieras reales del período (sin datos de muestra). */
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams.get('periodo');
    const periodo: PeriodoResumen = p === 'HOY' || p === '7DIAS' || p === 'TODO' ? p : 'MES';
    const hoy = fechaHoraLocal().fecha;
    const { desde, hasta } = rango(periodo, hoy);
    const tasa = (await obtenerTasaBcv())?.tasa ?? 0;
    const usd = (bsCents: number, t: number) => (t > 0 ? Math.round(bsCents / t) : 0);

    const NO_ANULADA = "estado NOT IN ('ANULADA', 'ANULADA_SALA')";
    const [fact, egr, ing, grupos] = await Promise.all([
      pool.query(`SELECT to_char(fecha, 'YYYY-MM-DD') AS dia, COUNT(*) AS n, COALESCE(SUM(precio_usd),0) AS precio,
                         COALESCE(SUM(precio_usd * tasa_bcv),0) AS precio_bs, COALESCE(SUM(pago_divisas),0) AS divisas,
                         COALESCE(SUM(pago_punto + pago_movil + pago_efectivo_bs),0) AS bs
                  FROM facturas_caja WHERE ${NO_ANULADA} AND fecha BETWEEN $1 AND $2 GROUP BY 1`, [desde, hasta]),
      pool.query(`SELECT to_char(fecha, 'YYYY-MM-DD') AS dia, moneda, COALESCE(SUM(monto_neto),0) AS neto, COALESCE(SUM(comision_bancaria),0) AS comision
                  FROM egresos_operativos WHERE fecha BETWEEN $1 AND $2 GROUP BY 1, 2`, [desde, hasta]),
      pool.query(`SELECT moneda, COALESCE(SUM(monto),0) AS total FROM ingresos_extraordinarios WHERE fecha BETWEEN $1 AND $2 GROUP BY 1`, [desde, hasta]),
      pool.query(`SELECT COALESCE(grupo_clinico, 'A') AS g, COALESCE(SUM(precio_usd),0) AS precio
                  FROM facturas_caja WHERE ${NO_ANULADA} AND fecha BETWEEN $1 AND $2 GROUP BY 1`, [desde, hasta]),
    ]);

    // Totales del período
    let ingresosUsd = 0, ingresosBs = 0, egresosBs = 0, comisionesBs = 0, transacciones = 0;
    for (const r of fact.rows) {
      ingresosUsd += toCents(r.divisas);
      ingresosBs += toCents(r.bs);
      transacciones += Number(r.n);
    }
    for (const r of egr.rows) {
      if (r.moneda === 'BS') { egresosBs += toCents(r.neto); comisionesBs += toCents(r.comision); }
    }

    // Tendencia diaria (se rellenan los días sin movimiento en períodos acotados)
    const dias = new Map<string, { ingUsd: number; ingBs: number; egrUsd: number; egrBs: number }>();
    const dia = (d: string) => {
      if (!dias.has(d)) dias.set(d, { ingUsd: 0, ingBs: 0, egrUsd: 0, egrBs: 0 });
      return dias.get(d)!;
    };
    if (periodo !== 'TODO') for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dia(d);
    for (const r of fact.rows) { const x = dia(r.dia); x.ingUsd += toCents(r.precio); x.ingBs += toCents(r.precio_bs); }
    for (const r of egr.rows) {
      const x = dia(r.dia);
      const neto = toCents(r.neto);
      if (r.moneda === 'USD') { x.egrUsd += neto; x.egrBs += tasa > 0 ? Math.round(neto * tasa) : 0; }
      else { x.egrBs += neto; x.egrUsd += usd(neto, tasa); }
    }
    const tendencia = Array.from(dias.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([d, x]) => ({
      dia: d === hoy ? `Hoy ${d.slice(8)}` : etiquetaDia(d),
      IngresosUSD: centsToNumber(x.ingUsd), EgresosUSD: centsToNumber(x.egrUsd), MargenUSD: centsToNumber(x.ingUsd - x.egrUsd),
      IngresosBs: centsToNumber(x.ingBs), EgresosBs: centsToNumber(x.egrBs),
    }));

    // Distribución: facturación por grupo clínico + ingresos extraordinarios + gastos (en USD)
    const extraUsd = ing.rows.reduce((a, r) => a + (r.moneda === 'USD' ? toCents(r.total) : usd(toCents(r.total), tasa)), 0);
    const gastosUsd = egr.rows.reduce((a, r) => a + (r.moneda === 'USD' ? toCents(r.neto) : usd(toCents(r.neto), tasa)), 0);
    const distribucion = [
      ...grupos.rows.map((r) => ({ name: ETIQUETA_GRUPO[r.g] ?? `Grupo ${r.g}`, value: centsToNumber(toCents(r.precio)) })),
      { name: 'Ingresos Extraordinarios', value: centsToNumber(extraUsd) },
      { name: 'Gastos Operativos (Egresos)', value: centsToNumber(gastosUsd) },
    ].filter((x) => x.value > 0);

    return NextResponse.json({
      periodo, desde, hasta, tasa,
      ingresosUsd: centsToNumber(ingresosUsd), ingresosBs: centsToNumber(ingresosBs),
      egresosBs: centsToNumber(egresosBs), comisionesBs: centsToNumber(comisionesBs), transacciones,
      tendencia, distribucion,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
