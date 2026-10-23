'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAvisos } from '@/components/ui/avisos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { hoyLocal } from '@/lib/date';
import { diferir } from '@/lib/diferir';
import { descargarExcel } from '@/lib/excel';
import { getErrorMessage } from '@/lib/utils';
import type { ModoOperacion, UserRole } from '@/types';
import { FormRetencionRecibida, formRetencionVacio, type FormRetencion } from '@/components/retenciones/FormRetencionRecibida';
import { TablaRetencionesRecibidas, bsTexto, type RetencionRecibidaFila } from '@/components/retenciones/TablaRetencionesRecibidas';

interface ModuloRetencionesSeniatProps {
  currentRole: UserRole;
  modoOperacion: ModoOperacion;
}

/**
 * Retenciones de IVA/ISLR que le practican a la clínica sus clientes agentes de retención. Se registra el comprobante
 * que entrega el agente (su N° del art. 18) contra la factura fiscal de la clínica. Los comprobantes que la clínica
 * emite a sus proveedores están en Egresos > Comprobantes de retención.
 */
export const ModuloRetencionesSeniat: React.FC<ModuloRetencionesSeniatProps> = ({ currentRole, modoOperacion }) => {
  const { avisar, preguntar } = useAvisos();
  const hoy = hoyLocal();
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`);
  const [hasta, setHasta] = useState(hoy);
  const [filas, setFilas] = useState<RetencionRecibidaFila[]>([]);
  const [form, setForm] = useState<FormRetencion | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Escribir en tesorería es del admin (el asistente solo consulta).
  const puedeEditar = modoOperacion !== 'vista' && currentRole === 'admin';

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/tesoreria/retenciones-recibidas?desde=${desde}&hasta=${hasta}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudieron cargar las retenciones.');
      setFilas(j);
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    }
  }, [desde, hasta, avisar]);
  useEffect(() => diferir(() => void cargar()), [cargar]);

  const enviar = async (url: string, method: 'POST' | 'PATCH', body: unknown): Promise<boolean> => {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { avisar({ tipo: 'error', mensaje: j.error ?? 'No se pudo guardar.' }); return false; }
    await cargar();
    return true;
  };

  const guardar = async () => {
    if (!form) return;
    setGuardando(true);
    try {
      if (await enviar('/api/tesoreria/retenciones-recibidas', 'POST', { ...form, observacion: form.observacion || undefined })) {
        avisar({ tipo: 'exito', mensaje: `Comprobante ${form.numeroComprobante} registrado.` });
        setForm(null);
      }
    } finally {
      setGuardando(false);
    }
  };

  const anular = async (f: RetencionRecibidaFila) => {
    const motivo = await preguntar({ titulo: `Anular la retención ${f.numero_comprobante}`, mensaje: 'Indique el motivo (p. ej. el agente anuló su comprobante).', textoConfirmar: 'Anular' });
    if (motivo) await enviar(`/api/tesoreria/retenciones-recibidas/${f.id}`, 'PATCH', { motivo });
  };

  const activas = filas.filter((f) => !f.anulada);
  const totalIva = activas.reduce((a, f) => a + Number(f.iva_retenido), 0);
  const totalIslr = activas.reduce((a, f) => a + Number(f.islr_retenido), 0);

  const exportar = () => void descargarExcel(`retenciones_recibidas_${desde}_${hasta}`, [{
    nombreHoja: 'Retenciones recibidas',
    data: filas.map((f) => ({
      Comprobante: f.numero_comprobante, Fecha: f.fecha_comprobante, Período: f.periodo, 'RIF agente': f.agente_rif, Agente: f.agente_razon_social,
      Serie: f.serie, Factura: f.factura_numero, 'N° control': f.numero_control ?? '', 'Total factura Bs': Number(f.total_bs),
      'IVA retenido Bs': Number(f.iva_retenido), 'ISLR retenido Bs': Number(f.islr_retenido), Estado: f.anulada ? 'ANULADA' : 'VIGENTE',
    })),
  }]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="mb-1 block text-xs font-bold text-slate-600">Desde</label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" /></div>
        <div><label className="mb-1 block text-xs font-bold text-slate-600">Hasta</label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9" /></div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportar} disabled={filas.length === 0}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
          {puedeEditar && !form && <Button size="sm" onClick={() => setForm(formRetencionVacio(hoy))}><Plus className="mr-1 h-4 w-4" />Registrar comprobante</Button>}
        </div>
      </div>

      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        Retenciones que le practican a la clínica sus clientes (aseguradoras, empresas). Los comprobantes que la clínica emite a sus proveedores están en Egresos → Comprobantes de retención.
      </p>

      {form && <FormRetencionRecibida valor={form} onChange={setForm} onGuardar={guardar} onCancelar={() => setForm(null)} guardando={guardando} />}

      <div className="grid gap-3 sm:grid-cols-3">
        {[['Comprobantes vigentes', String(activas.length)], ['IVA retenido', bsTexto(totalIva)], ['ISLR retenido', bsTexto(totalIslr)]].map(([t, v]) => (
          <div key={t} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t}</p>
            <p className="text-xl font-black text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      <TablaRetencionesRecibidas filas={filas} onAnular={puedeEditar ? anular : undefined} />
    </div>
  );
};
