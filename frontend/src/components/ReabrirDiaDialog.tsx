'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Unlock } from 'lucide-react';

interface Props {
  open: boolean;
  fecha: string;
  cargando?: boolean;
  error?: string | null;
  onCancelar: () => void;
  onConfirmar: (motivo: string, pin: string) => void;
}

/** Pide motivo y clave para reabrir una caja cerrada (solo administrador). */
export const ReabrirDiaDialog: React.FC<Props> = ({ open, fecha, cargando, error, onCancelar, onConfirmar }) => {
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');
  const cerrar = () => { setMotivo(''); setPin(''); onCancelar(); };
  const valido = motivo.trim().length >= 10 && pin.length > 0;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cerrar(); }}>
      <DialogContent className="sm:max-w-sm rounded-3xl p-6 bg-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black"><Unlock className="w-5 h-5" />Reabrir caja del {fecha}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); if (valido) { onConfirmar(motivo.trim(), pin); setPin(''); } }}
        >
          <p className="text-xs text-slate-600">El cierre actual queda guardado, el día vuelve a estar pendiente y deberá cerrarse de nuevo con su arqueo. Queda registrado en la Bitácora.</p>
          <textarea
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo de la reapertura (mínimo 10 caracteres)"
            className="w-full min-h-20 rounded-xl border border-slate-300 p-2 text-sm"
          />
          <Input type="password" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Su clave" />
          {error && <p className="text-xs font-bold text-clinica-coral">{error}</p>}
          <Button type="submit" disabled={!valido || cargando} className="w-full rounded-xl font-bold">
            {cargando ? 'Reabriendo…' : 'Reabrir caja'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
