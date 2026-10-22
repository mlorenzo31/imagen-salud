'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAvisos } from '@/components/ui/avisos';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, RefreshCw, Send } from 'lucide-react';
import { diferir } from '@/lib/diferir';
import { getErrorMessage } from '@/lib/utils';
import { hoyLocal } from '@/lib/date';
import { descargarExcel } from '@/lib/excel';
import { ETIQUETA_ESTADO, type RespuestaTablero } from '@/lib/fiscal/tablero';
import { TarjetasResumen } from '@/components/controlfiscal/TarjetasResumen';
import { TablaCobrosFiscales } from '@/components/controlfiscal/TablaCobrosFiscales';

/** Control fiscal: qué se cobró, qué se facturó, qué está diferido y qué falta por facturar. */
export const ModuloControlFiscal: React.FC = () => {
  const { avisar } = useAvisos();
  const hoy = hoyLocal();
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`);
  const [hasta, setHasta] = useState(hoy);
  const [datos, setDatos] = useState<RespuestaTablero | null>(null);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [receptor, setReceptor] = useState({ razonSocial: '', rif: '' });
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/fiscal/tablero?desde=${desde}&hasta=${hasta}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudo cargar el control fiscal.');
      setDatos(j as RespuestaTablero);
      setSeleccion(new Set());
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    }
  }, [desde, hasta, avisar]);
  useEffect(() => diferir(() => { void cargar(); }), [cargar]);

  const toggle = (id: number) => setSeleccion((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const emitir = async () => {
    const cobros = [...seleccion];
    const consolidada = cobros.length > 1;
    setOcupado(true);
    try {
      const r = await fetch('/api/fiscal/facturar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cobros, receptor: consolidada || receptor.rif ? { razonSocial: receptor.razonSocial, rif: receptor.rif } : null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudo emitir la factura.');
      avisar(j.estado === 'EMITIDO'
        ? { tipo: 'exito', mensaje: `Factura fiscal N° ${j.numero} emitida · N° de control ${j.numeroControl}.` }
        : { tipo: 'alerta', mensaje: `Factura fiscal N° ${j.numero}: ${j.estado}${j.error ? ` — ${j.error}` : ''}.` });
      setReceptor({ razonSocial: '', rif: '' });
      await cargar();
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    } finally {
      setOcupado(false);
    }
  };

  const reintentar = async () => {
    setOcupado(true);
    try {
      const r = await fetch('/api/fiscal/pendientes', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudo reintentar.');
      const p = j.procesados as Record<string, number>;
      avisar({ tipo: 'exito', mensaje: `Reintento: ${p.EMITIDO} emitidas, ${p.PENDIENTE} siguen pendientes, ${p.ERROR} rechazadas.` });
      await cargar();
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    } finally {
      setOcupado(false);
    }
  };

  const exportar = () => {
    if (!datos) return;
    void descargarExcel(`control_fiscal_${datos.desde}_${datos.hasta}`, [{
      nombreHoja: 'Control fiscal',
      data: datos.filas.map((f) => ({
        Fecha: f.fecha, Cobro: f.id, Paciente: f.paciente, Cédula: f.cedula, 'Facturar a': f.facturarA ?? '',
        USD: f.totalUsd / 100, Bs: f.totalBs / 100, Estado: ETIQUETA_ESTADO[f.estado],
        Factura: f.docNumero ?? '', 'N° control': f.docControl ?? '', Motivo: f.motivoDiferido ?? '', Límite: f.facturarAntesDe ?? '',
      })),
    }]);
  };

  const r = datos?.resumen;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="mb-1 block text-xs font-bold text-slate-600">Desde</label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" /></div>
        <div><label className="mb-1 block text-xs font-bold text-slate-600">Hasta</label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9" /></div>
        <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Solo lo que no está facturado
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={reintentar} disabled={ocupado}><RefreshCw className="mr-1 h-4 w-4" />Reintentar envíos</Button>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!datos}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
        </div>
      </div>

      {datos && !datos.inicioFacturacion && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Configure la fecha de inicio de la facturación fiscal en Catálogos → Datos fiscales para activar el control.
        </p>
      )}

      {r && datos?.inicioFacturacion && (r.alDia && datos.diferencias.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />Todo lo cobrado en el período está facturado o diferido dentro de su plazo.
        </p>
      ) : (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">Hay cobros que requieren factura fiscal.</p>
            <p>{r.alertas.sinFactura} sin factura · {r.alertas.vencidas} diferidos vencidos · {r.alertas.rechazadas} rechazados por la imprenta
              {datos.diferencias.length > 0 && ` · ${datos.diferencias.length} facturas no cuadran con sus cobros (${datos.diferencias.map((d) => d.numero).join(', ')})`}.</p>
          </div>
        </div>
      ))}

      {r && <TarjetasResumen resumen={r} />}

      {seleccion.size > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <p className="w-full text-xs font-bold text-sky-900">
            {seleccion.size === 1 ? 'Emitir la factura de este cobro (al paciente o a su "Facturar a", salvo que indique otro receptor).' : `Factura consolidada de ${seleccion.size} cobros: indique la aseguradora o empresa.`}
          </p>
          <Input value={receptor.razonSocial} onChange={(e) => setReceptor({ ...receptor, razonSocial: e.target.value.toUpperCase() })} placeholder="Razón social" className="h-8 w-64 text-xs" />
          <Input value={receptor.rif} onChange={(e) => setReceptor({ ...receptor, rif: e.target.value.toUpperCase() })} placeholder="RIF (J-12345678-9)" className="h-8 w-44 text-xs font-mono" />
          <Button size="sm" onClick={emitir} disabled={ocupado}><Send className="mr-1 h-4 w-4" />Emitir factura fiscal</Button>
        </div>
      )}

      {datos && <TablaCobrosFiscales filas={datos.filas} seleccion={seleccion} onToggle={toggle} soloPendientes={soloPendientes} />}
    </div>
  );
};
