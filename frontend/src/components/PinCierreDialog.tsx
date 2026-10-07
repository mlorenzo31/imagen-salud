'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';

interface Props {
  open: boolean;
  cargando?: boolean;
  error?: string | null;
  onCancelar: () => void;
  onConfirmar: (pin: string) => void;
}

/** Pide la clave de inicio de sesión antes de cerrar la caja. */
export const PinCierreDialog: React.FC<Props> = ({ open, cargando, error, onCancelar, onConfirmar }) => {
  const [pin, setPin] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPin(''); onCancelar(); } }}>
      <DialogContent className="sm:max-w-sm rounded-3xl p-6 bg-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black"><Lock className="w-5 h-5" />Confirmar cierre de caja</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); if (pin) { onConfirmar(pin); setPin(''); } }}
        >
          <p className="text-xs text-slate-600">Ingrese la clave con la que inició sesión.</p>
          <Input type="password" autoFocus autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Clave" />
          {error && <p className="text-xs font-bold text-clinica-coral">{error}</p>}
          <Button type="submit" disabled={!pin || cargando} className="w-full rounded-xl font-bold">
            {cargando ? 'Cerrando caja…' : 'Cerrar caja'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
