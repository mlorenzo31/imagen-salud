'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Estado {
  activo: boolean;
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
        onClick={() => puedeVincular && setAbierto(true)}
        title={e.estado === 'APAGADO' ? 'El bot no está en ejecución: los envíos se hacen manualmente' : et.texto}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${et.clase} ${puedeVincular ? 'cursor-pointer' : 'cursor-default'}`}
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
            En el teléfono: WhatsApp → Dispositivos vinculados → Vincular un dispositivo.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};
