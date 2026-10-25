'use client';

import React from 'react';
import { CloudOff, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOTIVOS_CONTINGENCIA, type MotivoContingencia } from '@/lib/fiscal/contingencia';
import type { ContingenciaTablero } from '@/lib/fiscal/tablero';

interface Props {
  contingencia: ContingenciaTablero;
  ocupado: boolean;
  onRemitir: () => void;
}

/** Contingencia sin remitir: estado, plazo del art. 7 (al día siguiente de cesar) y envío a la imprenta digital. */
export const PanelContingencia: React.FC<Props> = ({ contingencia: c, ocupado, onRemitir }) => {
  const alerta = c.estado === 'VENCE_HOY' || c.estado === 'VENCIDA';
  const color = alerta ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-violet-300 bg-violet-50 text-violet-900';
  const motivo = MOTIVOS_CONTINGENCIA[c.motivo as MotivoContingencia] ?? c.motivo;
  const texto = {
    ACTIVA: `Contingencia activa desde el ${c.fechaInicio} ${c.horaInicio}. Se factura en talonario; al cesar, ciérrela en Recepción.`,
    POR_ENVIAR: `Contingencia cerrada el ${c.fechaFin} ${c.horaFin ?? ''}. Remita los documentos físicos a la imprenta digital el ${c.plazoEnvio} (art. 7).`,
    VENCE_HOY: `Hoy vence el plazo para remitir a la imprenta digital los documentos físicos de la contingencia del ${c.fechaInicio} (art. 7).`,
    VENCIDA: `Plazo vencido el ${c.plazoEnvio}: remita ya a la imprenta digital los documentos físicos de la contingencia (art. 7).`,
    ENVIADA: 'Contingencia remitida.',
  }[c.estado];
  return (
    <div className={`flex flex-wrap items-start gap-3 rounded-2xl border p-3 text-sm ${color}`}>
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p className="font-bold">{texto}</p>
        <p className="text-xs opacity-90">{motivo} · {c.documentos} documento(s) físico(s) por remitir{c.ultimoError ? ` · Último error: ${c.ultimoError}` : ''}</p>
      </div>
      {c.estado !== 'ACTIVA' && (
        <Button size="sm" onClick={onRemitir} disabled={ocupado}><Send className="mr-1 h-4 w-4" />Remitir a la imprenta</Button>
      )}
    </div>
  );
};
