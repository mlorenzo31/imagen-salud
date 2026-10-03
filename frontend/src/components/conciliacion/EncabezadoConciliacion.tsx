'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, FileSpreadsheet, FileText, Plus, Receipt } from 'lucide-react';
import { ConciliacionPOS } from '@/types';
import type { PagoRecibidoCaja } from '../ModuloConciliacionPOS';

interface EncabezadoConciliacionProps {
  setSubTab: React.Dispatch<React.SetStateAction<"lotes" | "pagos_caja">>;
  subTab: "lotes" | "pagos_caja";
  lotes: ConciliacionPOS[];
  pagosCaja: PagoRecibidoCaja[];
  handleExportExcel: () => void;
  handleExportPDF: () => void;
  isReadOnly: boolean;
  setOpenModalRegistro: React.Dispatch<React.SetStateAction<boolean>>;
}

export const EncabezadoConciliacion: React.FC<EncabezadoConciliacionProps> = ({ setSubTab, subTab, lotes, pagosCaja, handleExportExcel, handleExportPDF, isReadOnly, setOpenModalRegistro }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex items-center gap-3">
      <div className="p-2.5 bg-clinica-selection rounded-xl text-clinica-primary">
        <CreditCard className="w-6 h-6" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-black text-slate-900">Conciliación Bancaria y Puntos de Venta</h2>
          <Badge className="bg-[#1D7A70] text-white text-[10px] font-mono">
            POS & Caja
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Control de lotes de tarjetas de débito y crédito POS, y conciliación de cobros recibidos contra extractos bancarios
        </p>
      </div>
    </div>

    {/* Conmutador de Pestañas: Lotes POS vs Pagos de Caja */}
    <div className="flex items-center gap-2">
      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
        <button
          onClick={() => setSubTab('lotes')}
          className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            subTab === 'lotes'
              ? 'bg-white text-[#1D7A70] shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Cierres de Lote POS ({lotes.length})</span>
        </button>
        <button
          onClick={() => setSubTab('pagos_caja')}
          className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            subTab === 'pagos_caja'
              ? 'bg-white text-[#1D7A70] shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Pagos Recibidos en Caja ({pagosCaja.length})</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          onClick={handleExportExcel}
          className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold flex items-center gap-1 shadow-none"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Excel</span>
        </Button>
        <Button
          size="sm"
          onClick={handleExportPDF}
          className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold flex items-center gap-1 shadow-none"
        >
          <FileText className="w-3.5 h-3.5 text-rose-600" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
        {subTab === 'lotes' && !isReadOnly && (
          <Button
            size="sm"
            onClick={() => setOpenModalRegistro(true)}
            className="h-8 px-3 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Registrar Lote</span>
          </Button>
        )}
      </div>
    </div>
  </div>
);
