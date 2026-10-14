'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, BookOpen } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAvisos } from '@/components/ui/avisos';
import { hoyLocal } from '@/lib/date';
import { diferir } from '@/lib/diferir';
import { descargarExcel } from '@/lib/excel';
import { getErrorMessage } from '@/lib/utils';
import type { armarReporte } from '@/lib/compras/reporte';
import { pedir } from './comprasApi';

type Reporte = ReturnType<typeof armarReporte> & {
  desde: string; hasta: string;
  detalleCompras: Record<string, string | number>[];
  detalleGastos: Record<string, string | number | null>[];
};

const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const bs = (c: number) => `Bs. ${(c / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ETIQUETA: Record<string, string> = {
  PAGO_COMPRA: 'Compras con factura', GASTO_MENOR: 'Gastos menores', HONORARIOS: 'Honorarios médicos', COMISION: 'Comisiones bancarias',
};

const Tarjeta = ({ titulo, m, color, nota }: { titulo: string; m: { bs: number; usd: number }; color: string; nota?: string }) => (
  <div className={`rounded-xl border p-3 ${color}`}>
    <p className="text-xs font-bold uppercase tracking-wide">{titulo}</p>
    <p className="mt-1 font-mono text-lg font-black">{m.usd < 0 ? '−' : ''}{usd(Math.abs(m.usd))}</p>
    <p className="font-mono text-xs">{bs(m.bs)}</p>
    {nota && <p className="text-xs opacity-80">{nota}</p>}
  </div>
);

/** Egresos reales (caja) contra ingresos del período, con detalle y exportación; y el Libro de Compras del mes. */
export function ReporteEgresos({ recarga }: { recarga: number }) {
  const { avisar } = useAvisos();
  const hoy = hoyLocal();
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}01`);
  const [hasta, setHasta] = useState(hoy);
  const [mesLibro, setMesLibro] = useState(hoy.slice(0, 7));
  const [datos, setDatos] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(false);

  const consultar = useCallback(async (d: string, h: string) => {
    setCargando(true);
    try { setDatos(await pedir<Reporte>(`/api/tesoreria/compras/reporte?desde=${d}&hasta=${h}`)); }
    catch (e) { avisar({ tipo: 'error', mensaje: getErrorMessage(e) }); }
    finally { setCargando(false); }
  }, [avisar]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => diferir(() => void consultar(desde, hasta)), [recarga, consultar]);

  const exportar = async () => {
    if (!datos) return;
    const n = (c: number) => c / 100;
    await descargarExcel(`Egresos_vs_ingresos_${datos.desde}_a_${datos.hasta}.xlsx`, [
      { nombreHoja: 'RESUMEN', data: [
        { CONCEPTO: 'Ingresos', 'DÓLARES ($)': n(datos.ingresos.usd), 'BOLÍVARES (Bs)': n(datos.ingresos.bs) },
        ...Object.entries(datos.egresos.porTipo).map(([k, v]) => ({ CONCEPTO: `Egreso: ${ETIQUETA[k] ?? k}`, 'DÓLARES ($)': n(v!.usd), 'BOLÍVARES (Bs)': n(v!.bs) })),
        { CONCEPTO: 'Total egresos', 'DÓLARES ($)': n(datos.egresos.total.usd), 'BOLÍVARES (Bs)': n(datos.egresos.total.bs) },
        { CONCEPTO: 'Resultado', 'DÓLARES ($)': n(datos.resultado.usd), 'BOLÍVARES (Bs)': n(datos.resultado.bs) },
        { CONCEPTO: 'Comprometido por pagar (no resta)', 'DÓLARES ($)': n(datos.comprometido.usd), 'BOLÍVARES (Bs)': n(datos.comprometido.bs) },
      ] },
      { nombreHoja: 'COMPRAS', data: datos.detalleCompras.length ? datos.detalleCompras : [{ fecha: 'Sin compras en el período' }] },
      { nombreHoja: 'GASTOS MENORES', data: datos.detalleGastos.length ? datos.detalleGastos : [{ fecha: 'Sin gastos menores en el período' }] },
      { nombreHoja: 'DETALLE', data: [
        ...datos.porProveedor.map((p) => ({ TIPO: 'Proveedor', NOMBRE: p.proveedor, 'PAGADO ($)': n(p.pagadoUsd), 'PENDIENTE ($)': n(p.pendienteUsd), 'MONTO ($)': '' })),
        ...datos.porCategoria.map((c) => ({ TIPO: 'Categoría', NOMBRE: c.categoria, 'PAGADO ($)': '', 'PENDIENTE ($)': '', 'MONTO ($)': n(c.usd) })),
        ...datos.porProducto.map((p) => ({ TIPO: 'Producto', NOMBRE: `${p.producto} (${p.categoria})`, 'PAGADO ($)': '', 'PENDIENTE ($)': '', 'MONTO ($)': n(p.usd) })),
      ] },
    ]);
  };

  const libro = async () => {
    try {
      const r = await pedir<{ filas: Record<string, string | number>[]; totales: { alicuota: number; base: number; iva: number }[] }>(`/api/tesoreria/compras/libro?mes=${mesLibro}`);
      await descargarExcel(`Libro_de_compras_${mesLibro}.xlsx`, [
        { nombreHoja: 'LIBRO DE COMPRAS', data: r.filas.length ? r.filas : [{ FECHA: 'Sin facturas en el mes' }] },
        { nombreHoja: 'TOTALES', data: r.totales.map((t) => ({ '% ALÍCUOTA': t.alicuota, 'BASE IMPONIBLE (Bs)': t.base / 100, 'IVA (Bs)': t.iva / 100 })) },
      ]);
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    }
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-3xl">
      <CardContent className="space-y-4 p-6 text-xs">
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 font-bold text-slate-700">Desde<Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" /></label>
          <label className="space-y-1 font-bold text-slate-700">Hasta<Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9" /></label>
          <Button size="sm" disabled={cargando} onClick={() => void consultar(desde, hasta)} className="rounded-lg text-xs font-bold">{cargando ? 'Consultando…' : 'Consultar'}</Button>
          <Button size="sm" variant="outline" disabled={!datos} onClick={() => void exportar()} className="rounded-lg text-xs font-bold"><FileSpreadsheet className="h-3.5 w-3.5" />Exportar Excel</Button>
          <span className="mx-2 h-6 w-px bg-slate-200" />
          <label className="space-y-1 font-bold text-slate-700">Libro de Compras<Input type="month" value={mesLibro} onChange={(e) => setMesLibro(e.target.value)} className="h-9" /></label>
          <Button size="sm" variant="outline" onClick={() => void libro()} className="rounded-lg text-xs font-bold"><BookOpen className="h-3.5 w-3.5" />Descargar libro</Button>
        </div>

        {datos && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Tarjeta titulo="Ingresos" m={datos.ingresos} color="border-emerald-200 bg-emerald-50 text-emerald-900" nota="Cobrado a pacientes + ingresos extraordinarios" />
              <Tarjeta titulo="Egresos" m={datos.egresos.total} color="border-rose-200 bg-rose-50 text-rose-900" nota="Lo que salió de las cuentas" />
              <Tarjeta titulo="Resultado" m={datos.resultado} color="border-slate-200 bg-slate-50 text-slate-900" />
              <Tarjeta titulo="Por pagar" m={datos.comprometido} color="border-amber-200 bg-amber-50 text-amber-900" nota="Comprometido; no se resta" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datos.porPeriodo.map((p) => ({ periodo: p.periodo, Ingresos: p.ingresos / 100, Egresos: p.egresos / 100 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="periodo" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#059669" />
                  <Bar dataKey="Egresos" fill="#e11d48" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <p className="mb-1 font-bold">Egresos por tipo</p>
                {Object.entries(datos.egresos.porTipo).map(([k, v]) => <div key={k} className="flex justify-between border-b border-slate-100 py-1"><span>{ETIQUETA[k] ?? k}</span><span className="font-mono">{usd(v!.usd)}</span></div>)}
                <p className="mb-1 mt-3 font-bold">Por categoría</p>
                {datos.porCategoria.map((c) => <div key={c.categoria} className="flex justify-between border-b border-slate-100 py-1"><span>{c.categoria}</span><span className="font-mono">{usd(c.usd)}</span></div>)}
              </div>
              <div>
                <p className="mb-1 font-bold">Por proveedor</p>
                {datos.porProveedor.length === 0 && <p className="text-slate-500">Sin compras a proveedores.</p>}
                {datos.porProveedor.map((p) => (
                  <div key={p.proveedor} className="flex justify-between border-b border-slate-100 py-1">
                    <span>{p.proveedor}</span><span className="font-mono">{usd(p.pagadoUsd)}{p.pendienteUsd > 0 && <span className="text-amber-700"> · debe {usd(p.pendienteUsd)}</span>}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1 font-bold">Por producto (facturas del período)</p>
                {datos.porProducto.length === 0 && <p className="text-slate-500">Sin compras registradas.</p>}
                {datos.porProducto.map((p) => <div key={`${p.categoria}|${p.producto}`} className="flex justify-between border-b border-slate-100 py-1"><span>{p.producto} <span className="text-slate-500">× {(p.cantidad / 1000).toLocaleString('es-VE')}</span></span><span className="font-mono">{usd(p.usd)}</span></div>)}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
