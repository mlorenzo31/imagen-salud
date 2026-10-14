'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, LineChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FilasSkeleton } from '@/components/ui/skeleton';
import { hoyLocal } from '@/lib/date';
import { diferir } from '@/lib/diferir';
import { descargarExcel } from '@/lib/excel';
import { getErrorMessage } from '@/lib/utils';
import type { TotalCambiario } from '@/lib/operacionesCambiarias';

interface Operacion {
  id: number; tipo: 'COMPRA' | 'VENTA'; fecha: string; tasa: number; usd: number; bs: number; comisionBs: number;
  cuentaBs: string; referencia: string; notas: string; usuario: string;
}
interface Reporte { desde: string; hasta: string; operaciones: Operacion[]; compras: TotalCambiario; ventas: TotalCambiario; netoUsd: number }

const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const bs = (c: number) => `${(c / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
const tasaFmt = (t: number | null) => (t === null ? '—' : t.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

const Kpi = ({ titulo, t, color }: { titulo: string; t: TotalCambiario; color: string }) => (
  <div className={`rounded-xl border p-3 ${color}`}>
    <p className="text-xs font-bold uppercase tracking-wide">{titulo} · {t.cantidad}</p>
    <p className="mt-1 font-mono text-lg font-black">{usd(t.usd)}</p>
    <p className="font-mono text-xs">{bs(t.bs)} · tasa prom. {tasaFmt(t.tasaPromedio)}</p>
    {t.comisionBs > 0 && <p className="font-mono text-xs">Comisiones: {bs(t.comisionBs)}</p>}
  </div>
);

/** Reporte de compras y ventas de divisas por rango de fechas, con exportación a Excel. */
export function ReporteCambiario({ recarga }: { recarga: number }) {
  const hoy = hoyLocal();
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}01`);
  const [hasta, setHasta] = useState(hoy);
  const [datos, setDatos] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async (d: string, h: string) => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api/tesoreria/cambio-divisa?desde=${d}&hasta=${h}`);
      const j = (await r.json()) as Reporte & { error?: string };
      if (!r.ok) throw new Error(j.error ?? 'No se pudo cargar el reporte.');
      setDatos(j);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCargando(false);
    }
  }, []);

  // Se recarga al abrir y cada vez que se registra una operación (recarga cambia).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => diferir(() => void consultar(desde, hasta)), [recarga, consultar]);

  const exportar = async () => {
    if (!datos) return;
    const filas = datos.operaciones.map((o) => ({
      FECHA: o.fecha, OPERACIÓN: o.tipo === 'COMPRA' ? 'Compra' : 'Venta', 'DÓLARES ($)': o.usd / 100, 'TASA (Bs/$)': o.tasa,
      'BOLÍVARES (Bs)': o.bs / 100, 'COMISIÓN (Bs)': o.comisionBs / 100,
      'CUENTA EN Bs': o.cuentaBs, REFERENCIA: o.referencia, NOTAS: o.notas, USUARIO: o.usuario,
    }));
    const resumen = [
      { CONCEPTO: 'Compras', CANTIDAD: datos.compras.cantidad, 'DÓLARES ($)': datos.compras.usd / 100, 'BOLÍVARES (Bs)': datos.compras.bs / 100, 'COMISIONES (Bs)': datos.compras.comisionBs / 100, 'TASA PROMEDIO': datos.compras.tasaPromedio ?? '' },
      { CONCEPTO: 'Ventas', CANTIDAD: datos.ventas.cantidad, 'DÓLARES ($)': datos.ventas.usd / 100, 'BOLÍVARES (Bs)': datos.ventas.bs / 100, 'COMISIONES (Bs)': datos.ventas.comisionBs / 100, 'TASA PROMEDIO': datos.ventas.tasaPromedio ?? '' },
      { CONCEPTO: 'Neto $ (compras − ventas)', CANTIDAD: '', 'DÓLARES ($)': datos.netoUsd / 100, 'BOLÍVARES (Bs)': '', 'COMISIONES (Bs)': '', 'TASA PROMEDIO': '' },
    ];
    await descargarExcel(`Operaciones_cambiarias_${datos.desde}_a_${datos.hasta}.xlsx`, [
      { nombreHoja: 'OPERACIONES', data: filas.length ? filas : [{ FECHA: 'Sin operaciones en el período' }] },
      { nombreHoja: 'RESUMEN', data: resumen },
    ]);
  };

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-6 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-900">
          <LineChart className="h-4 w-4 text-blue-700" />Reporte de operaciones cambiarias
        </CardTitle>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-bold text-slate-700">Desde<Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" /></label>
          <label className="space-y-1 text-xs font-bold text-slate-700">Hasta<Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9" /></label>
          <Button size="sm" disabled={cargando} onClick={() => void consultar(desde, hasta)} className="rounded-lg text-xs font-bold">{cargando ? 'Consultando…' : 'Consultar'}</Button>
          <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => { setDesde(hoy); setHasta(hoy); void consultar(hoy, hoy); }}>Hoy</Button>
          <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => { const d = `${hoy.slice(0, 8)}01`; setDesde(d); setHasta(hoy); void consultar(d, hoy); }}>Mes actual</Button>
          <Button size="sm" variant="outline" disabled={!datos} onClick={() => void exportar()} className="rounded-lg text-xs font-bold">
            <FileSpreadsheet className="h-3.5 w-3.5" />Exportar Excel
          </Button>
        </div>
        {error && <p className="mt-2 text-xs font-bold text-rose-700">{error}</p>}
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {datos && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi titulo="Compras" t={datos.compras} color="border-emerald-200 bg-emerald-50 text-emerald-900" />
            <Kpi titulo="Ventas" t={datos.ventas} color="border-amber-200 bg-amber-50 text-amber-900" />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide">Neto en divisas</p>
              <p className="mt-1 font-mono text-lg font-black">{datos.netoUsd < 0 ? '−' : ''}{usd(Math.abs(datos.netoUsd))}</p>
              <p className="text-xs">$ comprados − $ vendidos</p>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-left font-bold uppercase tracking-wider text-slate-600">
                <th className="py-1.5 pr-2">Fecha</th><th className="px-2">Operación</th><th className="px-2 text-right">Dólares</th>
                <th className="px-2 text-right">Tasa</th><th className="px-2 text-right">Bolívares</th><th className="px-2 text-right">Comisión</th>
                <th className="px-2">Cuenta Bs</th><th className="pl-2">Referencia</th>
              </tr>
            </thead>
            {cargando && !datos ? <tbody><FilasSkeleton columnas={8} /></tbody> : (
              <tbody>
                {datos?.operaciones.length === 0 && (
                  <tr><td colSpan={8} className="py-6 text-center text-slate-500">No hay operaciones cambiarias en este período.</td></tr>
                )}
                {datos?.operaciones.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 font-mono">{o.fecha}</td>
                    <td className="px-2">
                      <Badge className={o.tipo === 'COMPRA' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>{o.tipo === 'COMPRA' ? 'Compra' : 'Venta'}</Badge>
                    </td>
                    <td className="px-2 text-right font-mono font-bold">{usd(o.usd)}</td>
                    <td className="px-2 text-right font-mono">{tasaFmt(o.tasa)}</td>
                    <td className="px-2 text-right font-mono">{bs(o.bs)}</td>
                    <td className="px-2 text-right font-mono">{o.comisionBs > 0 ? bs(o.comisionBs) : '—'}</td>
                    <td className="px-2">{o.cuentaBs}</td>
                    <td className="pl-2 text-slate-600">{o.referencia}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
