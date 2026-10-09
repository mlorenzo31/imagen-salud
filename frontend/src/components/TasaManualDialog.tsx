'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';

interface Props {
  open: boolean;
  tasaActual: number;
  onCancelar: () => void;
  /** Se llama solo después de confirmar la clave en el servidor. */
  onConfirmar: (tasa: number, pin: string) => void;
}

/** El administrador fija la tasa BCV a mano; exige su clave (se verifica antes de aceptar el cambio). */
export const TasaManualDialog: React.FC<Props> = ({ open, tasaActual, onCancelar, onConfirmar }) => {
  const [tasa, setTasa] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  const cerrar = () => { setTasa(''); setPin(''); setError(null); onCancelar(); };
  const valor = parseFloat(tasa.replace(',', '.'));
  const valido = Number.isFinite(valor) && valor > 0 && pin.length > 0;

  const confirmar = async () => {
    setVerificando(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/verificar-clave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setError(j.error ?? 'No se pudo verificar la clave.'); return; }
      onConfirmar(Number(valor.toFixed(4)), pin);
      setTasa(''); setPin('');
    } catch {
      setError('Sin conexión con el servidor. Reintente.');
    } finally {
      setVerificando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cerrar(); }}>
      <DialogContent className="sm:max-w-sm rounded-3xl p-6 bg-white shadow-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2 font-black"><Lock className="h-5 w-5" />Fijar tasa BCV manualmente</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valido) void confirmar(); }}>
          <p className="text-xs text-slate-700">Tasa vigente: <strong className="font-mono">Bs. {tasaActual.toFixed(2)}</strong>. El cambio aplica solo a esta factura y queda en la Bitácora.</p>
          <Input inputMode="decimal" autoFocus value={tasa} onChange={(e) => setTasa(e.target.value)} placeholder="Nueva tasa (Bs. por $)" />
          <Input type="password" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Su clave de administrador" />
          {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
          <Button type="submit" disabled={!valido || verificando} className="w-full rounded-xl font-bold">{verificando ? 'Verificando…' : 'Fijar tasa'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
