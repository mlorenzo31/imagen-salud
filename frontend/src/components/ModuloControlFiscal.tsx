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
import { ETIQUETA_ESTADO, type FilaTablero, type RespuestaTablero } from '@/lib/fiscal/tablero';
import { TarjetasResumen } from '@/components/controlfiscal/TarjetasResumen';
import { TablaCobrosFiscales } from '@/components/controlfiscal/TablaCobrosFiscales';
import { PanelContingencia } from '@/components/controlfiscal/PanelContingencia';

/** Control fiscal: qué se cobró, qué se facturó, qué está diferido y qué falta por facturar. */
export const ModuloControlFiscal: React.FC<{ esAdmin: boolean }> = ({ esAdmin }) => {
  const { avisar } = useAvisos();
  const hoy = hoyLocal();
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`);
  const [hasta, setHasta] = useState(hoy);
  const [datos, setDatos] = useState<RespuestaTablero | null>(null);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [receptor, setReceptor] = useState({ razonSocial: '', rif: '' });
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ fila: FilaTablero; tipo: 'NOTA_CREDITO' | 'NOTA_DEBITO'; monto: string; motivo: string; pin: string } | null>(null);

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

  const emitirNota = async () => {
    if (!nota || nota.fila.docId === null) return;
    setOcupado(true);
    try {
      const r = await fetch('/api/fiscal/notas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoId: nota.fila.docId, tipo: nota.tipo, montoUsd: nota.monto.replace(',', '.'), motivo: nota.motivo, pin: nota.pin }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudo emitir la nota.');
      avisar(j.estado === 'EMITIDO'
        ? { tipo: 'exito', mensaje: `${j.denominacion} N° ${j.numero} emitida · N° de control ${j.numeroControl}. Registre el movimiento de dinero en Tesorería.` }
        : { tipo: 'alerta', mensaje: `${j.denominacion} N° ${j.numero}: ${j.estado}${j.error ? ` — ${j.error}` : ''}.` });
      setNota(null);
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

  const remitirContingencia = async () => {
    setOcupado(true);
    try {
      const r = await fetch('/api/fiscal/contingencia-envio', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudo remitir la contingencia.');
      if (j.estado === 'ERROR') avisar({ tipo: 'error', mensaje: `La imprenta no recibió la contingencia: ${j.error}` });
      else avisar({ tipo: j.pendientes ? 'alerta' : 'exito', mensaje: `Contingencia remitida: ${j.documentos} documento(s).${j.pendientes ? ` Quedan ${j.pendientes} registrados durante el envío; remita de nuevo.` : ''}` });
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

      {datos?.contingencia && <PanelContingencia contingencia={datos.contingencia} ocupado={ocupado} onRemitir={remitirContingencia} />}

      {datos && datos.anuladosSinNota.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><span className="font-bold">Cobros anulados con factura y sin nota de crédito:</span>{' '}
            {datos.anuladosSinNota.map((a) => `#${a.id} ${a.paciente} (factura ${a.numero})`).join(' · ')}. Emita la nota de crédito desde la factura.</p>
        </div>
      )}

      {r && <TarjetasResumen resumen={r} />}
      {datos && (datos.notas.credito.n > 0 || datos.notas.debito.n > 0) && (
        <p className="text-xs text-slate-600">
          Notas de crédito: {datos.notas.credito.n} por ${(datos.notas.credito.usd / 100).toFixed(2)} · Notas de débito: {datos.notas.debito.n} por ${(datos.notas.debito.usd / 100).toFixed(2)}
        </p>
      )}

      {nota && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-violet-200 bg-violet-50 p-3">
          <p className="w-full text-xs font-bold text-violet-900">Nota sobre la factura {nota.fila.docNumero} ({nota.fila.paciente}). El movimiento de dinero se registra aparte en Tesorería.</p>
          <select value={nota.tipo} onChange={(e) => setNota({ ...nota, tipo: e.target.value as 'NOTA_CREDITO' | 'NOTA_DEBITO' })} className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs">
            <option value="NOTA_CREDITO">Nota de crédito (rebaja)</option>
            <option value="NOTA_DEBITO">Nota de débito (cargo adicional)</option>
          </select>
          <Input value={nota.monto} onChange={(e) => setNota({ ...nota, monto: e.target.value })} placeholder="Monto USD" className="h-8 w-28 text-xs" />
          <Input value={nota.motivo} onChange={(e) => setNota({ ...nota, motivo: e.target.value })} placeholder="Motivo" className="h-8 w-64 text-xs" />
          <Input type="password" value={nota.pin} onChange={(e) => setNota({ ...nota, pin: e.target.value })} placeholder="Su clave" className="h-8 w-32 text-xs" />
          <Button size="sm" onClick={emitirNota} disabled={ocupado}>Emitir nota</Button>
          <Button size="sm" variant="outline" onClick={() => setNota(null)}>Cancelar</Button>
        </div>
      )}

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

      {datos && <TablaCobrosFiscales filas={datos.filas} seleccion={seleccion} onToggle={toggle} soloPendientes={soloPendientes}
        onNota={esAdmin ? (fila) => setNota({ fila, tipo: 'NOTA_CREDITO', monto: '', motivo: '', pin: '' }) : undefined} />}
    </div>
  );
};
