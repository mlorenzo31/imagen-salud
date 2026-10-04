'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Devolucion {
  id: number; factura_id: number; medio: string; monto_bs: string; afecta_cuenta: boolean; estado: string;
  nombre_paciente: string | null; cedula_paciente: string | null; turno_num: number | null;
}

interface Props { onPagada?: () => void }

const bs = (v: string | number) => `Bs. ${Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Devoluciones de facturas anuladas (POS / pago móvil) que deben pagarse como egreso con clave y referencia. */
export const DevolucionesPendientes: React.FC<Props> = ({ onPagada }) => {
  const [items, setItems] = useState<Devolucion[]>([]);
  const [activa, setActiva] = useState<Devolucion | null>(null);
  const [referencia, setReferencia] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/tesoreria/devoluciones', { cache: 'no-store' });
      if (r.ok) setItems(((await r.json()) as Devolucion[]).filter((d) => d.estado === 'PENDIENTE'));
    } catch { /* sin conexión: se reintenta al recargar */ }
  }, []);

  useEffect(() => {
    let vivo = true;
    fetch('/api/tesoreria/devoluciones', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Devolucion[]>) : []))
      .then((d) => { if (vivo) setItems(d.filter((x) => x.estado === 'PENDIENTE')); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const pagar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activa) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch('/api/tesoreria/devoluciones/pagar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activa.id, referencia, pin }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setError(j.error ?? 'No se pudo pagar la devolución.'); return; }
      setActiva(null); setReferencia(''); setPin('');
      await cargar();
      onPagada?.();
    } finally {
      setEnviando(false);
    }
  };

  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <h3 className="text-sm font-black text-amber-900">Devoluciones pendientes por facturas anuladas ({items.length})</h3>
      <p className="text-xs text-amber-800">Pagadas con punto de venta o pago móvil. Se registran como egreso al devolver el dinero al paciente.</p>
      <div className="space-y-2">
        {items.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-amber-200 p-3 text-xs">
            <div>
              <p className="font-bold text-slate-900">{d.nombre_paciente ?? 'Paciente'} · factura {d.factura_id}</p>
              <p className="text-slate-500">{d.medio === 'PAGO_MOVIL' ? 'Pago móvil' : 'Punto de venta'}{d.afecta_cuenta ? '' : ' · aún no abonado a la cuenta'}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black font-mono text-slate-900">{bs(d.monto_bs)}</span>
              <Button size="sm" className="rounded-xl text-xs font-bold" onClick={() => { setActiva(d); setReferencia(''); setPin(''); setError(null); }}>Pagar devolución</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={activa !== null} onOpenChange={(o) => { if (!o) setActiva(null); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl p-6">
          <DialogHeader><DialogTitle className="font-black">Pagar devolución</DialogTitle></DialogHeader>
          {activa && (
            <form className="space-y-3" onSubmit={pagar}>
              <p className="text-xs text-slate-600">Factura {activa.factura_id} · {activa.nombre_paciente ?? 'Paciente'}<br />Monto fijo a devolver: <span className="font-black">{bs(activa.monto_bs)}</span></p>
              <Input required placeholder="Referencia bancaria de la devolución" value={referencia} onChange={(e) => setReferencia(e.target.value)} className="rounded-xl text-sm" />
              <Input required type="password" placeholder="Clave de inicio de sesión" value={pin} onChange={(e) => setPin(e.target.value)} className="rounded-xl text-sm" autoComplete="current-password" />
              {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
              <Button type="submit" disabled={enviando || referencia.trim().length < 3 || !pin} className="w-full rounded-xl font-bold">{enviando ? 'Registrando…' : 'Confirmar y registrar egreso'}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
