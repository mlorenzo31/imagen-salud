'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BadgePercent, Plus } from 'lucide-react';
import { useCatalogoEstudios } from '@/lib/useCatalogoEstudios';
import { hoyLocal } from '@/lib/date';
import { diferir } from '@/lib/diferir';
import { getErrorMessage } from '@/lib/utils';
import type { PromoFila } from '@/lib/descuentosDb';

type Modo = 'CLINICA' | 'PROPORCIONAL';
type Tipo = 'PCT' | 'USD' | 'FIJO';
interface Borrador { id?: number; nombre: string; tipo: Tipo; valor: string; modo: Modo; areas: string[]; estudios: string[]; requiere: string[]; fechaDesde: string; fechaHasta: string; activa: boolean }

const vacio = (): Borrador => ({ nombre: '', tipo: 'PCT', valor: '', modo: 'CLINICA', areas: [], estudios: [], requiere: [], fechaDesde: hoyLocal(), fechaHasta: hoyLocal(), activa: true });

const etiquetaValor = (p: PromoFila) => (p.tipo === 'PCT' ? `${Number(p.valor)} %` : p.tipo === 'USD' ? `-$${Number(p.valor).toFixed(2)}` : `queda en $${Number(p.valor).toFixed(2)}`);

/** Promociones programadas: se aplican solas en caja a los estudios y fechas indicados. */
export const PanelPromociones: React.FC = () => {
  const { catalogo } = useCatalogoEstudios();
  const [lista, setLista] = useState<PromoFila[]>([]);
  const [form, setForm] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/promociones');
      const j = (await r.json()) as { promociones?: PromoFila[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? 'No se pudieron cargar las promociones.');
      setLista(j.promociones ?? []);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, []);
  useEffect(() => diferir(() => { void cargar(); }), [cargar]);

  const guardar = async (b: Borrador) => {
    setGuardando(true);
    setError(null);
    try {
      const promo = { nombre: b.nombre, tipo: b.tipo, valor: Number(b.valor.replace(',', '.')), modo: b.modo, areas: b.areas, estudios: b.estudios, requiere: b.requiere, fechaDesde: b.fechaDesde, fechaHasta: b.fechaHasta, activa: b.activa };
      const r = await fetch('/api/admin/promociones', {
        method: b.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b.id ? { id: b.id, promo } : promo),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? 'No se pudo guardar la promoción.');
      setForm(null);
      await cargar();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setGuardando(false);
    }
  };

  const alternar = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const areas = Object.keys(catalogo);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-700">Las promociones vigentes se aplican solas en caja. El cajero no puede omitirlas.</p>
        <Button onClick={() => { setError(null); setForm(vacio()); }} className="rounded-xl text-xs font-bold"><Plus className="mr-1 h-4 w-4" />Nueva promoción</Button>
      </div>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}

      {form && (
        <Card><CardContent className="space-y-3 p-4 text-sm">
          <div className="grid gap-2 md:grid-cols-4">
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre (ej. Mes Rosa)" />
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })} className="h-9 rounded-lg border border-slate-300 bg-white px-2">
              <option value="PCT">Descuento en %</option>
              <option value="USD">Descuento en $</option>
              <option value="FIJO">Precio fijo en $ (el estudio queda en…)</option>
            </select>
            <Input inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder={form.tipo === 'PCT' ? '% de descuento' : form.tipo === 'USD' ? '$ de descuento' : 'Precio final en $'} />
            <select value={form.modo} onChange={(e) => setForm({ ...form, modo: e.target.value as Modo })} className="h-9 rounded-lg border border-slate-300 bg-white px-2">
              <option value="CLINICA">La clínica asume el descuento</option>
              <option value="PROPORCIONAL">Se reparte con el doctor</option>
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1"><span className="text-xs font-bold text-slate-700">Desde</span><Input type="date" value={form.fechaDesde} onChange={(e) => setForm({ ...form, fechaDesde: e.target.value })} /></label>
            <label className="space-y-1"><span className="text-xs font-bold text-slate-700">Hasta</span><Input type="date" value={form.fechaHasta} onChange={(e) => setForm({ ...form, fechaHasta: e.target.value })} /></label>
          </div>
          <fieldset>
            <legend className="text-xs font-bold text-slate-700">Áreas que reciben el descuento (si no elige estudios, aplica a toda el área)</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {areas.map((a) => (
                <label key={a} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={form.areas.includes(a)} onChange={() => setForm({ ...form, areas: alternar(form.areas, a) })} />{a}</label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-bold text-slate-700">Estudios que reciben el descuento (opcional)</legend>
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {areas.flatMap((a) => (catalogo[a] ?? []).map((e) => (
                <label key={`${a}|${e.nombre}`} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={form.estudios.includes(e.nombre)} onChange={() => setForm({ ...form, estudios: alternar(form.estudios, e.nombre) })} />
                  <span className="font-mono text-[10px] text-slate-600">{a}</span> {e.nombre}
                </label>
              )))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-bold text-slate-700">Solo si la factura incluye también (opcional, deben ir todos)</legend>
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {areas.flatMap((a) => (catalogo[a] ?? []).map((e) => (
                <label key={`req|${a}|${e.nombre}`} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={form.requiere.includes(e.nombre)} onChange={() => setForm({ ...form, requiere: alternar(form.requiere, e.nombre) })} />
                  <span className="font-mono text-[10px] text-slate-600">{a}</span> {e.nombre}
                </label>
              )))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />Activa</label>
          <div className="flex gap-2">
            <Button disabled={guardando} onClick={() => void guardar(form)} className="rounded-xl font-bold">{guardando ? 'Guardando…' : 'Guardar promoción'}</Button>
            <Button variant="outline" onClick={() => setForm(null)} className="rounded-xl">Cancelar</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {lista.length === 0 && !form && <p className="text-sm text-slate-600">Aún no hay promociones.</p>}
        {lista.map((p) => (
          <Card key={p.id}><CardContent className="space-y-1 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-black text-slate-900"><BadgePercent className="h-4 w-4 text-emerald-700" />{p.nombre} · {etiquetaValor(p)}</p>
              <Badge variant="outline" className={p.activa ? 'border-emerald-400 text-emerald-800' : 'border-slate-300 text-slate-600'}>{p.activa ? 'Activa' : 'Inactiva'}</Badge>
            </div>
            <p className="text-xs text-slate-700">{p.fecha_desde} al {p.fecha_hasta} · {p.modo === 'CLINICA' ? 'La clínica asume' : 'Reparto proporcional'}</p>
            {p.requiere.length > 0 && <p className="text-xs text-slate-700">Si también lleva: {p.requiere.join(' + ')}</p>}
            <p className="text-xs text-slate-700">{p.estudios.length ? `Estudios: ${p.estudios.join(', ')}` : `Áreas: ${p.areas.join(', ')}`}</p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => { setError(null); setForm({ id: p.id, nombre: p.nombre, tipo: p.tipo, valor: String(Number(p.valor)), modo: p.modo, areas: p.areas, estudios: p.estudios, requiere: p.requiere, fechaDesde: p.fecha_desde, fechaHasta: p.fecha_hasta, activa: p.activa }); }}>Editar</Button>
              <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => void guardar({ id: p.id, nombre: p.nombre, tipo: p.tipo, valor: String(Number(p.valor)), modo: p.modo, areas: p.areas, estudios: p.estudios, requiere: p.requiere, fechaDesde: p.fecha_desde, fechaHasta: p.fecha_hasta, activa: !p.activa })}>{p.activa ? 'Desactivar' : 'Activar'}</Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
};
