'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, FileSpreadsheet } from 'lucide-react';
import { hoyLocal } from '@/lib/date';
import { diferir } from '@/lib/diferir';
import { descargarExcel, type Fila } from '@/lib/excel';
import { getErrorMessage } from '@/lib/utils';
import type { Matriz } from '@/lib/matrizHonorarios';

type Medida = 'generado' | 'pagado' | 'pendiente';
const ETIQUETA: Record<Medida, string> = { generado: 'Generado', pagado: 'Pagado', pendiente: 'Pendiente' };

const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const celda = (c: number) => (c === 0 ? '' : (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** Cuadro mensual de honorarios: doctores en filas, días del mes en columnas (solo lectura). */
export const MatrizHonorarios: React.FC = () => {
  const [mes, setMes] = useState(() => hoyLocal().slice(0, 7));
  const [doctor, setDoctor] = useState('TODOS');
  const [medida, setMedida] = useState<Medida>('generado');
  const [datos, setDatos] = useState<(Matriz & { mes: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (m: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) { setError('Seleccione un mes válido.'); return; }
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api/tesoreria/honorarios/matriz?mes=${m}`);
      const j = (await r.json()) as Matriz & { mes: string; error?: string };
      if (!r.ok) throw new Error(j.error ?? 'No se pudo cargar el cuadro.');
      setDatos(j);
      setDoctor('TODOS');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => diferir(() => { void cargar(mes); }), [mes, cargar]);

  const filas = datos ? datos.medicos.filter((m) => doctor === 'TODOS' || m.medico === doctor) : [];
  const totalesDia = datos ? datos.dias.map((_, i) => filas.reduce((a, m) => a + m[medida][i], 0)) : [];
  const totalGeneral = filas.reduce((a, m) => a + m.totales[medida], 0);

  const exportar = async () => {
    if (!datos) return;
    const data: Fila[] = filas.map((m) => {
      const fila: Fila = { Doctor: m.medico };
      datos.dias.forEach((d, i) => { fila[String(d)] = m[medida][i] / 100; });
      fila.Total = m.totales[medida] / 100;
      return fila;
    });
    const pie: Fila = { Doctor: 'TOTAL' };
    datos.dias.forEach((d, i) => { pie[String(d)] = totalesDia[i] / 100; });
    pie.Total = totalGeneral / 100;
    await descargarExcel(`honorarios-${datos.mes}-${medida}.xlsx`, [{ nombreHoja: `Honorarios ${datos.mes}`, data: [...data, pie], anchoMinimo: 8 }]);
  };

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-6 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-900">
          <CalendarDays className="h-4 w-4 text-clinica-primary" />Honorarios por doctor y por día
        </CardTitle>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-bold text-slate-700">Mes<Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9" /></label>
          <label className="space-y-1 text-xs font-bold text-slate-700">Doctor
            <select value={doctor} onChange={(e) => setDoctor(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal">
              <option value="TODOS">Todos</option>
              {(datos?.medicos ?? []).map((m) => <option key={m.medico} value={m.medico}>{m.medico}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-bold text-slate-700">Ver
            <select value={medida} onChange={(e) => setMedida(e.target.value as Medida)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal">
              {(Object.keys(ETIQUETA) as Medida[]).map((k) => <option key={k} value={k}>{ETIQUETA[k]}</option>)}
            </select>
          </label>
          <Button size="sm" variant="outline" disabled={!datos || filas.length === 0} onClick={() => void exportar()} className="rounded-lg text-xs font-bold">
            <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />Exportar Excel
          </Button>
          {cargando && <span className="text-xs text-slate-600">Cargando…</span>}
        </div>
        <p className="mt-2 text-[11px] text-slate-600">
          Generado = honorarios de los servicios facturados (incluye la parte del patólogo cuando aplica). Pagado = lo liquidado en el sistema. Pendiente = generado − pagado.
        </p>
        {error && <p className="mt-2 text-xs font-bold text-rose-700">{error}</p>}
      </CardHeader>
      <CardContent className="p-0">
        {datos && filas.length === 0 && <p className="p-6 text-sm text-slate-600">No hay honorarios en este mes.</p>}
        {datos && filas.length > 0 && (
          <>
            <div className="flex flex-wrap gap-4 border-b border-slate-100 px-6 py-3 text-xs">
              {(Object.keys(ETIQUETA) as Medida[]).map((k) => (
                <span key={k} className={k === medida ? 'font-black text-slate-900' : 'text-slate-700'}>
                  {ETIQUETA[k]}: <span className="font-mono">{usd(filas.reduce((a, m) => a + m.totales[k], 0))}</span>
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600">
                    <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-bold">Doctor</th>
                    {datos.dias.map((d) => <th key={d} className="min-w-[44px] px-1 py-2 text-right font-mono font-bold">{d}</th>)}
                    <th className="px-3 py-2 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((m) => (
                    <tr key={m.medico} className="border-b border-slate-100">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-bold text-slate-900">{m.medico}</td>
                      {m[medida].map((c, i) => <td key={i} className="px-1 text-right font-mono text-slate-800">{celda(c)}</td>)}
                      <td className="px-3 text-right font-mono font-black text-slate-900">{usd(m.totales[medida])}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black">
                    <td className="sticky left-0 z-10 bg-slate-100 px-3 py-1.5">TOTAL</td>
                    {totalesDia.map((c, i) => <td key={i} className="px-1 text-right font-mono">{celda(c)}</td>)}
                    <td className="px-3 text-right font-mono">{usd(totalGeneral)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
