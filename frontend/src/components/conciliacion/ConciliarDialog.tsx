'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2 } from 'lucide-react';
import { ConciliacionPOS, CuentaBancaria } from '@/types';

interface ConciliarDialogProps {
  openModalConciliar: boolean;
  setOpenModalConciliar: React.Dispatch<React.SetStateAction<boolean>>;
  loteAConciliar: ConciliacionPOS | null;
  cuentaConciliacion: string;
  setCuentaConciliacion: React.Dispatch<React.SetStateAction<string>>;
  cuentas: CuentaBancaria[];
  refBancaria: string;
  setRefBancaria: React.Dispatch<React.SetStateAction<string>>;
  fechaAbono: string;
  setFechaAbono: React.Dispatch<React.SetStateAction<string>>;
  montoRealAcreditado: string;
  setMontoRealAcreditado: React.Dispatch<React.SetStateAction<string>>;
  notasConciliacion: string;
  setNotasConciliacion: React.Dispatch<React.SetStateAction<string>>;
  handleConfirmarConciliacion: () => void;
}

export const ConciliarDialog: React.FC<ConciliarDialogProps> = ({ openModalConciliar, setOpenModalConciliar, loteAConciliar, cuentaConciliacion, setCuentaConciliacion, cuentas, refBancaria, setRefBancaria, fechaAbono, setFechaAbono, montoRealAcreditado, setMontoRealAcreditado, notasConciliacion, setNotasConciliacion, handleConfirmarConciliacion }) => (
  <Dialog open={openModalConciliar} onOpenChange={setOpenModalConciliar}>
    <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white shadow-2xl">
      <DialogHeader>
        <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span>Conciliar Lote en Extracto Bancario</span>
        </DialogTitle>
        <p className="text-xs text-slate-500 mt-1">
          Validar y confirmar acreditación del Lote #{loteAConciliar?.lote_numero} ({loteAConciliar?.banco})
        </p>
      </DialogHeader>

      {loteAConciliar && (
        <div className="space-y-4 py-2 text-xs">
          {/* Resumen del Lote */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Monto Bruto Facturado en POS:</span>
              <span className="font-mono font-bold text-slate-900">
                Bs. {loteAConciliar.monto_bruto_pos_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Comisión Bancaria Retenida ({loteAConciliar.comision_porcentaje}%):</span>
              <span className="font-mono font-bold">
                -Bs. {loteAConciliar.comision_bancaria_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-sm text-[#1D7A70]">
              <span>Neto Liquidado Esperado:</span>
              <span className="font-mono">
                Bs. {loteAConciliar.monto_neto_liquidado_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Formulario de Confirmación en Extracto */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Cuenta Bancaria Receptora</label>
              <select
                value={cuentaConciliacion}
                onChange={e => setCuentaConciliacion(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
              >
                {cuentas && cuentas.length > 0 ? (
                  cuentas.filter(c => c.moneda === 'BS').map(c => (
                    <option key={c.id} value={c.nombre}>{c.nombre} ({c.codigo})</option>
                  ))
                ) : (
                  <>
                    <option value="Banco de Venezuela - Corriente">Banco de Venezuela - Cta Cte Principal</option>
                    <option value="Banco Banesco - Corriente">Banco Banesco - Recaudación POS</option>
                    <option value="Banco Mercantil - Corriente">Banco Mercantil - Operaciones</option>
                  </>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">N° Referencia Extracto</label>
                <Input
                  placeholder="Ej. REF-892341"
                  value={refBancaria}
                  onChange={e => setRefBancaria(e.target.value)}
                  className="text-xs rounded-xl h-9 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Fecha de Abono en Cuenta</label>
                <Input
                  type="date"
                  value={fechaAbono}
                  onChange={e => setFechaAbono(e.target.value)}
                  className="text-xs rounded-xl h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Monto Real Acreditado en Cuenta (Bs)</label>
              <Input
                type="number"
                step="0.01"
                value={montoRealAcreditado}
                onChange={e => setMontoRealAcreditado(e.target.value)}
                className="text-xs rounded-xl h-9 font-mono font-black text-[#1D7A70]"
              />
              {parseFloat(montoRealAcreditado) - loteAConciliar.monto_neto_liquidado_bs !== 0 && (
                <p className="text-[10px] font-bold text-amber-600 mt-1">
                  Diferencia de cuadre: Bs. {(parseFloat(montoRealAcreditado) - loteAConciliar.monto_neto_liquidado_bs).toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Notas de Auditoría</label>
              <Input
                placeholder="Ej. Abono verificado contra extracto online"
                value={notasConciliacion}
                onChange={e => setNotasConciliacion(e.target.value)}
                className="text-xs rounded-xl h-9"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setOpenModalConciliar(false)}
              className="flex-1 rounded-xl text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarConciliacion}
              className="flex-1 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold h-9 shadow-sm"
            >
              Confirmar y Conciliar
            </Button>
          </div>
        </div>
      )}
    </DialogContent>
  </Dialog>
);
