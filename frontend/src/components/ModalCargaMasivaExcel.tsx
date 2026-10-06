'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUp, CheckCircle2, XCircle, AlertTriangle, Play, Save } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

interface ModalCargaMasivaExcelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FilaSimulada {
  fila: number;
  paciente: string;
  cedula: string;
  servicio: string;
  medico: string;
  monto_usd: number;
  monto_bs: number;
  metodo_pago: string;
  valido: boolean;
  observaciones: string[];
}

interface SimulacionExcel {
  total_filas: number;
  filas_validas: number;
  filas_invalidas: number;
  monto_total_usd: number;
  monto_total_bs?: number;
  filas: FilaSimulada[];
}

export const ModalCargaMasivaExcel: React.FC<ModalCargaMasivaExcelProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<SimulacionExcel | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSimulationResult(null);
      setErrorMsg(null);
    }
  };

  const handleDryRun = async () => {
    if (!file) {
      setErrorMsg('Seleccione un archivo Excel (.xlsx) primero.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/excel/dry-run', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error en simulación');
      setSimulationResult(data);
    } catch (err) {
      setErrorMsg(getErrorMessage(err) || 'Error al ejecutar simulación.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportDefinitivo = async () => {
    if (!simulationResult || simulationResult.filas_validas === 0) return;

    try {
      setLoading(true);
      const res = await fetch('/api/excel/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filas: simulationResult.filas,
          usuario: 'Administrador'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar datos');

      alert(data.mensaje);
      onSuccess();
      onOpenChange(false);
      setFile(null);
      setSimulationResult(null);
    } catch (err) {
      setErrorMsg(getErrorMessage(err) || 'Error al persistir datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white rounded-3xl p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-3 pb-2 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-slate-900">
                Carga Masiva Inteligente desde Excel (Dry-Run Simulator)
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Simula fila por fila, detecta inconsistencias y valida antes de impactar la base de datos
              </p>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Carga del archivo */}
        <div className="space-y-4 py-2">
          <div className="p-4 border-2 border-dashed border-slate-200 hover:border-cyan-400 rounded-2xl bg-slate-50 text-center transition-colors">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              id="excelInputFile"
              className="hidden"
            />
            <label htmlFor="excelInputFile" className="cursor-pointer block">
              <FileUp className="w-8 h-8 mx-auto text-slate-500 mb-2" />
              <span className="text-xs font-bold text-slate-700 block">
                {file ? file.name : 'Haz clic para seleccionar o arrastra tu archivo Excel (.xlsx)'}
              </span>
              <span className="text-[10px] text-slate-500">
                Columnas requeridas: Paciente, Cedula, Servicio, Medico, Monto_USD, Monto_BS, Metodo_Pago
              </span>
            </label>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleDryRun}
              disabled={!file || loading}
              className="text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm"
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              <span>{loading ? 'Simulando...' : 'Ejecutar Simulación (Dry-Run)'}</span>
            </Button>
          </div>

          {/* Resultado de la simulación */}
          {simulationResult && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Total Filas</span>
                  <p className="text-lg font-black font-mono text-slate-900">{simulationResult.total_filas}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase">Válidas</span>
                  <p className="text-lg font-black font-mono text-emerald-700">{simulationResult.filas_validas}</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-center">
                  <span className="text-[10px] text-rose-700 font-bold uppercase">Con Inconsistencias</span>
                  <p className="text-lg font-black font-mono text-rose-700">{simulationResult.filas_invalidas}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                  <span className="text-[10px] text-blue-700 font-bold uppercase">Monto Total USD</span>
                  <p className="text-lg font-black font-mono text-blue-700">${simulationResult.monto_total_usd.toFixed(2)}</p>
                </div>
              </div>

              {/* Tabla de inspección fila por fila */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2.5">Fila</th>
                      <th className="p-2.5">Paciente</th>
                      <th className="p-2.5">Servicio / Médico</th>
                      <th className="p-2.5 text-right">Monto ($)</th>
                      <th className="p-2.5 text-center">Estado</th>
                      <th className="p-2.5">Diagnóstico Dry-Run</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {simulationResult.filas.map((f, idx) => (
                      <tr key={idx} className={f.valido ? 'hover:bg-emerald-50/40' : 'bg-rose-50/40'}>
                        <td className="p-2.5 font-mono font-bold text-slate-600">#{f.fila}</td>
                        <td className="p-2.5 font-bold text-slate-900">{f.paciente}</td>
                        <td className="p-2.5 text-slate-600">{f.servicio} • <span className="font-semibold">{f.medico}</span></td>
                        <td className="p-2.5 text-right font-mono font-bold">${f.monto_usd.toFixed(2)}</td>
                        <td className="p-2.5 text-center">
                          {f.valido ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Válido</Badge>
                          ) : (
                            <Badge className="bg-rose-100 text-rose-800 text-[10px]">Error</Badge>
                          )}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-500">
                          {f.observaciones.length > 0 ? (
                            <span className="text-rose-600 font-medium">{f.observaciones.join(' • ')}</span>
                          ) : (
                            <span className="text-emerald-600 font-medium flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                              <span>Fila verificada sin conflictos</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs font-bold"
          >
            Cerrar
          </Button>

          {simulationResult && simulationResult.filas_validas > 0 && (
            <Button
              onClick={handleImportDefinitivo}
              disabled={loading}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              <span>Persistir {simulationResult.filas_validas} Filas Válidas en Base de Datos</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
