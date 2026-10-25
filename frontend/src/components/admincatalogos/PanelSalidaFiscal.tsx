'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { diferir } from '@/lib/diferir';
import { getErrorMessage } from '@/lib/utils';
import { VIGENCIA, type ItemSalida } from '@/lib/fiscal/salida';

const ICONO = {
  OK: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />,
  AVISO: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />,
  FALTA: <XCircle className="h-4 w-4 shrink-0 text-rose-600" />,
};

/** Lista de verificación para facturar conforme a la Providencia antes de su vigencia. Solo admin. */
export const PanelSalidaFiscal: React.FC = () => {
  const [datos, setDatos] = useState<{ items: ItemSalida[]; lista: boolean; diasParaVigencia: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/fiscal/verificacion');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudo verificar.');
      setDatos(j);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, []);
  useEffect(() => diferir(() => { void cargar(); }), [cargar]);

  return (
    <Card><CardContent className="space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold text-slate-800">Verificación de salida a producción</p>
        {datos && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${datos.lista ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {datos.lista ? 'Lista para facturar' : 'Faltan requisitos'}
          </span>
        )}
        {datos && <span className="text-xs text-slate-500">Vigencia de la Providencia: {VIGENCIA} ({datos.diasParaVigencia >= 0 ? `faltan ${datos.diasParaVigencia} días` : 'ya vigente'})</span>}
        <Button variant="outline" size="sm" className="ml-auto" onClick={cargar}><RefreshCw className="mr-1 h-4 w-4" />Verificar</Button>
      </div>
      {error && <p className="font-bold text-rose-700">{error}</p>}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {datos?.items.map((i) => (
          <li key={i.id} className="flex items-start gap-2 px-3 py-2">
            {ICONO[i.estado]}
            <div><p className="text-xs font-bold text-slate-800">{i.titulo}</p><p className="text-xs text-slate-600">{i.detalle}</p></div>
          </li>
        ))}
      </ul>
    </CardContent></Card>
  );
};
