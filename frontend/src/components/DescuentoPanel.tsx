'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BadgePercent, X } from 'lucide-react';
import { TOPE_DESCUENTO_CAJERO_BP, type ModoReparto } from '@/lib/descuento';
import type { DescuentoUI } from '@/lib/descuentoUI';

export interface VistaDescuento {
  error: string | null; descuentoUSD: number; netoUSD: number; honorariosUSD: number; gananciaUSD: number; bp: number;
}

interface Props {
  deshabilitado: boolean;
  rol?: string;
  aplicado: DescuentoUI | null;
  vista: (d: DescuentoUI) => VistaDescuento;
  onAplicar: (d: DescuentoUI) => void;
  onQuitar: () => void;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Descuento manual en caja: pide tipo, valor, reparto, motivo y la clave de quien factura (y de un autorizador si supera el tope). */
export const DescuentoPanel: React.FC<Props> = ({ deshabilitado, rol, aplicado, vista, onAplicar, onQuitar }) => {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<'PCT' | 'USD'>('PCT');
  const [valor, setValor] = useState('');
  const [modo, setModo] = useState<ModoReparto>('CLINICA');
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');
  const [autUsuario, setAutUsuario] = useState('');
  const [autClave, setAutClave] = useState('');

  if (deshabilitado) {
    return <p className="text-[11px] text-slate-600">Esta factura tiene una promoción aplicada; no admite un descuento manual adicional.</p>;
  }

  if (aplicado) {
    const v = vista(aplicado);
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs">
        <div className="text-emerald-900">
          <p className="font-black">Descuento aplicado: {usd(v.descuentoUSD)} ({(v.bp / 100).toFixed(2)} %)</p>
          <p>Reparto: {aplicado.modo === 'CLINICA' ? 'la clínica asume' : 'proporcional con el doctor'} · Motivo: {aplicado.motivo}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onQuitar} className="shrink-0 rounded-lg text-xs"><X className="mr-1 h-3 w-3" />Quitar</Button>
      </div>
    );
  }

  if (!abierto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)} className="rounded-xl text-xs font-bold">
        <BadgePercent className="mr-1.5 h-3.5 w-3.5" />Aplicar descuento
      </Button>
    );
  }

  const n = parseFloat(valor.replace(',', '.'));
  const borrador: DescuentoUI = {
    tipo, valor: Number.isFinite(n) ? n : 0, modo, motivo: motivo.trim(), pin,
    autorizador: autUsuario.trim() && autClave ? { usuario: autUsuario.trim(), clave: autClave } : null,
  };
  const v = Number.isFinite(n) && n > 0 ? vista(borrador) : null;
  const pideAutorizador = rol === 'cajero' && v !== null && v.error === null && v.bp > TOPE_DESCUENTO_CAJERO_BP;
  const completo = v !== null && v.error === null && motivo.trim().length >= 5 && pin.length > 0 && (!pideAutorizador || borrador.autorizador !== null);

  return (
    <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-black text-slate-900">Descuento manual</p>
        <button type="button" onClick={() => setAbierto(false)} className="text-slate-600 hover:text-slate-900" aria-label="Cerrar"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as 'PCT' | 'USD')} className="h-9 rounded-lg border border-slate-300 bg-white px-2">
          <option value="PCT">Porcentaje (%)</option>
          <option value="USD">Monto ($)</option>
        </select>
        <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === 'PCT' ? 'Ej. 10' : 'Ej. 5.00'} />
      </div>
      <fieldset className="space-y-1">
        <legend className="font-bold text-slate-800">¿Quién asume el descuento?</legend>
        <label className="flex items-start gap-2"><input type="radio" name="modo" checked={modo === 'CLINICA'} onChange={() => setModo('CLINICA')} className="mt-0.5" /><span>La clínica (el doctor cobra lo mismo)</span></label>
        <label className="flex items-start gap-2"><input type="radio" name="modo" checked={modo === 'PROPORCIONAL'} onChange={() => setModo('PROPORCIONAL')} className="mt-0.5" /><span>Se reparte en proporción con el doctor</span></label>
      </fieldset>
      {v && v.error === null && (
        <p className="rounded-lg bg-white p-2 font-mono text-[11px] text-slate-800">
          Total a cobrar {usd(v.netoUSD)} (−{usd(v.descuentoUSD)}) · Doctor {usd(v.honorariosUSD)} · Clínica {usd(v.gananciaUSD)}
        </p>
      )}
      {v && v.error !== null && <p className="font-bold text-rose-700">{v.error}</p>}
      <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obligatorio)" />
      <Input type="password" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Su clave para confirmar" />
      {pideAutorizador && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
          <p className="font-bold text-amber-900">Supera {TOPE_DESCUENTO_CAJERO_BP / 100} %: requiere un administrador o asistente.</p>
          <Input value={autUsuario} onChange={(e) => setAutUsuario(e.target.value)} placeholder="Usuario del autorizador" autoComplete="off" />
          <Input type="password" value={autClave} onChange={(e) => setAutClave(e.target.value)} placeholder="Clave del autorizador" autoComplete="off" />
        </div>
      )}
      <Button type="button" disabled={!completo} onClick={() => { onAplicar(borrador); setAbierto(false); setPin(''); setAutClave(''); }} className="w-full rounded-xl font-bold">
        Aplicar descuento
      </Button>
    </div>
  );
};
