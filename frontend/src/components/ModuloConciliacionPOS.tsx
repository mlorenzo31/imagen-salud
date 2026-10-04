'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CreditCard, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { exportarAExcel } from '@/lib/exportUtils';
import { centsToNumber, toCents } from '@/lib/money';
import { hoyLocal } from '@/lib/date';
import { getErrorMessage } from '@/lib/utils';
import type { CuentaBancaria, ModoOperacion, UserRole } from '@/types';

interface Lote {
  fecha: string;
  medio: 'PUNTO' | 'PAGO_MOVIL';
  cantidad: number;
  bruto: number;
  pendientes: number;
  bruto_pendiente: number;
  neto: number;
  comision: number;
  ids_pendientes: number[];
  referencia: string | null;
  conciliado_por: string | null;
  estado: 'PENDIENTE' | 'CONCILIADO';
}

interface TransaccionPendiente {
  id: number;
  fecha_transaccion: string;
  hora_transaccion: string | null;
  nombre_paciente: string | null;
  cedula_paciente: string | null;
  monto_bruto_bs: string | number;
  medio?: string;
}

interface Props {
  currentRole: UserRole;
  modoOperacion: ModoOperacion;
  cuentas?: CuentaBancaria[];
  onConciliacionCompletada?: () => void;
}

const claveLote = (l: Lote) => `${l.fecha}|${l.medio}`;
const etiquetaMedio = (m: string) => (m === 'PAGO_MOVIL' ? 'Pago móvil' : 'Punto de venta');
const bs = (n: number) => `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Conciliación de punto de venta con datos reales: cada día se agrupan los cobros con tarjeta que siguen "en tránsito"
 * y, al confirmar el abono del banco, el servidor acredita el neto en la cuenta, registra la comisión y asienta el movimiento.
 */
export const ModuloConciliacionPOS: React.FC<Props> = ({ currentRole, modoOperacion, onConciliacionCompletada }) => {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'TODOS' | 'PENDIENTE' | 'CONCILIADO'>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<TransaccionPendiente[]>([]);

  const [loteActivo, setLoteActivo] = useState<Lote | null>(null);
  const [neto, setNeto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fechaAbono, setFechaAbono] = useState(hoyLocal());
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const esAdmin = currentRole === 'admin';
  const soloLectura = modoOperacion === 'vista';

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/tesoreria/conciliacion/lotes');
      if (!res.ok) throw new Error('No se pudieron cargar los lotes de punto de venta.');
      setLotes(await res.json());
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(cargar, 0);
    return () => clearTimeout(t);
  }, [cargar]);

  const hoy = hoyLocal();
  const pendientesAnteriores = useMemo(() => lotes.filter((l) => l.estado === 'PENDIENTE' && l.fecha < hoy), [lotes, hoy]);

  const visibles = useMemo(() => lotes.filter((l) => {
    if (filtro !== 'TODOS' && l.estado !== filtro) return false;
    return !busqueda.trim() || l.fecha.includes(busqueda.trim()) || (l.referencia ?? '').toLowerCase().includes(busqueda.trim().toLowerCase());
  }), [lotes, filtro, busqueda]);

  const totales = useMemo(() => ({
    bruto: lotes.reduce((a, l) => a + toCents(l.bruto), 0),
    comision: lotes.reduce((a, l) => a + toCents(l.comision), 0),
    neto: lotes.reduce((a, l) => a + toCents(l.neto), 0),
    pendientes: lotes.filter((l) => l.estado === 'PENDIENTE').length,
  }), [lotes]);

  const alternarDetalle = async (l: Lote) => {
    if (expandido === claveLote(l)) { setExpandido(null); return; }
    setExpandido(claveLote(l));
    try {
      const res = await fetch('/api/tesoreria/conciliacion/pendientes');
      const data: { transacciones: TransaccionPendiente[] } = await res.json();
      setDetalle((data.transacciones ?? []).filter((t) => String(t.fecha_transaccion).slice(0, 10) === l.fecha && (t.medio ?? 'PUNTO') === l.medio));
    } catch {
      setDetalle([]);
    }
  };

  const abrirConciliar = (l: Lote) => {
    if (soloLectura) return alert('Modo Vista activo.');
    setLoteActivo(l);
    setNeto('');
    setReferencia(`ABONO-${l.medio === 'PAGO_MOVIL' ? 'PM' : 'POS'}-${l.fecha.replaceAll('-', '')}`);
    setFechaAbono(hoyLocal());
    setErrorModal(null);
  };

  const brutoLote = loteActivo ? toCents(loteActivo.bruto_pendiente) : 0;
  const netoCents = (() => { try { return toCents(neto); } catch { return NaN; } })();
  const comisionCents = Number.isNaN(netoCents) ? NaN : brutoLote - netoCents;
  const netoValido = neto !== '' && !Number.isNaN(netoCents) && netoCents > 0 && comisionCents >= 0;

  const confirmar = async () => {
    if (!loteActivo || !netoValido) return;
    setGuardando(true);
    setErrorModal(null);
    try {
      const res = await fetch('/api/tesoreria/conciliacion/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaccion_ids: loteActivo.ids_pendientes,
          monto_neto_acreditado_bs: centsToNumber(netoCents),
          comision_bancaria_bs: centsToNumber(comisionCents),
          fecha_acreditacion: fechaAbono,
          referencia: referencia.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo conciliar el lote.');
      setLoteActivo(null);
      setExpandido(null);
      await cargar();
      onConciliacionCompletada?.();
    } catch (e) {
      setErrorModal(getErrorMessage(e));
    } finally {
      setGuardando(false);
    }
  };

  const exportar = () => exportarAExcel('Conciliacion_POS', [{
    nombreHoja: 'Lotes POS',
    data: visibles.map((l) => ({
      Fecha: l.fecha, Cobros: l.cantidad, 'Bruto (Bs)': l.bruto, 'Comisión (Bs)': l.comision, 'Neto acreditado (Bs)': l.neto,
      Estado: l.estado, Referencia: l.referencia ?? '', 'Conciliado por': l.conciliado_por ?? '',
    })),
  }]);

  return (
    <div className="space-y-6">
      {pendientesAnteriores.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-clinica-coral/30 bg-clinica-coral-soft p-4">
          <AlertTriangle className="w-5 h-5 text-clinica-coral shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-clinica-coral">
              {pendientesAnteriores.length} lote(s) de días anteriores sin conciliar
            </p>
            <p className="text-slate-600 mt-0.5">
              Hay {bs(pendientesAnteriores.reduce((a, l) => a + l.bruto_pendiente, 0))} en cobros con tarjeta esperando confirmación de abono bancario:{' '}
              {pendientesAnteriores.slice(0, 4).map((l) => l.fecha).join(', ')}{pendientesAnteriores.length > 4 ? '…' : ''}.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-clinica-selection rounded-xl text-clinica-primary"><CreditCard className="w-6 h-6" /></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Conciliación de punto de venta</h2>
              <p className="text-sm text-slate-500">Cobros con tarjeta por día, pendientes de abono y ya acreditados en banco</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
              <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportar} disabled={visibles.length === 0}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent><p className="text-[11px] uppercase tracking-wide text-slate-500">Bruto en terminal (90 días)</p><p className="text-xl font-semibold text-slate-900 mt-1">{bs(centsToNumber(totales.bruto))}</p></CardContent></Card>
        <Card><CardContent><p className="text-[11px] uppercase tracking-wide text-slate-500">Comisiones retenidas</p><p className="text-xl font-semibold text-clinica-coral mt-1">{bs(centsToNumber(totales.comision))}</p></CardContent></Card>
        <Card><CardContent><p className="text-[11px] uppercase tracking-wide text-slate-500">Neto acreditado en banco</p><p className="text-xl font-semibold text-clinica-dark mt-1">{bs(centsToNumber(totales.neto))}</p></CardContent></Card>
        <Card><CardContent><p className="text-[11px] uppercase tracking-wide text-slate-500">Lotes por conciliar</p><p className={`text-xl font-semibold mt-1 ${totales.pendientes > 0 ? 'text-clinica-coral' : 'text-clinica-dark'}`}>{totales.pendientes}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por fecha (AAAA-MM-DD) o referencia…" className="max-w-sm" />
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs">
              {(['TODOS', 'PENDIENTE', 'CONCILIADO'] as const).map((f) => (
                <button key={f} onClick={() => setFiltro(f)} className={`px-3 py-1.5 rounded-md font-medium transition-colors ${filtro === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>
                  {f === 'TODOS' ? 'Todos' : f === 'PENDIENTE' ? 'Pendientes' : 'Conciliados'}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-clinica-coral">{error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3 w-6" />
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3 text-right">Cobros</th>
                  <th className="py-2 pr-3 text-right">Bruto</th>
                  <th className="py-2 pr-3 text-right">Comisión</th>
                  <th className="py-2 pr-3 text-right">Neto acreditado</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-slate-500">{cargando ? 'Cargando…' : 'No hay cobros con tarjeta para mostrar.'}</td></tr>
                )}
                {visibles.map((l) => (
                  <React.Fragment key={claveLote(l)}>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="py-3 pr-3">
                        {l.estado === 'PENDIENTE' && (
                          <button onClick={() => alternarDetalle(l)} aria-label="Ver cobros del lote" className="text-slate-400 hover:text-slate-700">
                            {expandido === claveLote(l) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-medium text-slate-800 tabular-nums">{l.fecha} <span className="text-[10px] font-bold text-slate-500">· {etiquetaMedio(l.medio)}</span></td>
                      <td className="py-3 pr-3 text-right tabular-nums">{l.cantidad}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{bs(l.bruto)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums text-clinica-coral">{l.estado === 'CONCILIADO' ? bs(l.comision) : '—'}</td>
                      <td className="py-3 pr-3 text-right tabular-nums text-clinica-dark">{l.estado === 'CONCILIADO' ? bs(l.neto) : '—'}</td>
                      <td className="py-3 pr-3">
                        {l.estado === 'CONCILIADO'
                          ? <Badge className="bg-clinica-selection text-clinica-dark border border-clinica-aquamarine/50"><CheckCircle2 className="w-3 h-3" /> Conciliado</Badge>
                          : <Badge className="bg-clinica-coral-soft text-clinica-coral border border-clinica-coral/30">Pendiente</Badge>}
                        {l.estado === 'CONCILIADO' && l.referencia && <span className="ml-2 text-xs text-slate-400">{l.referencia}</span>}
                      </td>
                      <td className="py-3 text-right">
                        {l.estado === 'PENDIENTE' && esAdmin && (
                          <Button size="sm" onClick={() => abrirConciliar(l)} className="bg-clinica-primary hover:bg-clinica-primary-dark text-white">Conciliar abono</Button>
                        )}
                        {l.estado === 'PENDIENTE' && !esAdmin && <span className="text-xs text-slate-400">Solo administrador</span>}
                      </td>
                    </tr>
                    {expandido === claveLote(l) && (
                      <tr className="bg-slate-50/70">
                        <td />
                        <td colSpan={7} className="py-3 pr-3">
                          {detalle.length === 0 ? <p className="text-xs text-slate-500">Sin detalle disponible.</p> : (
                            <ul className="divide-y divide-slate-200/70 text-xs">
                              {detalle.map((t) => (
                                <li key={t.id} className="flex items-center justify-between py-1.5">
                                  <span className="text-slate-700">{t.hora_transaccion ?? ''} · {t.nombre_paciente ?? 'Paciente'} <span className="text-slate-400">{t.cedula_paciente}</span></span>
                                  <span className="tabular-nums font-medium">{bs(Number(t.monto_bruto_bs))}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={loteActivo !== null} onOpenChange={(o) => { if (!o) setLoteActivo(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Conciliar abono del {loteActivo?.fecha}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex justify-between">
              <span className="text-slate-500">{loteActivo?.pendientes} cobro(s) · bruto en terminal</span>
              <strong className="tabular-nums">{bs(centsToNumber(brutoLote))}</strong>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Monto neto abonado por el banco (Bs)</label>
              <Input type="number" step="0.01" value={neto} onChange={(e) => setNeto(e.target.value)} placeholder="Según el extracto bancario" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Fecha del abono</label>
                <Input type="date" value={fechaAbono} onChange={(e) => setFechaAbono(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Referencia</label>
                <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={100} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 flex justify-between text-xs">
              <span className="text-slate-500">Comisión bancaria retenida</span>
              {netoValido
                ? <strong className="text-clinica-coral tabular-nums">{bs(centsToNumber(comisionCents))} ({brutoLote > 0 ? ((comisionCents / brutoLote) * 100).toFixed(2) : '0'}%)</strong>
                : <span className="text-slate-400">{neto !== '' && comisionCents < 0 ? 'El neto no puede superar el bruto' : '—'}</span>}
            </div>
            <p className="text-xs text-slate-500">Al confirmar se acredita el neto en la cuenta del punto de venta, se descuenta del saldo en tránsito y se registra el movimiento.</p>
            {errorModal && <p className="text-xs font-medium text-clinica-coral">{errorModal}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoteActivo(null)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={!netoValido || guardando} className="bg-clinica-primary hover:bg-clinica-primary-dark text-white">
              {guardando ? 'Guardando…' : 'Confirmar conciliación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
