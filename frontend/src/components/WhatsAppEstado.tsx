'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Estado {
  activo: boolean;
  numero?: string | null;
  estado: string;
  qr: string | null;
  pendientes: number;
}

const ETIQUETA: Record<string, { texto: string; clase: string }> = {
  CONECTADO: { texto: 'WhatsApp conectado', clase: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  ESPERANDO_QR: { texto: 'Vincular WhatsApp', clase: 'bg-amber-50 border-amber-200 text-amber-700' },
  CONECTANDO: { texto: 'WhatsApp conectando…', clase: 'bg-slate-50 border-slate-200 text-slate-600' },
  APAGADO: { texto: 'WhatsApp manual', clase: 'bg-slate-50 border-slate-200 text-slate-500' },
};

export const WhatsAppEstado: React.FC = () => {
  const [e, setE] = useState<Estado | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
      .then((j: { role?: string } | null) => setEsAdmin(j?.role === 'admin')).catch(() => {});
  }, []);

  const ordenar = async (accion: 'DESVINCULAR' | 'REVINCULAR') => {
    if (accion === 'DESVINCULAR' && !confirm('¿Desvincular el WhatsApp de la clínica? Los envíos automáticos se detendrán hasta vincular de nuevo.')) return;
    setEnviando(true); setMsg(null);
    try {
      const r = await fetch('/api/whatsapp/estado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, pin }) });
      const j = (await r.json().catch(() => ({}))) as { mensaje?: string; error?: string };
      setMsg({ ok: r.ok, texto: r.ok ? (j.mensaje ?? 'Listo.') : (j.error ?? 'No se pudo completar.') });
      if (r.ok) setPin('');
    } finally { setEnviando(false); }
  };

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const res = await fetch('/api/whatsapp/estado', { cache: 'no-store' });
        if (res.ok && vivo) setE((await res.json()) as Estado);
      } catch { /* sin conexión: se conserva el último estado */ }
    };
    void cargar();
    const t = setInterval(cargar, 15000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  if (!e) return null;
  const et = ETIQUETA[e.estado] ?? ETIQUETA.APAGADO;
  const puedeVincular = e.estado === 'ESPERANDO_QR' && Boolean(e.qr);

  return (
    <>
      <button
        type="button"
        onClick={() => (puedeVincular || esAdmin) && setAbierto(true)}
        title={e.estado === 'APAGADO' ? 'El bot no está en ejecución: los envíos se hacen manualmente' : et.texto}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${et.clase} ${puedeVincular || esAdmin ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
        <span className="hidden lg:inline">{et.texto}</span>
        {e.pendientes > 0 && <span className="font-semibold tabular-nums">{e.pendientes}</span>}
      </button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Vincular WhatsApp</DialogTitle>
          </DialogHeader>
          {e.qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.qr} alt="Código QR de WhatsApp" className="mx-auto size-64" />
          )}
          <p className="text-xs text-slate-500">
            {e.qr ? 'En el teléfono: WhatsApp → Dispositivos vinculados → Vincular un dispositivo.' : `Estado: ${et.texto}${e.numero ? ` (${e.numero})` : ''}`}
          </p>
          {esAdmin && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <Input type="password" placeholder="Su clave de inicio de sesión" value={pin} onChange={(ev) => setPin(ev.target.value)} className="rounded-xl text-sm" autoComplete="current-password" />
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={enviando || !pin} onClick={() => ordenar('REVINCULAR')} className="flex-1 rounded-xl text-xs font-bold">Generar QR nuevo</Button>
                <Button type="button" variant="outline" disabled={enviando || !pin || e.estado !== 'CONECTADO'} onClick={() => ordenar('DESVINCULAR')} className="flex-1 rounded-xl text-xs font-bold text-rose-600">Desvincular</Button>
              </div>
              {msg && <p className={`text-xs font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.texto}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
