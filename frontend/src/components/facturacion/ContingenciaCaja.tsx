'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { CloudOff } from 'lucide-react';
import { MOTIVOS_CONTINGENCIA, type MotivoContingencia, type RespuestaContingencia } from '@/lib/fiscal/contingencia';

interface ContingenciaCajaProps {
  estado: RespuestaContingencia | null;
  control: string;
  onControl: (v: string) => void;
  onActivar: (motivo: MotivoContingencia, observacion: string, pin: string) => Promise<boolean>;
  onCerrar: (pin: string) => Promise<boolean>;
}

/**
 * Contingencia en la caja (arts. 6 y 11): se activa con un motivo del art. 6 y, mientras dura, cada cobro lleva
 * el N° de control preimpreso del talonario. Cerrada y aún sin remitir, permite registrar facturas físicas atrasadas.
 */
export const ContingenciaCaja: React.FC<ContingenciaCajaProps> = ({ estado, control, onControl, onActivar, onCerrar }) => {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoContingencia>('INTERNET');
  const [observacion, setObservacion] = useState('');
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (!estado) return null;
  const c = estado.contingencia;
  const confirmar = async (accion: () => Promise<boolean>) => {
    setEnviando(true);
    try {
      if (await accion()) { setAbierto(false); setPin(''); setObservacion(''); }
    } finally {
      setEnviando(false);
    }
  };
  const talonarios = estado.talonarios.map((t) => `Serie ${t.serie}: ${t.controlDesde} a ${t.controlHasta}`).join(' · ');

  if (!c) {
    if (estado.talonarios.length === 0) return null;
    return (
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={abierto} onChange={(e) => { setAbierto(e.target.checked); setPin(''); }} />
          <CloudOff className="w-3.5 h-3.5" />
          Activar contingencia (facturar en talonario)
        </label>
        {abierto && (
          <div className="grid gap-2 md:grid-cols-2">
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoContingencia)} className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs md:col-span-2">
              {(Object.keys(MOTIVOS_CONTINGENCIA) as MotivoContingencia[]).map((m) => <option key={m} value={m}>{MOTIVOS_CONTINGENCIA[m]}</option>)}
            </select>
            <Input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Observación (opcional)" className="h-8 text-xs rounded-xl md:col-span-2" />
            <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Su clave para confirmar" className="h-8 text-xs rounded-xl" />
            <button type="button" disabled={!pin || enviando} onClick={() => confirmar(() => onActivar(motivo, observacion, pin))}
              className="h-8 rounded-xl bg-violet-700 px-3 text-xs font-bold text-white disabled:opacity-50">Activar</button>
          </div>
        )}
      </div>
    );
  }

  const activa = c.estado === 'ACTIVA';
  return (
    <div className="space-y-2 rounded-2xl border border-violet-300 bg-violet-50 p-3 text-xs text-violet-900">
      <p className="flex items-center gap-2 font-bold">
        <CloudOff className="w-4 h-4" />
        {activa
          ? `Contingencia activa desde ${c.fechaInicio} ${c.horaInicio}: ${MOTIVOS_CONTINGENCIA[c.motivo]}`
          : `Contingencia cerrada el ${c.fechaFin}: remitir a la imprenta digital el ${c.plazoEnvio} (Control Fiscal).`}
      </p>
      <p className="text-violet-800">{talonarios || 'Sin talonarios activos.'} · {c.documentos} factura(s) física(s) registradas.</p>
      <Input
        value={control}
        onChange={(e) => onControl(e.target.value.trim())}
        placeholder={activa ? 'N° de control preimpreso (obligatorio), ej. 00-00000001' : 'N° de control de una factura física atrasada (opcional)'}
        className="h-8 text-xs rounded-xl bg-white font-mono"
      />
      {activa && (
        <div className="flex gap-2">
          <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Clave para cesar la contingencia" className="h-8 text-xs rounded-xl bg-white" />
          <button type="button" disabled={!pin || enviando} onClick={() => confirmar(() => onCerrar(pin))}
            className="h-8 shrink-0 rounded-xl border border-violet-400 bg-white px-3 font-bold text-violet-800 disabled:opacity-50">Cesar contingencia</button>
        </div>
      )}
    </div>
  );
};
