'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound } from 'lucide-react';

interface Props { open: boolean; onCerrar: () => void }

/** El usuario cambia su propia clave (pide la actual). */
export const CambiarClaveDialog: React.FC<Props> = ({ open, onCerrar }) => {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cerrar = () => { setActual(''); setNueva(''); setError(null); setListo(false); onCerrar(); };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/cambiar-clave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actual, nueva }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(data.error ?? 'No se pudo cambiar la clave.'); return; }
      setListo(true);
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cerrar(); }}>
      <DialogContent className="sm:max-w-sm rounded-3xl p-6 bg-white shadow-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2 font-black"><KeyRound className="w-5 h-5" />Cambiar mi clave</DialogTitle></DialogHeader>
        {listo ? (
          <div className="space-y-3">
            <p className="text-sm font-bold text-emerald-700">Clave actualizada.</p>
            <Button onClick={cerrar} className="w-full rounded-xl font-bold">Cerrar</Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={enviar}>
            <Input type="password" autoFocus autoComplete="current-password" placeholder="Clave actual" value={actual} onChange={(e) => setActual(e.target.value)} className="rounded-xl" />
            <Input type="password" autoComplete="new-password" placeholder="Nueva clave (8+ caracteres, letras y números)" value={nueva} onChange={(e) => setNueva(e.target.value)} className="rounded-xl" />
            {error && <p className="text-xs font-bold text-clinica-coral">{error}</p>}
            <Button type="submit" disabled={!actual || !nueva || cargando} className="w-full rounded-xl font-bold">{cargando ? 'Guardando…' : 'Guardar'}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
