'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RANGOS_ETARIOS, type Filtros } from '@/lib/segmentos';

export interface FormFiltros {
  edadMin: string; edadMax: string;
  estudios: string[]; areas: string[]; medicos: string[];
  desde: string; hasta: string; inactivoDias: string;
  visitasMin: string; visitasMax: string; gastoMin: string; gastoMax: string;
  busqueda: string;
}

export const FORM_VACIO: FormFiltros = {
  edadMin: '', edadMax: '', estudios: [], areas: [], medicos: [], desde: '', hasta: '', inactivoDias: '',
  visitasMin: '', visitasMax: '', gastoMin: '', gastoMax: '', busqueda: '',
};

const num = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function aFiltros(f: FormFiltros): Filtros {
  const ent = (s: string) => { const n = num(s); return n === null ? null : Math.floor(n); };
  return {
    edadMin: ent(f.edadMin), edadMax: ent(f.edadMax),
    estudios: f.estudios, areas: f.areas, medicos: f.medicos,
    ultimaVisitaDesde: f.desde || null, ultimaVisitaHasta: f.hasta || null,
    inactivoDias: ent(f.inactivoDias),
    visitasMin: ent(f.visitasMin), visitasMax: ent(f.visitasMax),
    gastoMinUsd: num(f.gastoMin), gastoMaxUsd: num(f.gastoMax),
    busqueda: f.busqueda.trim() || null,
  };
}

interface Props {
  form: FormFiltros;
  setForm: React.Dispatch<React.SetStateAction<FormFiltros>>;
  opciones: { areas: string[]; medicos: string[]; estudios: string[] };
  buscando: boolean;
  onBuscar: () => void;
}

const chip = (activo: boolean) =>
  `px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${activo ? 'bg-clinica-primary text-white border-clinica-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`;

const Campo: React.FC<{ etiqueta: string; children: React.ReactNode }> = ({ etiqueta, children }) => (
  <div className="space-y-1">
    <span className="text-[10px] font-black uppercase text-slate-500 block">{etiqueta}</span>
    {children}
  </div>
);

function Multi({ valores, opciones, onChange }: { valores: string[]; opciones: string[]; onChange: (v: string[]) => void }) {
  const alternar = (o: string) => onChange(valores.includes(o) ? valores.filter((x) => x !== o) : [...valores, o]);
  return (
    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
      {opciones.length === 0 && <span className="text-[11px] text-slate-400">Sin datos</span>}
      {opciones.map((o) => <button key={o} type="button" onClick={() => alternar(o)} className={chip(valores.includes(o))}>{o}</button>)}
    </div>
  );
}

export const FiltrosSegmento: React.FC<Props> = ({ form, setForm, opciones, buscando, onBuscar }) => {
  const set = <K extends keyof FormFiltros>(k: K, v: FormFiltros[K]) => setForm((p) => ({ ...p, [k]: v }));
  const rangoActivo = (min: number, max: number) => form.edadMin === String(min) && form.edadMax === String(max);
  const entrada = (k: 'edadMin' | 'edadMax' | 'inactivoDias' | 'visitasMin' | 'visitasMax' | 'gastoMin' | 'gastoMax', ph: string) => (
    <Input inputMode="decimal" value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="h-8 text-xs rounded-xl font-mono" />
  );
  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6 space-y-2">
          <Campo etiqueta="Rango etario">
            <div className="flex flex-wrap gap-1.5">
              {RANGOS_ETARIOS.map((r) => (
                <button key={r.id} type="button" className={chip(rangoActivo(r.min, r.max))}
                  onClick={() => setForm((p) => rangoActivo(r.min, r.max) ? { ...p, edadMin: '', edadMax: '' } : { ...p, edadMin: String(r.min), edadMax: String(r.max) })}>
                  {r.etiqueta}
                </button>
              ))}
            </div>
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Edad mínima">{entrada('edadMin', 'Ej. 40')}</Campo>
            <Campo etiqueta="Edad máxima">{entrada('edadMax', 'Ej. 65')}</Campo>
          </div>
        </div>
        <div className="md:col-span-6 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Última visita desde"><Input type="date" value={form.desde} onChange={(e) => set('desde', e.target.value)} className="h-8 text-xs rounded-xl font-mono" /></Campo>
            <Campo etiqueta="Última visita hasta"><Input type="date" value={form.hasta} onChange={(e) => set('hasta', e.target.value)} className="h-8 text-xs rounded-xl font-mono" /></Campo>
          </div>
          <Campo etiqueta="Inactivos (sin venir hace N días)">
            <div className="flex flex-wrap items-center gap-1.5">
              {[90, 180, 365].map((d) => (
                <button key={d} type="button" className={chip(form.inactivoDias === String(d))}
                  onClick={() => set('inactivoDias', form.inactivoDias === String(d) ? '' : String(d))}>{d} días</button>
              ))}
              <div className="w-24">{entrada('inactivoDias', 'Otro')}</div>
            </div>
          </Campo>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Campo etiqueta="Visitas mín.">{entrada('visitasMin', '0')}</Campo>
        <Campo etiqueta="Visitas máx.">{entrada('visitasMax', '∞')}</Campo>
        <Campo etiqueta="Gasto mín. (USD)">{entrada('gastoMin', '0')}</Campo>
        <Campo etiqueta="Gasto máx. (USD)">{entrada('gastoMax', '∞')}</Campo>
        <Campo etiqueta="Nombre / cédula">
          <Input value={form.busqueda} onChange={(e) => set('busqueda', e.target.value)} placeholder="Buscar" className="h-8 text-xs rounded-xl" />
        </Campo>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Campo etiqueta="Área realizada"><Multi valores={form.areas} opciones={opciones.areas} onChange={(v) => set('areas', v)} /></Campo>
        <Campo etiqueta="Médico tratante"><Multi valores={form.medicos} opciones={opciones.medicos} onChange={(v) => set('medicos', v)} /></Campo>
        <Campo etiqueta="Estudio realizado"><Multi valores={form.estudios} opciones={opciones.estudios} onChange={(v) => set('estudios', v)} /></Campo>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <Button onClick={onBuscar} disabled={buscando} className="rounded-xl text-xs font-bold bg-clinica-primary text-white">
          {buscando ? 'Buscando…' : 'Buscar pacientes'}
        </Button>
        <Button variant="outline" className="rounded-xl text-xs" onClick={() => setForm(FORM_VACIO)}>Limpiar filtros</Button>
      </div>
    </div>
  );
};
