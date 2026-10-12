'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, HandCoins } from 'lucide-react';
import { useAvisos } from '@/components/ui/avisos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DeudaMedico as DeudaMedicoT } from '@/lib/deudasHonorariosDb';

type Forma = 'EFECTIVO_USD' | 'EFECTIVO_BS' | 'PAGO_MOVIL_BS';
const FORMAS: { valor: Forma; etiqueta: string; simbolo: string }[] = [
  { valor: 'EFECTIVO_USD', etiqueta: 'Efectivo divisas', simbolo: '$' },
  { valor: 'EFECTIVO_BS', etiqueta: 'Efectivo bolívares', simbolo: 'Bs.' },
  { valor: 'PAGO_MOVIL_BS', etiqueta: 'Pago móvil', simbolo: 'Bs.' },
];
const ORIGEN: Record<string, string> = { CARGO: 'Factura anulada', ABONO_LIQUIDACION: 'Descontado en liquidación', ABONO_DEVOLUCION: 'Devolución' };

/** Etiqueta "Debe $X", registro de devolución e historial de la deuda de un médico. */
export function DeudaMedico({ deuda, tasaBcv, soloLectura, onCambio }: { deuda: DeudaMedicoT; tasaBcv: number; soloLectura: boolean; onCambio: () => void }) {
  const { avisar } = useAvisos();
  const [historial, setHistorial] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [forma, setForma] = useState<Forma>('EFECTIVO_USD');
  const [monto, setMonto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const simbolo = FORMAS.find((f) => f.valor === forma)!.simbolo;
  const montoNum = Number(monto);
  const equivalenteUsd = forma === 'EFECTIVO_USD' ? montoNum : tasaBcv > 0 ? montoNum / tasaBcv : 0;

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await fetch('/api/tesoreria/honorarios/deudas/devolucion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico: deuda.medico, forma, monto, referencia: referencia || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la devolución.');
      avisar({ tipo: 'exito', mensaje: `Devolución de ${deuda.medico} registrada. Deuda restante: $${Number(data.saldoRestanteUsd).toFixed(2)}.` });
      setAbierto(false);
      setMonto('');
      setReferencia('');
      onCambio();
    } catch (err) {
      avisar({ tipo: 'error', mensaje: err instanceof Error ? err.message : 'No se pudo registrar la devolución.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">{deuda.medico}</span>
          <Badge className="border border-amber-300 bg-amber-100 text-amber-900">Debe ${deuda.saldoUsd.toFixed(2)}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setHistorial((v) => !v)} className="h-8 rounded-xl px-2 text-xs">
            {historial ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Historial
          </Button>
          {deuda.saldoUsd > 0 && (
            <Button size="sm" variant="outline" disabled={soloLectura} onClick={() => setAbierto(true)} className="h-8 rounded-xl px-3 text-xs">
              <HandCoins className="h-3.5 w-3.5" />
              Registrar devolución
            </Button>
          )}
        </div>
      </div>

      {historial && (
        <ul className="mt-2 divide-y divide-amber-100 rounded-lg bg-white">
          {deuda.movimientos.map((m) => (
            <li key={m.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 animate-in fade-in-0 duration-200">
              <span className="text-slate-600">
                {m.fecha} · {ORIGEN[m.tipo]}
                {m.factura_id ? ` (factura ${m.factura_id})` : ''}
                {m.pago_honorario_id ? ` (liquidación ${m.pago_honorario_id})` : ''}
                {m.usuario ? ` · ${m.usuario}` : ''}
              </span>
              <span className={`font-mono font-bold ${m.tipo === 'CARGO' ? 'text-rose-700' : 'text-emerald-700'}`}>
                {m.tipo === 'CARGO' ? '+' : '−'}${Number(m.monto_usd).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle>Registrar devolución: {deuda.medico}</DialogTitle>
            <DialogDescription>Deuda actual: ${deuda.saldoUsd.toFixed(2)}. Lo devuelto entra a la cuenta elegida.</DialogDescription>
          </DialogHeader>
          <form onSubmit={registrar} className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-1.5">
              {FORMAS.map((f) => (
                <Button key={f.valor} type="button" variant={forma === f.valor ? 'default' : 'outline'} onClick={() => setForma(f.valor)} className="h-9 rounded-xl text-xs">
                  {f.etiqueta}
                </Button>
              ))}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Monto ({simbolo})</label>
              <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} className="h-9 rounded-xl font-mono" />
              {forma !== 'EFECTIVO_USD' && montoNum > 0 && (
                <p className="mt-1 text-slate-500">≈ ${equivalenteUsd.toFixed(2)} a la tasa BCV del día (el servidor confirma la conversión).</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Referencia</label>
              <Input placeholder="Opcional" value={referencia} onChange={(e) => setReferencia(e.target.value)} className="h-9 rounded-xl" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbierto(false)} className="rounded-xl text-xs">Cancelar</Button>
              <Button type="submit" disabled={enviando || !(montoNum > 0)} className="rounded-xl text-xs font-bold">
                {enviando ? 'Registrando…' : 'Registrar devolución'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
