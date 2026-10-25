'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface FormRetencion {
  agenteRif: string; agenteRazonSocial: string; numeroComprobante: string; fechaComprobante: string;
  facturaSerie: string; facturaNumero: string; ivaRetenido: string; islrRetenido: string; observacion: string;
}
export const formRetencionVacio = (fecha: string): FormRetencion => ({
  agenteRif: '', agenteRazonSocial: '', numeroComprobante: '', fechaComprobante: fecha,
  facturaSerie: '', facturaNumero: '', ivaRetenido: '0', islrRetenido: '', observacion: '',
});

interface Props {
  valor: FormRetencion;
  onChange: (v: FormRetencion) => void;
  onGuardar: () => void;
  onCancelar: () => void;
  guardando: boolean;
}

/** Comprobante que entregó el agente de retención (aseguradora o empresa), contra la factura fiscal de la clínica. */
export const FormRetencionRecibida: React.FC<Props> = ({ valor, onChange, onGuardar, onCancelar, guardando }) => {
  const etq = 'mb-1 block text-xs font-bold text-slate-600';
  const campo = (k: keyof FormRetencion, titulo: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className={etq}>{titulo}</label><Input value={valor[k]} onChange={(e) => onChange({ ...valor, [k]: e.target.value })} className="h-9 text-xs" {...extra} /></div>
  );
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-bold text-slate-800">Registrar comprobante de retención recibido</p>
      <div className="grid gap-3 md:grid-cols-3">
        {campo('agenteRif', 'RIF del agente de retención', { placeholder: 'J-00000000-0' })}
        {campo('agenteRazonSocial', 'Razón social del agente')}
        {campo('numeroComprobante', 'N° de comprobante (14 dígitos)', { placeholder: 'AAAAMMSSSSSSSS', inputMode: 'numeric', maxLength: 14 })}
        {campo('fechaComprobante', 'Fecha del comprobante', { type: 'date' })}
        {campo('facturaSerie', 'Serie de la factura (solo talonario)', { placeholder: 'vacío = digital' })}
        {campo('facturaNumero', 'N° de la factura de la clínica', { inputMode: 'numeric' })}
        {campo('ivaRetenido', 'IVA retenido (Bs)', { inputMode: 'decimal' })}
        {campo('islrRetenido', 'ISLR retenido (Bs)', { inputMode: 'decimal' })}
        {campo('observacion', 'Observación')}
      </div>
      <p className="text-xs text-slate-500">Los servicios médicos son exentos de IVA: normalmente solo hay retención de ISLR.</p>
      <div className="flex gap-2">
        <Button onClick={onGuardar} disabled={guardando} className="rounded-xl text-xs font-bold">{guardando ? 'Guardando…' : 'Guardar'}</Button>
        <Button variant="outline" onClick={onCancelar} className="rounded-xl text-xs">Cancelar</Button>
      </div>
    </div>
  );
};
