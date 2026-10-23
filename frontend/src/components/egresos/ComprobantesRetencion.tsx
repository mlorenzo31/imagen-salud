'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAvisos } from '@/components/ui/avisos';
import { hoyLocal } from '@/lib/date';
import { diferir } from '@/lib/diferir';
import { getErrorMessage } from '@/lib/utils';
import { pedir } from './comprasApi';

interface ComprobanteFila {
  numero: string; fecha: string; periodo_imposicion: string; fecha_entrega: string | null; iva_retenido: string; islr_retenido: string;
  numero_factura: string; numero_control: string | null; moneda: 'BS' | 'USD'; estado: string; razon_social: string; rif: string; correo: string | null;
}

/** Comprobantes de retención emitidos (art. 18): PDF, fecha de entrega al proveedor y faltantes (correo, entrega). */
export function ComprobantesRetencion({ recarga }: { recarga: number }) {
  const { avisar } = useAvisos();
  const hoy = hoyLocal();
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`);
  const [hasta, setHasta] = useState(hoy);
  const [filas, setFilas] = useState<ComprobanteFila[]>([]);

  const cargar = useCallback(async () => {
    try {
      setFilas(await pedir<ComprobanteFila[]>(`/api/tesoreria/compras/retenciones?desde=${desde}&hasta=${hasta}`));
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    }
  }, [desde, hasta, avisar]);
  useEffect(() => diferir(() => void cargar()), [cargar, recarga]);

  const entregar = async (numero: string, fecha: string) => {
    try {
      await pedir(`/api/tesoreria/compras/retenciones/${numero}`, { method: 'PATCH', body: { fecha_entrega: fecha } });
      await cargar();
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    }
  };

  const sinEntregar = filas.filter((f) => !f.fecha_entrega && f.estado !== 'ANULADA').length;
  return (
    <Card className="rounded-3xl border-slate-200"><CardContent className="space-y-3 p-4 text-xs">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="mb-1 block font-bold text-slate-600">Desde</label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" /></div>
        <div><label className="mb-1 block font-bold text-slate-600">Hasta</label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9" /></div>
        {sinEntregar > 0 && <p className="pb-2 font-bold text-amber-700">{sinEntregar} comprobante(s) sin fecha de entrega al proveedor.</p>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="p-2">Comprobante</th><th className="p-2">Emisión</th><th className="p-2">Período</th><th className="p-2">Proveedor</th><th className="p-2">Factura · control</th>
              <th className="p-2 text-right">IVA ret.</th><th className="p-2 text-right">ISLR ret.</th><th className="p-2">Entrega</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-slate-500">No hay comprobantes en el período.</td></tr>}
            {filas.map((f) => (
              <tr key={f.numero} className={`border-t border-slate-100 ${f.estado === 'ANULADA' ? 'text-slate-400 line-through' : ''}`}>
                <td className="p-2 font-mono font-bold">{f.numero}</td>
                <td className="p-2">{f.fecha}</td>
                <td className="p-2">{f.periodo_imposicion}</td>
                <td className="p-2">{f.razon_social} · {f.rif}{!f.correo && <span className="block text-amber-700 no-underline">Sin correo (art. 18.4)</span>}</td>
                <td className="p-2 font-mono">{f.numero_factura} · {f.numero_control ?? '—'}</td>
                <td className="p-2 text-right font-mono">{f.moneda === 'USD' ? '$' : 'Bs.'} {f.iva_retenido}</td>
                <td className="p-2 text-right font-mono">{f.moneda === 'USD' ? '$' : 'Bs.'} {f.islr_retenido}</td>
                <td className="p-2">
                  <Input type="date" value={f.fecha_entrega ?? ''} min={f.fecha} max={hoy} onChange={(e) => e.target.value && entregar(f.numero, e.target.value)} className="h-8 w-36" aria-label={`Fecha de entrega del comprobante ${f.numero}`} />
                </td>
                <td className="p-2"><a href={`/api/tesoreria/compras/retenciones/${f.numero}/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-2 py-1 font-bold text-slate-700 hover:bg-slate-50">PDF</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent></Card>
  );
}
