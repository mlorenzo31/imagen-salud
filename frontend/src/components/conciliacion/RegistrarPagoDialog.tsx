'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CreditCard } from 'lucide-react';

interface RegistrarPagoDialogProps {
  openModalRegistro: boolean;
  setOpenModalRegistro: React.Dispatch<React.SetStateAction<boolean>>;
  handleSubmitNuevoLote: (e: React.FormEvent) => void;
  formLote: string;
  setFormLote: React.Dispatch<React.SetStateAction<string>>;
  formTipo: "TDD" | "TDC";
  handleTipoChange: (tipo: "TDD" | "TDC") => void;
  formBanco: string;
  setFormBanco: React.Dispatch<React.SetStateAction<string>>;
  formFechaOperacion: string;
  setFormFechaOperacion: React.Dispatch<React.SetStateAction<string>>;
  formMontoBruto: number | "";
  handleBrutoChange: (val: string) => void;
  formComisionPct: number;
  formComisionBs: number | "";
  setFormComisionBs: React.Dispatch<React.SetStateAction<number | "">>;
  formNotas: string;
  setFormNotas: React.Dispatch<React.SetStateAction<string>>;
}

export const RegistrarPagoDialog: React.FC<RegistrarPagoDialogProps> = ({ openModalRegistro, setOpenModalRegistro, handleSubmitNuevoLote, formLote, setFormLote, formTipo, handleTipoChange, formBanco, setFormBanco, formFechaOperacion, setFormFechaOperacion, formMontoBruto, handleBrutoChange, formComisionPct, formComisionBs, setFormComisionBs, formNotas, setFormNotas }) => (
  <Dialog open={openModalRegistro} onOpenChange={setOpenModalRegistro}>
    <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-white shadow-2xl">
      <DialogHeader>
        <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
          <div className="p-2 bg-clinica-selection rounded-xl text-clinica-primary">
            <CreditCard className="w-5 h-5" />
          </div>
          <span>Registrar Cierre de Lote POS</span>
        </DialogTitle>
        <p className="text-xs text-slate-500 mt-1">
          Captura del reporte de cierre de terminal emitido al final del turno
        </p>
      </DialogHeader>

      <form onSubmit={handleSubmitNuevoLote} className="space-y-4 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">N° de Lote (Comprobante Terminal)</label>
            <Input
              placeholder="Ej. 000415"
              value={formLote}
              onChange={(e) => setFormLote(e.target.value)}
              required
              className="text-xs rounded-xl h-10 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Tipo de Tarjeta</label>
            <select
              value={formTipo}
              onChange={(e) => handleTipoChange(e.target.value as Parameters<typeof handleTipoChange>[0])}
              className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
            >
              <option value="TDD">TDD (Tarjeta Débito - 1.5%)</option>
              <option value="TDC">TDC (Tarjeta Crédito - 3.0%)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Terminal / Punto de Venta</label>
            <select
              value={formBanco}
              onChange={(e) => setFormBanco(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
            >
              <option value="Banco Banesco (Punto 01 - Admisión)">Banco Banesco (Punto 01 - Admisión)</option>
              <option value="Banco Mercantil (Punto 02 - Triaje)">Banco Mercantil (Punto 02 - Triaje)</option>
              <option value="Banco de Venezuela (Punto 03 - Caja)">Banco de Venezuela (Punto 03 - Caja)</option>
              <option value="Bancamiga (Punto Inalámbrico)">Bancamiga (Punto Inalámbrico)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Fecha de Cierre Lote</label>
            <Input
              type="date"
              value={formFechaOperacion}
              onChange={(e) => setFormFechaOperacion(e.target.value)}
              required
              className="text-xs rounded-xl h-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Monto Bruto Total del Lote (Bs)</label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formMontoBruto}
              onChange={(e) => handleBrutoChange(e.target.value)}
              required
              className="text-xs rounded-xl h-10 font-mono font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Comisión Bancaria Debitada (Bs)
              <span className="text-[10px] text-slate-400 ml-1">({formComisionPct}%)</span>
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formComisionBs}
              onChange={(e) => setFormComisionBs(parseFloat(e.target.value) || '')}
              required
              className="text-xs rounded-xl h-10 font-mono text-rose-600 font-bold"
            />
          </div>
        </div>

        {/* Cálculo Resumen de Neto */}
        {typeof formMontoBruto === 'number' && typeof formComisionBs === 'number' && (
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>Neto Esperado en Cuenta:</span>
              <span className="font-mono text-[#1D7A70]">
                Bs. {(formMontoBruto - formComisionBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Notas u Observaciones de Auditoría</label>
          <Input
            placeholder="Ej. Cierre nocturno turno sábado..."
            value={formNotas}
            onChange={(e) => setFormNotas(e.target.value)}
            className="text-xs rounded-xl h-10"
          />
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpenModalRegistro(false)}
            className="rounded-xl text-xs h-10"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white font-bold text-xs h-10 shadow-sm"
          >
            Guardar Cierre de Lote
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);
