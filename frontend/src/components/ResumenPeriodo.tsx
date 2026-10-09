'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { hoyLocal } from '@/lib/date';
import { diferir } from '@/lib/diferir';
import { getErrorMessage } from '@/lib/utils';
import { rangoValido, type ResumenPeriodo as Resumen, type Totales } from '@/lib/resumenPeriodo';

type Respuesta = Resumen & { desde: string; hasta: string; totalFacturado: number };

const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Fila: React.FC<{ nombre: string; t: Totales; sangria?: boolean; fuerte?: boolean }> = ({ nombre, t, sangria, fuerte }) => (
  <tr className={`${fuerte ? 'bg-slate-100 font-black' : ''} border-b border-slate-100`}>
    <td className={`py-1.5 pr-2 ${sangria ? 'pl-5 text-slate-700' : 'font-bold text-slate-900'}`}>{nombre}</td>
    <td className="px-2 text-right font-mono">{t.cantidad}</td>
    <td className="px-2 text-right font-mono">{usd(t.lista)}</td>
    <td className="px-2 text-right font-mono">{t.descuento > 0 ? `−${usd(t.descuento)}` : '—'}</td>
    <td className="px-2 text-right font-mono">{usd(t.cobrado)}</td>
    <td className="px-2 text-right font-mono">{usd(t.honorarios)}</td>
    <td className="pl-2 text-right font-mono text-emerald-800">{usd(t.ganancia)}</td>
  </tr>
);

const Encabezado: React.FC<{ primera: string }> = ({ primera }) => (
  <thead>
    <tr className="border-b border-slate-300 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">
      <th className="py-1.5 pr-2">{primera}</th>
      <th className="px-2 text-right">Cant.</th>
      <th className="px-2 text-right">Lista</th>
      <th className="px-2 text-right">Descuento</th>
      <th className="px-2 text-right">Cobrado</th>
      <th className="px-2 text-right">Honorarios</th>
      <th className="pl-2 text-right">Ganancia clínica</th>
    </tr>
  </thead>
);

/** Resultado por servicio y por doctor de un período Desde–Hasta (admin y asistente). */
export const ResumenPeriodo: React.FC<{ fechaInicial: string }> = ({ fechaInicial }) => {
  const [desde, setDesde] = useState(fechaInicial);
  const [hasta, setHasta] = useState(fechaInicial);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const consultar = useCallback(async (d: string, h: string) => {
    const err = rangoValido(d, h);
    if (err) { setError(err); return; }
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api/cierres/resumen-servicios?desde=${d}&hasta=${h}`);
      const j = (await r.json()) as Respuesta & { error?: string };
      if (!r.ok) throw new Error(j.error ?? 'No se pudo cargar el resumen.');
      setDatos(j);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => diferir(() => { void consultar(fechaInicial, fechaInicial); setDesde(fechaInicial); setHasta(fechaInicial); }), [fechaInicial, consultar]);

  const hoy = hoyLocal();
  const atajo = (d: string, h: string) => { setDesde(d); setHasta(h); void consultar(d, h); };

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-6 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-900">
          <TrendingUp className="h-4 w-4 text-emerald-700" />Resultado por servicio y por doctor
        </CardTitle>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-bold text-slate-700">Desde<Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" /></label>
          <label className="space-y-1 text-xs font-bold text-slate-700">Hasta<Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9" /></label>
          <Button size="sm" disabled={cargando} onClick={() => void consultar(desde, hasta)} className="rounded-lg text-xs font-bold">{cargando ? 'Consultando…' : 'Consultar'}</Button>
          <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => atajo(fechaInicial, fechaInicial)}>Día del cierre</Button>
          <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => atajo(`${hoy.slice(0, 8)}01`, hoy)}>Mes actual</Button>
        </div>
        {error && <p className="mt-2 text-xs font-bold text-rose-700">{error}</p>}
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {datos && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Badge variant="outline" className={datos.cuadra ? 'border-emerald-400 text-emerald-800' : 'border-rose-400 text-rose-800'}>
                {datos.cuadra ? 'Cuadra con lo facturado' : `No cuadra: facturado ${usd(datos.totalFacturado)} vs servicios ${usd(datos.total.cobrado)}`}
              </Badge>
              <span className="text-slate-700">{datos.desde === datos.hasta ? datos.desde : `${datos.desde} al ${datos.hasta}`} · {datos.total.cantidad} servicios</span>
            </div>
            {datos.total.cantidad === 0 ? (
              <p className="text-sm text-slate-600">No hay servicios facturados en este período.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-xs">
                    <Encabezado primera="Servicio" />
                    <tbody>
                      {datos.porArea.map((a) => (
                        <React.Fragment key={a.area}>
                          <Fila nombre={a.area} t={a} />
                          {a.estudios.map((e) => <Fila key={`${a.area}|${e.estudio}`} nombre={e.estudio} t={e} sangria />)}
                        </React.Fragment>
                      ))}
                      <Fila nombre="TOTAL" t={datos.total} fuerte />
                    </tbody>
                  </table>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-xs">
                    <Encabezado primera="Doctor" />
                    <tbody>
                      {datos.porDoctor.map((d) => <Fila key={d.medico} nombre={d.medico} t={d} />)}
                      <Fila nombre="TOTAL" t={datos.total} fuerte />
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
