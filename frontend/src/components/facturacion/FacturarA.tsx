'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Building2 } from 'lucide-react';

export interface FacturarAForm { activo: boolean; razonSocial: string; rif: string; domicilio: string }
export const FACTURAR_A_VACIO: FacturarAForm = { activo: false, razonSocial: '', rif: '', domicilio: '' };

interface FacturarAProps {
  valor: FacturarAForm;
  onChange: (v: FacturarAForm) => void;
}

/** "Facturar a": la factura fiscal sale a nombre de una empresa o aseguradora en lugar del paciente (art. 8.6). */
export const FacturarA: React.FC<FacturarAProps> = ({ valor, onChange }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
      <input type="checkbox" checked={valor.activo} onChange={(e) => onChange({ ...valor, activo: e.target.checked })} />
      <Building2 className="w-3.5 h-3.5" />
      Facturar a una empresa o aseguradora
    </label>
    {valor.activo && (
      <div className="grid gap-2 md:grid-cols-2">
        <Input value={valor.razonSocial} onChange={(e) => onChange({ ...valor, razonSocial: e.target.value.toUpperCase() })} placeholder="Razón social" className="h-8 text-xs rounded-xl" />
        <Input value={valor.rif} onChange={(e) => onChange({ ...valor, rif: e.target.value.toUpperCase() })} placeholder="RIF (J-12345678-9)" className="h-8 text-xs rounded-xl font-mono" />
        <Input value={valor.domicilio} onChange={(e) => onChange({ ...valor, domicilio: e.target.value.toUpperCase() })} placeholder="Domicilio fiscal (opcional)" className="h-8 text-xs rounded-xl md:col-span-2" />
      </div>
    )}
  </div>
);
