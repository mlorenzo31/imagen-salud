'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle } from 'lucide-react';

interface Props {
  open: boolean;
  usuarioInicial: string;
  onCerrar: () => void;
}

/** "Olvidé mi clave": código de 6 dígitos por WhatsApp y nueva clave. */
export const RecuperarClave: React.FC<Props> = ({ open, usuarioInicial, onCerrar }) => {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [usuario, setUsuario] = useState(usuarioInicial);
  const [codigo, setCodigo] = useState('');
  const [clave, setClave] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const llamar = async (url: string, cuerpo: object): Promise<{ ok: boolean; mensaje?: string; error?: string }> => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const data = (await res.json().catch(() => ({}))) as { mensaje?: string; error?: string };
      if (!res.ok) setError(data.error ?? 'No se pudo completar la solicitud.');
      return { ok: res.ok, ...data };
    } catch {
      setError('Error de conexión con el servidor.');
      return { ok: false };
    } finally {
      setCargando(false);
    }
  };

  const pedirCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await llamar('/api/auth/recuperar/solicitar', { usuario });
    if (r.ok) { setMsg(r.mensaje ?? null); setPaso(2); }
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await llamar('/api/auth/recuperar/confirmar', { usuario, codigo, clave });
    if (r.ok) { setMsg(r.mensaje ?? 'Clave actualizada.'); setPaso(3); setCodigo(''); setClave(''); }
  };

  const cerrar = () => { setPaso(1); setCodigo(''); setClave(''); setError(null); setMsg(null); onCerrar(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cerrar(); }}>
      <DialogContent className="sm:max-w-sm rounded-3xl p-6 bg-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black"><MessageCircle className="w-5 h-5" />Recuperar clave</DialogTitle>
        </DialogHeader>

        {paso === 1 && (
          <form className="space-y-3" onSubmit={pedirCodigo}>
            <p className="text-xs text-slate-600">Le enviaremos un código de 6 dígitos al WhatsApp registrado de su usuario.</p>
            <Input autoFocus autoCapitalize="none" placeholder="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} className="rounded-xl font-mono" />
            {error && <p className="text-xs font-bold text-clinica-coral">{error}</p>}
            <Button type="submit" disabled={!usuario.trim() || cargando} className="w-full rounded-xl font-bold">{cargando ? 'Enviando…' : 'Enviar código'}</Button>
          </form>
        )}

        {paso === 2 && (
          <form className="space-y-3" onSubmit={confirmar}>
            <p className="text-xs text-slate-600">{msg} El código vence en 10 minutos.</p>
            <Input autoFocus inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} className="rounded-xl font-mono tracking-widest" />
            <Input type="password" autoComplete="new-password" placeholder="Nueva clave (8+ caracteres, letras y números)" value={clave} onChange={(e) => setClave(e.target.value)} className="rounded-xl" />
            {error && <p className="text-xs font-bold text-clinica-coral">{error}</p>}
            <Button type="submit" disabled={codigo.length !== 6 || !clave || cargando} className="w-full rounded-xl font-bold">{cargando ? 'Guardando…' : 'Cambiar clave'}</Button>
            <button type="button" onClick={() => { setPaso(1); setError(null); }} className="w-full text-[11px] font-bold text-slate-500 hover:underline">Pedir un código nuevo</button>
          </form>
        )}

        {paso === 3 && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-emerald-700">{msg}</p>
            <Button onClick={cerrar} className="w-full rounded-xl font-bold">Volver al inicio de sesión</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
