'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { diferir } from '@/lib/diferir';
import { getErrorMessage } from '@/lib/utils';
import type { ConfigEmisor, DatosImprenta } from '@/lib/fiscal/factura';

const IMPRENTA_VACIA: DatosImprenta = { razonSocial: '', rif: '', providencia: '', fechaProvidencia: '' };

/** Datos del emisor para la factura fiscal (Providencia SENIAT G.O. 21/10/2026). Solo admin. */
export const PanelDatosFiscales: React.FC = () => {
  const [form, setForm] = useState<ConfigEmisor | null>(null);
  const [conImprenta, setConImprenta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/fiscal');
      const j = (await r.json()) as ConfigEmisor & { error?: string };
      if (!r.ok) throw new Error(j.error ?? 'No se pudieron cargar los datos fiscales.');
      setForm(j);
      setConImprenta(j.imprenta !== null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, []);
  useEffect(() => diferir(() => { void cargar(); }), [cargar]);

  const guardar = async () => {
    if (!form) return;
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      const r = await fetch('/api/admin/fiscal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, imprenta: conImprenta ? form.imprenta ?? IMPRENTA_VACIA : null }),
      });
      const j = (await r.json().catch(() => ({}))) as ConfigEmisor & { error?: string };
      if (!r.ok) throw new Error(j.error ?? 'No se pudieron guardar los datos fiscales.');
      setForm(j);
      setOk(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setGuardando(false);
    }
  };

  if (!form) return <p className="text-sm text-slate-500">{error ?? 'Cargando datos fiscales…'}</p>;
  const set = <K extends keyof ConfigEmisor>(k: K, v: ConfigEmisor[K]) => { setOk(false); setForm({ ...form, [k]: v }); };
  const imp = form.imprenta ?? IMPRENTA_VACIA;
  const setImp = (k: keyof DatosImprenta, v: string) => set('imprenta', { ...imp, [k]: v });
  const etiqueta = 'text-xs font-bold text-slate-600 block mb-1';

  return (
    <Card><CardContent className="space-y-4 p-4 text-sm">
      <p className="text-slate-700">Estos datos se imprimen en cada factura y nota de crédito/débito.</p>

      <div className="grid gap-3 md:grid-cols-2">
        <div><label className={etiqueta}>Razón social</label><Input value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} /></div>
        <div><label className={etiqueta}>RIF</label><Input value={form.rif} onChange={(e) => set('rif', e.target.value.toUpperCase())} placeholder="J-00000000-0" /></div>
        <div className="md:col-span-2"><label className={etiqueta}>Domicilio fiscal</label><Input value={form.domicilioFiscal} onChange={(e) => set('domicilioFiscal', e.target.value)} /></div>
        <div>
          <label className={etiqueta}>Condición ante el IVA</label>
          <select value={form.condicionIva} onChange={(e) => set('condicionIva', e.target.value as ConfigEmisor['condicionIva'])} className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2">
            <option value="ORDINARIO">Contribuyente ordinario</option>
            <option value="FORMAL">Contribuyente formal (agrega la frase en la factura)</option>
          </select>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={form.percibeIgtf} onChange={(e) => set('percibeIgtf', e.target.checked)} />
            Percibe IGTF sobre pagos en divisas
          </label>
          {form.percibeIgtf && (
            <div className="w-24"><label className={etiqueta}>IGTF %</label><Input type="number" step="0.01" value={form.igtfPct} onChange={(e) => set('igtfPct', Number(e.target.value))} /></div>
          )}
        </div>
        <div className="md:col-span-2">
          <label className={etiqueta}>Leyenda de la providencia (art. 19)</label>
          <Input value={form.leyendaProvidencia} onChange={(e) => set('leyendaProvidencia', e.target.value)} />
        </div>
        <div>
          <label className={etiqueta}>Inicio de la facturación fiscal</label>
          <Input type="date" value={form.inicioFacturacion ?? ''} onChange={(e) => set('inicioFacturacion', e.target.value || null)} />
          <p className="mt-1 text-xs text-slate-500">Desde esta fecha el Control Fiscal exige factura para cada cobro.</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
        <input type="checkbox" checked={conImprenta} onChange={(e) => { setOk(false); setConImprenta(e.target.checked); }} />
        Imprenta digital autorizada (art. 9.3)
      </label>
      {conImprenta && (
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className={etiqueta}>Razón social de la imprenta</label><Input value={imp.razonSocial} onChange={(e) => setImp('razonSocial', e.target.value)} /></div>
          <div><label className={etiqueta}>RIF de la imprenta</label><Input value={imp.rif} onChange={(e) => setImp('rif', e.target.value.toUpperCase())} /></div>
          <div><label className={etiqueta}>Providencia de autorización</label><Input value={imp.providencia} onChange={(e) => setImp('providencia', e.target.value)} placeholder="SNAT/AAAA/000000" /></div>
          <div><label className={etiqueta}>Fecha de la providencia</label><Input type="date" value={imp.fechaProvidencia} onChange={(e) => setImp('fechaProvidencia', e.target.value)} /></div>
        </div>
      )}

      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {ok && <p className="text-sm font-bold text-emerald-700">Datos fiscales guardados.</p>}
      <Button onClick={guardar} disabled={guardando} className="rounded-xl text-xs font-bold">{guardando ? 'Guardando…' : 'Guardar datos fiscales'}</Button>
    </CardContent></Card>
  );
};
