'use client';

import React from 'react';
import { ETIQUETA_ESTADO, ESTADOS_COBRO, type EstadoCobroFiscal, type Resumen } from '@/lib/fiscal/tablero';

export const usd = (c: number) => `$${(c / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const bs = (c: number) => `Bs. ${(c / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const COLOR_ESTADO: Record<EstadoCobroFiscal, string> = {
  EMITIDA: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  CONTINGENCIA: 'border-violet-200 bg-violet-50 text-violet-800',
  EN_PROCESO: 'border-sky-200 bg-sky-50 text-sky-800',
  RECHAZADA: 'border-rose-300 bg-rose-50 text-rose-800',
  DIFERIDA: 'border-amber-200 bg-amber-50 text-amber-800',
  DIFERIDA_VENCIDA: 'border-rose-300 bg-rose-50 text-rose-800',
  SIN_FACTURA: 'border-rose-300 bg-rose-50 text-rose-800',
};

/** Cobrado del período y su reparto por estado fiscal. */
export const TarjetasResumen: React.FC<{ resumen: Resumen }> = ({ resumen }) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Cobrado</p>
      <p className="text-lg font-black text-slate-900">{usd(resumen.cobrado.usd)}</p>
      <p className="text-xs text-slate-500">{bs(resumen.cobrado.bs)} · {resumen.cobrado.n} cobros</p>
    </div>
    {ESTADOS_COBRO.map((e) => (
      <div key={e} className={`rounded-2xl border p-3 ${COLOR_ESTADO[e]}`}>
        <p className="text-[11px] font-bold uppercase tracking-wide">{ETIQUETA_ESTADO[e]}</p>
        <p className="text-lg font-black">{usd(resumen.porEstado[e].usd)}</p>
        <p className="text-xs opacity-80">{bs(resumen.porEstado[e].bs)} · {resumen.porEstado[e].n}</p>
      </div>
    ))}
  </div>
);
