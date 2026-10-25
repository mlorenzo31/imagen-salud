'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { diferir } from '@/lib/diferir';
import { getErrorMessage } from '@/lib/utils';
import type { TalonarioGuardado } from '@/lib/fiscal/contingenciaDb';

interface Form {
  serie: string; imprentaRazonSocial: string; imprentaRif: string; imprentaProvidencia: string; imprentaFechaProvidencia: string;
  fechaElaboracion: string; controlDesde: string; controlHasta: string; facturaDesde: string; facturaHasta: string;
}
const VACIO: Form = {
  serie: '', imprentaRazonSocial: '', imprentaRif: '', imprentaProvidencia: '', imprentaFechaProvidencia: '',
  fechaElaboracion: '', controlDesde: '', controlHasta: '', facturaDesde: '', facturaHasta: '',
};

/** Talonarios de contingencia autorizados (arts. 11, 20 y 27). Solo admin. */
export const PanelTalonarios: React.FC = () => {
  const [lista, setLista] = useState<TalonarioGuardado[]>([]);
  const [form, setForm] = useState<Form>(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/fiscal/talonarios');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudieron cargar los talonarios.');
      setLista(j.talonarios);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, []);
  useEffect(() => diferir(() => { void cargar(); }), [cargar]);

  const enviar = async (metodo: 'POST' | 'PATCH', cuerpo: unknown) => {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/fiscal/talonarios', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudo guardar.');
      if (metodo === 'POST') setForm(VACIO);
      await cargar();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setGuardando(false);
    }
  };

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const etiqueta = 'text-xs font-bold text-slate-600 block mb-1';
  const campo = (k: keyof Form, titulo: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className={etiqueta}>{titulo}</label><Input value={form[k]} onChange={(e) => set(k, e.target.value)} {...extra} /></div>
  );

  return (
    <Card><CardContent className="space-y-4 p-4 text-sm">
      <div>
        <p className="font-bold text-slate-800">Talonarios de contingencia</p>
        <p className="text-slate-600">Se usan solo si la imprenta digital no está disponible (art. 6). Deben estar siempre en la clínica.</p>
      </div>

      {lista.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr><th className="p-2">Serie</th><th className="p-2">N° de control</th><th className="p-2">N° de factura</th><th className="p-2">Imprenta</th><th className="p-2">Elaborado</th><th className="p-2">Usados</th><th className="p-2"></th></tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id} className={`border-t border-slate-100 ${t.activo ? '' : 'text-slate-400'}`}>
                  <td className="p-2 font-mono font-bold">{t.serie}</td>
                  <td className="p-2 font-mono">{t.controlDesde} a {t.controlHasta}</td>
                  <td className="p-2 font-mono">{t.facturaDesde} a {t.facturaHasta}</td>
                  <td className="p-2">{t.imprentaRazonSocial} · {t.imprentaRif}</td>
                  <td className="p-2">{t.fechaElaboracion}</td>
                  <td className="p-2">{t.usados} / {t.facturaHasta - t.facturaDesde + 1}</td>
                  <td className="p-2">
                    <button disabled={guardando} onClick={() => enviar('PATCH', { id: t.id, activo: !t.activo })} className="rounded-lg border border-slate-300 px-2 py-0.5 font-bold text-slate-700 hover:bg-slate-50">
                      {t.activo ? 'Retirar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        {campo('serie', 'Serie (art. 20)', { placeholder: 'C' })}
        {campo('imprentaRazonSocial', 'Imprenta')}
        {campo('imprentaRif', 'RIF de la imprenta', { placeholder: 'J-00000000-0' })}
        {campo('imprentaProvidencia', 'Providencia de la imprenta', { placeholder: 'SNAT/AAAA/000000' })}
        {campo('imprentaFechaProvidencia', 'Fecha de la providencia', { type: 'date' })}
        {campo('fechaElaboracion', 'Fecha de elaboración', { type: 'date' })}
        {campo('controlDesde', 'N° de control desde', { placeholder: '00-00000001' })}
        {campo('controlHasta', 'N° de control hasta', { placeholder: '00-00000500' })}
        {campo('facturaDesde', 'N° de factura desde', { type: 'number', min: 1 })}
        {campo('facturaHasta', 'N° de factura hasta', { type: 'number', min: 1 })}
      </div>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      <Button
        disabled={guardando}
        onClick={() => enviar('POST', { ...form, facturaDesde: Number(form.facturaDesde), facturaHasta: Number(form.facturaHasta) })}
        className="rounded-xl text-xs font-bold"
      >
        {guardando ? 'Guardando…' : 'Registrar talonario'}
      </Button>
    </CardContent></Card>
  );
};
