'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { CreditCard, DollarSign, Smartphone, Landmark } from 'lucide-react';

interface FormasDePagoProps {
  handleAutocompletar: (metodo: "divisas" | "efectivoBs" | "punto" | "pagoMovil") => void;
  pagoDivisas: string;
  setPagoDivisas: React.Dispatch<React.SetStateAction<string>>;
  numDivisas: number;
  tasaBcv: number;
  pagoEfectivoBs: string;
  setPagoEfectivoBs: React.Dispatch<React.SetStateAction<string>>;
  numEfectivoBs: number;
  pagoPuntoBs: string;
  setPagoPuntoBs: React.Dispatch<React.SetStateAction<string>>;
  numPuntoBs: number;
  pagoMovilBs: string;
  setPagoMovilBs: React.Dispatch<React.SetStateAction<string>>;
  numPagoMovilBs: number;
}

export const FormasDePago: React.FC<FormasDePagoProps> = ({ handleAutocompletar, pagoDivisas, setPagoDivisas, numDivisas, tasaBcv, pagoEfectivoBs, setPagoEfectivoBs, numEfectivoBs, pagoPuntoBs, setPagoPuntoBs, numPuntoBs, pagoMovilBs, setPagoMovilBs, numPagoMovilBs }) => (
  <div className="space-y-3">
    <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
      Desglose de Pago Multimoneda Simultáneo
    </p>

    {/* 1. Efectivo Divisas ($) */}
    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          <span>Efectivo Divisas ($)</span>
        </label>
        <button
          type="button"
          onClick={() => handleAutocompletar('divisas')}
          className="text-[10px] text-cyan-600 font-bold hover:underline"
        >
          Completar Faltante
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={pagoDivisas}
          onChange={(e) => setPagoDivisas(e.target.value)}
          className="text-xs font-mono font-bold rounded-xl bg-white flex-1"
        />
        <span className="text-[10px] font-mono text-emerald-700 font-bold shrink-0 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
          ≈ Bs. {(numDivisas * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>

    {/* 2. Efectivo Bolívares (Bs) */}
    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5 text-blue-600" />
          <span>Efectivo Bolívares (Bs)</span>
        </label>
        <button
          type="button"
          onClick={() => handleAutocompletar('efectivoBs')}
          className="text-[10px] text-cyan-600 font-bold hover:underline"
        >
          Completar Faltante
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={pagoEfectivoBs}
          onChange={(e) => setPagoEfectivoBs(e.target.value)}
          className="text-xs font-mono font-bold rounded-xl bg-white flex-1"
        />
        <span className="text-[10px] font-mono text-blue-700 font-bold shrink-0 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
          ≈ ${(numEfectivoBs / (tasaBcv > 0 ? tasaBcv : 1)).toFixed(2)} USD
        </span>
      </div>
    </div>

    {/* 3. Punto de Venta POS (Bs) */}
    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
          <span>Punto de Venta POS (Bs)</span>
        </label>
        <button
          type="button"
          onClick={() => handleAutocompletar('punto')}
          className="text-[10px] text-cyan-600 font-bold hover:underline"
        >
          Completar Faltante
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={pagoPuntoBs}
          onChange={(e) => setPagoPuntoBs(e.target.value)}
          className="text-xs font-mono font-bold rounded-xl bg-white flex-1"
        />
        <span className="text-[10px] font-mono text-indigo-700 font-bold shrink-0 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200">
          ≈ ${(numPuntoBs / (tasaBcv > 0 ? tasaBcv : 1)).toFixed(2)} USD
        </span>
      </div>
    </div>

    {/* 4. Pago Móvil (Bs) */}
    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5 text-cyan-600" />
          <span>Pago Móvil (Bs)</span>
        </label>
        <button
          type="button"
          onClick={() => handleAutocompletar('pagoMovil')}
          className="text-[10px] text-cyan-600 font-bold hover:underline"
        >
          Completar Faltante
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={pagoMovilBs}
          onChange={(e) => setPagoMovilBs(e.target.value)}
          className="text-xs font-mono font-bold rounded-xl bg-white flex-1"
        />
        <span className="text-[10px] font-mono text-cyan-700 font-bold shrink-0 bg-cyan-50 px-2 py-1 rounded-lg border border-cyan-200">
          ≈ ${(numPagoMovilBs / (tasaBcv > 0 ? tasaBcv : 1)).toFixed(2)} USD
        </span>
      </div>
    </div>
  </div>
);
