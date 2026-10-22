'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { CalendarClock } from 'lucide-react';
import { MOTIVOS_DIFERIDO, type MotivoDiferido } from '@/lib/fiscal/diferido';

export interface DiferirForm { activo: boolean; motivo: MotivoDiferido; pin: string }
export const DIFERIR_VACIO: DiferirForm = { activo: false, motivo: 'ANTICIPO', pin: '' };

interface DiferirFacturaProps {
  valor: DiferirForm;
  onChange: (v: DiferirForm) => void;
}

/** Facturación diferida: solo con un motivo de la lista y la clave del usuario; queda con fecha límite en Control Fiscal. */
export const DiferirFactura: React.FC<DiferirFacturaProps> = ({ valor, onChange }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
      <input type="checkbox" checked={valor.activo} onChange={(e) => onChange({ ...valor, activo: e.target.checked, pin: '' })} />
      <CalendarClock className="w-3.5 h-3.5" />
      Diferir la factura fiscal
    </label>
    {valor.activo && (
      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={valor.motivo}
          onChange={(e) => onChange({ ...valor, motivo: e.target.value as MotivoDiferido })}
          className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs md:col-span-2"
        >
          {(Object.keys(MOTIVOS_DIFERIDO) as MotivoDiferido[]).map((m) => <option key={m} value={m}>{MOTIVOS_DIFERIDO[m].etiqueta}</option>)}
        </select>
        <Input type="password" value={valor.pin} onChange={(e) => onChange({ ...valor, pin: e.target.value })} placeholder="Su clave para autorizar" className="h-8 text-xs rounded-xl md:col-span-2" />
      </div>
    )}
  </div>
);
