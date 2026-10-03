'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, UploadCloud } from 'lucide-react';
import type { FilaDryRun } from '../ModuloAdminCatalogos';

interface TabCargaMasivaProps {
  handleSubirArchivo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  progresoImportacion: number | null;
  importacionExitosa: boolean;
  setFilasDryRun: React.Dispatch<React.SetStateAction<FilaDryRun[]>>;
  setImportacionExitosa: React.Dispatch<React.SetStateAction<boolean>>;
  filasDryRun: FilaDryRun[];
  statsDryRun: { total: number; validas: number; advertencias: number; errores: number; };
  handleConfirmarImportacion: () => Promise<void>;
}

export const TabCargaMasiva: React.FC<TabCargaMasivaProps> = ({ handleSubirArchivo, fileInputRef, progresoImportacion, importacionExitosa, setFilasDryRun, setImportacionExitosa, filasDryRun, statsDryRun, handleConfirmarImportacion }) => (
  <div className="space-y-5">
    {/* Zona Drag & Drop */}
    <Card className="border-2 border-dashed border-[#80DDD2] bg-gradient-to-b from-[#EBF9F7]/40 to-white rounded-2xl p-8 text-center">
      <div className="max-w-md mx-auto space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-[#80DDD2] text-[#1D7A70] flex items-center justify-center mx-auto">
          <UploadCloud className="w-7 h-7 animate-pulse" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900">
            Carga Masiva Inteligente de Pacientes y Estudios
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Arrastra o selecciona un archivo <span className="font-bold text-slate-700">.xlsx</span> o <span className="font-bold text-slate-700">.csv</span>. El sistema ejecutará un análisis previo fila por fila (Dry-Run) antes de persistir datos.
          </p>
        </div>
        <div className="pt-2">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleSubirArchivo}
            ref={fileInputRef}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold px-5 h-9 shadow-sm"
          >
            Seleccionar Archivo de Excel / CSV
          </Button>
        </div>
      </div>
    </Card>

    {/* Barra de Progreso Reactiva */}
    {progresoImportacion !== null && (
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
        <div className="flex justify-between text-xs font-bold text-slate-700">
          <span>Procesando e insertando lote en base de datos...</span>
          <span>{progresoImportacion}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-[#1D7A70] h-full transition-all duration-300 rounded-full"
            style={{ width: `${progresoImportacion}%` }}
          />
        </div>
      </div>
    )}

    {/* Notificación de Éxito */}
    {importacionExitosa && (
      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>¡Lote de datos importado exitosamente en el catálogo activo!</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setFilasDryRun([]); setImportacionExitosa(false); }}
          className="h-7 text-xs border-emerald-300 text-emerald-800"
        >
          Limpiar Vista
        </Button>
      </div>
    )}

    {/* Resumen Dry-Run y Tabla de Previsualización */}
    {filasDryRun.length > 0 && (
      <div className="space-y-4">
        {/* Contadores Estadísticos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Filas</span>
            <p className="text-base font-black text-slate-900">{statsDryRun.total}</p>
          </div>
          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center">
            <span className="text-[10px] font-bold text-emerald-700 uppercase">Válidas</span>
            <p className="text-base font-black text-emerald-800">{statsDryRun.validas}</p>
          </div>
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-center">
            <span className="text-[10px] font-bold text-amber-700 uppercase">Con Advertencias</span>
            <p className="text-base font-black text-amber-800">{statsDryRun.advertencias}</p>
          </div>
          <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 text-center">
            <span className="text-[10px] font-bold text-rose-700 uppercase">Errores Bloqueantes</span>
            <p className="text-base font-black text-rose-800">{statsDryRun.errores}</p>
          </div>
        </div>

        {/* Botón de Confirmación en Lote */}
        <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
          <p className="text-xs text-slate-500">
            Previsualización fila por fila. Se excluirán automáticamente las filas con errores críticos.
          </p>
          <Button
            onClick={handleConfirmarImportacion}
            disabled={progresoImportacion !== null || statsDryRun.validas + statsDryRun.advertencias === 0}
            className="rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold px-4 h-9 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Confirmar e Importar Lote ({statsDryRun.validas + statsDryRun.advertencias})
          </Button>
        </div>

        {/* Tabla de Dry-Run */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Fila</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Cédula</th>
                <th className="py-2.5 px-3">Paciente</th>
                <th className="py-2.5 px-3">Estudio</th>
                <th className="py-2.5 px-3">Grupo</th>
                <th className="py-2.5 px-3">Médico</th>
                <th className="py-2.5 px-3 text-right">Tarifa ($)</th>
                <th className="py-2.5 px-3">Diagnóstico Preventivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filasDryRun.map((f, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-mono text-slate-400">#{f.fila}</td>
                  <td className="py-2.5 px-3">
                    {f.estadoFila === 'VALIDO' && (
                      <Badge className="bg-emerald-100 text-emerald-800 text-[9px]">Válido</Badge>
                    )}
                    {f.estadoFila === 'ADVERTENCIA' && (
                      <Badge className="bg-amber-100 text-amber-800 text-[9px]">Advertencia</Badge>
                    )}
                    {f.estadoFila === 'ERROR' && (
                      <Badge className="bg-rose-100 text-rose-800 text-[9px]">Error</Badge>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{f.cedula}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{f.paciente}</td>
                  <td className="py-2.5 px-3 text-slate-700">{f.estudio}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant="outline" className="text-[9px] font-bold">
                      Grupo {f.grupo_clinico}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{f.doctor}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-[#1D7A70]">
                    ${f.precio_usd.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-[11px]">
                    {f.errores.map((e: string, i: number) => (
                      <span key={i} className="text-rose-600 font-bold block">✕ {e}</span>
                    ))}
                    {f.advertencias.map((a: string, i: number) => (
                      <span key={i} className="text-amber-600 block">⚠ {a}</span>
                    ))}
                    {f.estadoFila === 'VALIDO' && (
                      <span className="text-emerald-600">✓ Listo para importar</span>
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
);
