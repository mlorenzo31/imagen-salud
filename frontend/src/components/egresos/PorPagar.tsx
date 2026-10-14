'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAvisos } from '@/components/ui/avisos';
import { useFechaOperacion } from '@/components/FechaOperacion';
import { hoyLocal } from '@/lib/date';
import { diferir } from '@/lib/diferir';
import { getErrorMessage } from '@/lib/utils';
import type { CuentaBancaria } from '@/types';
import { fmt, pedir, type FacturaCompraFila } from './comprasApi';

interface PagoFila { id: number; fecha: string; cuenta: string; moneda_cuenta: string; monto_cuenta: string; monto_aplicado: string; reversado: boolean }

/** Facturas de compra por pagar: vencidas resaltadas, pagos parciales desde cualquier cuenta, reverso y anulación. */
export function PorPagar({ cuentas, recarga, onCambio }: { cuentas: CuentaBancaria[]; recarga: number; onCambio: () => void }) {
  const { avisar, preguntar } = useAvisos();
  const fechaOp = useFechaOperacion();
  const [facturas, setFacturas] = useState<FacturaCompraFila[]>([]);
  const [verTodas, setVerTodas] = useState(false);
  const [sel, setSel] = useState<FacturaCompraFila | null>(null);
  const [pagos, setPagos] = useState<PagoFila[]>([]);
  const [cuentaId, setCuentaId] = useState<number>(cuentas[0]?.id ?? 0);
  const [monto, setMonto] = useState('');
  const [tasa, setTasa] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setFacturas(await pedir<FacturaCompraFila[]>(`/api/tesoreria/compras/facturas${verTodas ? '' : '?estado=POR_PAGAR'}`));
    } catch (e) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(e) });
    }
  }, [verTodas, avisar]);
  useEffect(() => diferir(() => void cargar()), [cargar, recarga]);

  const abrir = async (f: FacturaCompraFila) => {
    setSel(f);
    setMonto('');
    // La tasa del pago se prellena con la BCV de hoy (no la de la factura) y se puede modificar.
    setTasa('');
    void fetch('/api/bcv').then((r) => r.json()).then((d) => { if (d.tasa > 0) setTasa(String(d.tasa)); }).catch(() => {});
    try { setPagos(await pedir<PagoFila[]>(`/api/tesoreria/compras/pagos?factura_id=${f.id}`)); } catch { setPagos([]); }
  };
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const hoy = hoyLocal();

  const pagar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sel) return;
    setEnviando(true);
    try {
      const r = await pedir<{ mensaje: string }>('/api/tesoreria/compras/pagos', { body: { factura_id: sel.id, cuenta_id: cuentaId, monto, tasa, ...fechaOp.payload } });
      avisar({ tipo: 'exito', mensaje: r.mensaje });
      setSel(null);
      onCambio();
    } catch (err) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(err) });
    } finally {
      setEnviando(false);
    }
  };

  const reversar = async (p: PagoFila) => {
    const motivo = await preguntar({ titulo: 'Reversar pago', mensaje: `El monto vuelve a ${p.cuenta}. Motivo:`, placeholder: 'Motivo del reverso' });
    if (!motivo) return;
    try {
      await pedir(`/api/tesoreria/compras/pagos/${p.id}/reversar`, { body: { motivo } });
      avisar({ tipo: 'exito', mensaje: 'Pago reversado.' });
      setSel(null);
      onCambio();
    } catch (err) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(err) });
    }
  };

  const anular = async (f: FacturaCompraFila) => {
    const motivo = await preguntar({ titulo: `Anular factura N° ${f.numero_factura}`, mensaje: 'Solo se anula si no tiene pagos vigentes. Motivo:', placeholder: 'Motivo de la anulación' });
    if (!motivo) return;
    try {
      await pedir(`/api/tesoreria/compras/facturas/${f.id}/anular`, { body: { motivo } });
      avisar({ tipo: 'exito', mensaje: 'Factura anulada.' });
      setSel(null);
      onCambio();
    } catch (err) {
      avisar({ tipo: 'error', mensaje: getErrorMessage(err) });
    }
  };

  const colorEstado: Record<string, string> = { PENDIENTE: 'bg-amber-100 text-amber-800', PARCIAL: 'bg-sky-100 text-sky-800', PAGADA: 'bg-emerald-100 text-emerald-800', ANULADA: 'bg-slate-200 text-slate-600' };

  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-3xl">
      <CardContent className="p-6 space-y-3 text-xs">
        <label className="flex items-center gap-2 font-bold text-slate-700">
          <input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} />Ver también pagadas y anuladas
        </label>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-300 text-left font-bold uppercase text-slate-600">
                <th className="py-1.5">Proveedor</th><th>N° factura</th><th>Fecha</th><th>Vence</th><th className="text-right">Neto</th><th className="text-right">Pendiente</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {facturas.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-500">No hay facturas {verTodas ? '' : 'por pagar'}.</td></tr>}
              {facturas.map((f) => {
                const vencida = !!f.vencimiento && f.vencimiento < hoy && (f.estado === 'PENDIENTE' || f.estado === 'PARCIAL');
                return (
                  <tr key={f.id} className={`border-b border-slate-100 ${vencida ? 'bg-rose-50' : ''}`}>
                    <td className="py-1.5 font-bold">{f.razon_social}<div className="font-normal text-slate-500">{f.rif}</div></td>
                    <td>{f.numero_factura}</td><td className="font-mono">{f.fecha}</td>
                    <td className={`font-mono ${vencida ? 'font-bold text-rose-700' : ''}`}>{f.vencimiento ?? '—'}</td>
                    <td className="text-right font-mono">{fmt(f.neto_a_pagar, f.moneda)}</td>
                    <td className="text-right font-mono font-bold">{fmt(f.pendiente, f.moneda)}</td>
                    <td><Badge className={colorEstado[f.estado]}>{f.estado}</Badge></td>
                    <td className="text-right"><Button size="sm" variant="outline" onClick={() => void abrir(f)} className="h-7 rounded-lg text-xs">Ver / pagar</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!sel} onOpenChange={(v) => !v && setSel(null)}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          {sel && (
            <>
              <DialogHeader><DialogTitle className="text-base font-black">{sel.razon_social} · Factura N° {sel.numero_factura}</DialogTitle></DialogHeader>
              <p className="text-xs">Neto {fmt(sel.neto_a_pagar, sel.moneda)} · pagado {fmt(sel.pagado, sel.moneda)} · <b>pendiente {fmt(sel.pendiente, sel.moneda)}</b></p>
              {pagos.length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
                  {pagos.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className={p.reversado ? 'line-through text-slate-400' : ''}>{p.fecha} · {p.cuenta} · {fmt(p.monto_cuenta, p.moneda_cuenta === 'USD' ? 'USD' : 'BS')}</span>
                      {!p.reversado && <Button size="sm" variant="ghost" onClick={() => void reversar(p)} className="h-7 text-xs text-rose-700">Reversar</Button>}
                    </li>
                  ))}
                </ul>
              )}
              {(sel.estado === 'PENDIENTE' || sel.estado === 'PARCIAL') && (
                <form onSubmit={pagar} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block font-bold text-slate-700">Pagar desde</label>
                      <select value={cuentaId} onChange={(e) => setCuentaId(Number(e.target.value))} className="h-9 w-full rounded-xl border border-slate-300 px-2">
                        {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {fmt(c.saldo_actual, c.moneda === 'USD' ? 'USD' : 'BS')}</option>)}
                      </select>
                    </div>
                    <div><label className="mb-1 block font-bold text-slate-700">Monto ({cuenta?.moneda === 'USD' ? '$' : 'Bs'})</label><Input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required className="h-9 font-mono" /></div>
                    {cuenta && cuenta.moneda !== sel.moneda && (
                      <div><label className="mb-1 block font-bold text-slate-700">Tasa del pago — editable</label><Input type="number" step="0.0001" value={tasa} onChange={(e) => setTasa(e.target.value)} className="h-9 font-mono" /></div>
                    )}
                  </div>
                  {fechaOp.campo}
                  <DialogFooter className="gap-2">
                    {pagos.every((p) => p.reversado) && <Button type="button" variant="outline" onClick={() => void anular(sel)} className="text-xs text-rose-700">Anular factura</Button>}
                    <Button type="submit" disabled={enviando || fechaOp.incompleta} className="text-xs font-bold">{enviando ? 'Registrando…' : 'Registrar pago'}</Button>
                  </DialogFooter>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
