'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAvisos } from '@/components/ui/avisos';
import { diferir } from '@/lib/diferir';
import { descargarExcel } from '@/lib/excel';
import { getErrorMessage } from '@/lib/utils';
import { hoyLocal } from '@/lib/date';
import type { ResumenLibro } from '@/lib/fiscal/libroVentas';
import { bs } from './TarjetasResumen';

interface Libros {
  mes: string;
  ventas: { filas: Record<string, string | number>[]; resumen: ResumenLibro };
  pendientes: Array<{ id: number; tipo: string; numero: string; fecha: string; estado: string; receptor_nombre: string; ultimo_error: string | null }>;
  anulados: Array<{ fecha: string; nota: string; nota_control: string | null; motivo: string | null; serie: string; factura: string; factura_control: string | null;
    factura_fecha: string; receptor_nombre: string; factura_total_bs: string; nota_total_bs: string; total: boolean }>;
  contingencias: Array<{ id: number; motivo: string; fecha_inicio: string; hora_inicio: string; fecha_fin: string | null; hora_fin: string | null;
    fecha_envio: string | null; documentos: number; cumplimiento: 'ACTIVA' | 'SIN_ENVIAR' | 'A_TIEMPO' | 'TARDE' }>;
}

const CUMPLIMIENTO = { ACTIVA: 'Activa', SIN_ENVIAR: 'Sin remitir', A_TIEMPO: 'Remitida a tiempo', TARDE: 'Remitida tarde' } as const;
const COLUMNAS = ['FECHA', 'TIPO DOCUMENTO', 'SERIE', 'N° FACTURA', 'N° CONTROL', 'FACTURA AFECTADA', 'RIF / CÉDULA', 'NOMBRE O RAZÓN SOCIAL', 'TOTAL VENTA CON IVA', 'VENTAS EXENTAS', 'BASE IMPONIBLE', '% ALÍCUOTA', 'IVA', 'IGTF', 'IVA RETENIDO'];
const NUMERICAS = new Set(['TOTAL VENTA CON IVA', 'VENTAS EXENTAS', 'BASE IMPONIBLE', 'IVA', 'IGTF', 'IVA RETENIDO']);
const fmt = (v: string | number) => (typeof v === 'number' ? v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v);

/** Libro de ventas del mes, documentos sin N° de control, anulaciones (art. 21) y contingencias (art. 7). */
export const LibrosFiscales: React.FC = () => {
  const { avisar } = useAvisos();
  const [mes, setMes] = useState(hoyLocal().slice(0, 7));
  const [datos, setDatos] = useState<Libros | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/fiscal/libros?mes=${mes}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudieron cargar los libros.');
      setDatos(j);
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    }
  }, [mes, avisar]);
  useEffect(() => diferir(() => void cargar()), [cargar]);

  const exportar = () => {
    if (!datos) return;
    void descargarExcel(`libros_fiscales_${datos.mes}`, [
      { nombreHoja: 'Libro de ventas', data: datos.ventas.filas },
      { nombreHoja: 'Anulaciones (art. 21)', data: datos.anulados.map((a) => ({
        Fecha: a.fecha, 'Nota de crédito': a.nota, 'N° control NC': a.nota_control ?? '', Serie: a.serie, 'Factura original': a.factura,
        'N° control factura': a.factura_control ?? '', 'Fecha factura': a.factura_fecha, Receptor: a.receptor_nombre,
        'Total factura Bs': Number(a.factura_total_bs), 'Total NC Bs': Number(a.nota_total_bs), Alcance: a.total ? 'Total' : 'Parcial', Motivo: a.motivo ?? '',
      })) },
      { nombreHoja: 'Contingencias', data: datos.contingencias.map((c) => ({
        N: c.id, Motivo: c.motivo, Inicio: `${c.fecha_inicio} ${c.hora_inicio}`, Fin: c.fecha_fin ? `${c.fecha_fin} ${c.hora_fin ?? ''}` : '',
        Documentos: c.documentos, 'Remitida el': c.fecha_envio ?? '', Cumplimiento: CUMPLIMIENTO[c.cumplimiento],
      })) },
    ]);
  };

  const r = datos?.ventas.resumen;
  const tarjetas: Array<[string, string]> = r ? [
    ['Documentos', String(r.documentos)], ['Ventas exentas', bs(r.exento)],
    ...r.alicuotas.map((a): [string, string] => [`Base ${a.alicuota}% / IVA`, `${bs(a.base)} / ${bs(a.iva)}`]),
    ['IGTF', bs(r.igtf)], ['Total', bs(r.total)], ['IVA retenido por clientes', bs(r.ivaRetenido)],
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="mb-1 block text-xs font-bold text-slate-600">Mes</label><Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="h-9" /></div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportar} disabled={!datos}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
      </div>

      {datos && datos.pendientes.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><span className="font-bold">{datos.pendientes.length} documento(s) del mes sin N° de control: no entran al libro hasta que la imprenta los emita.</span>{' '}
            {datos.pendientes.map((p) => `${p.tipo === 'FACTURA' ? 'Factura' : p.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'} ${p.numero}`).join(' · ')}</p>
        </div>
      )}

      {r && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tarjetas.map(([t, v]) => (
            <div key={t} className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t}</p>
              <p className="text-base font-black text-slate-900">{v}</p>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-800">Libro de ventas</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-600"><tr>{COLUMNAS.map((c) => <th key={c} className={`p-2 whitespace-nowrap ${NUMERICAS.has(c) ? 'text-right' : ''}`}>{c}</th>)}</tr></thead>
            <tbody>
              {datos?.ventas.filas.length === 0 && <tr><td colSpan={COLUMNAS.length} className="p-6 text-center text-slate-500">Sin documentos emitidos en el mes.</td></tr>}
              {datos?.ventas.filas.map((f, i) => (
                <tr key={i} className={`border-t border-slate-100 ${f.MEDIO === 'CONTINGENCIA' ? 'bg-violet-50/50' : ''}`}>
                  {COLUMNAS.map((c) => <td key={c} className={`p-2 whitespace-nowrap ${NUMERICAS.has(c) ? 'text-right font-mono' : ''}`}>{fmt(f[c] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Las filas en violeta son de talonario (contingencia). Las notas de crédito restan.</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-800">Anulaciones por nota de crédito (originales conservados, art. 21)</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Fecha</th><th className="p-2">Nota de crédito</th><th className="p-2">Factura original</th><th className="p-2">Receptor</th><th className="p-2 text-right">Factura</th><th className="p-2 text-right">NC</th><th className="p-2">Alcance</th><th className="p-2">Motivo</th></tr></thead>
            <tbody>
              {datos?.anulados.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-slate-500">Sin notas de crédito en el mes.</td></tr>}
              {datos?.anulados.map((a) => (
                <tr key={a.nota} className="border-t border-slate-100">
                  <td className="p-2">{a.fecha}</td><td className="p-2 font-mono">{a.nota} · {a.nota_control ?? '—'}</td>
                  <td className="p-2 font-mono">{a.serie ? `${a.serie}-` : ''}{a.factura} · {a.factura_control ?? '—'} ({a.factura_fecha})</td>
                  <td className="p-2">{a.receptor_nombre}</td>
                  <td className="p-2 text-right font-mono">{fmt(Number(a.factura_total_bs))}</td><td className="p-2 text-right font-mono">{fmt(Number(a.nota_total_bs))}</td>
                  <td className="p-2">{a.total ? 'Total' : 'Parcial'}</td><td className="p-2">{a.motivo ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-800">Contingencias</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">N°</th><th className="p-2">Motivo</th><th className="p-2">Inicio</th><th className="p-2">Fin</th><th className="p-2">Documentos</th><th className="p-2">Remitida</th><th className="p-2">Cumplimiento (art. 7)</th></tr></thead>
            <tbody>
              {datos?.contingencias.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-500">Sin contingencias en el mes.</td></tr>}
              {datos?.contingencias.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-2">{c.id}</td><td className="p-2">{c.motivo}</td><td className="p-2">{c.fecha_inicio} {c.hora_inicio}</td>
                  <td className="p-2">{c.fecha_fin ? `${c.fecha_fin} ${c.hora_fin ?? ''}` : '—'}</td><td className="p-2">{c.documentos}</td><td className="p-2">{c.fecha_envio ?? '—'}</td>
                  <td className={`p-2 font-bold ${c.cumplimiento === 'TARDE' || c.cumplimiento === 'SIN_ENVIAR' ? 'text-rose-700' : 'text-emerald-700'}`}>{CUMPLIMIENTO[c.cumplimiento]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
