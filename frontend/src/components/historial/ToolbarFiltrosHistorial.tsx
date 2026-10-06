'use client';

import React from 'react';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers, SlidersHorizontal, FolderTree, X, ChevronDown, ChevronUp } from 'lucide-react';
import { FacturaCaja } from '@/types';
import type { PacienteData } from '../ModuloHistorialPacientes';

interface ToolbarFiltrosHistorialProps {
  movimientosFiltrados: FacturaCaja[];
  movimientos: FacturaCaja[];
  formatUSD: (val?: number | string | null) => string;
  totalUSDFiltrado: number;
  agrupacion: "NINGUNA" | "FECHA" | "TIPO_ESTUDIO" | "MEDICO" | "PACIENTE";
  setAgrupacion: React.Dispatch<React.SetStateAction<"NINGUNA" | "FECHA" | "TIPO_ESTUDIO" | "MEDICO" | "PACIENTE">>;
  pacienteSeleccionado: PacienteData | null;
  setMostrarFiltrosAvanzados: React.Dispatch<React.SetStateAction<boolean>>;
  mostrarFiltrosAvanzados: boolean;
  hayFiltrosActivos: boolean;
  limpiarTodosLosFiltros: () => void;
}

export const ToolbarFiltrosHistorial: React.FC<ToolbarFiltrosHistorialProps> = ({ movimientosFiltrados, movimientos, formatUSD, totalUSDFiltrado, agrupacion, setAgrupacion, pacienteSeleccionado, setMostrarFiltrosAvanzados, mostrarFiltrosAvanzados, hayFiltrosActivos, limpiarTodosLosFiltros }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <Layers className="w-4 h-4 text-clinica-primary" />
          Historial Detallado de Movimientos y Estudios
        </CardTitle>
        <Badge variant="outline" className="text-[10px] font-mono border-slate-300 bg-white">
          {movimientosFiltrados.length} de {movimientos.length} atenciones
        </Badge>
        <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
          Subtotal: {formatUSD(totalUSDFiltrado)}
        </Badge>
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5">
        Trazabilidad cronológica de servicios clínicos, cobros y estado de entrega de resultados
      </p>
    </div>

    {/* Botones de Control Rápido */}
    <div className="flex flex-wrap items-center gap-2">
      {/* Selector de Agrupación */}
      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs">
        <FolderTree className="w-3.5 h-3.5 text-clinica-primary" />
        <span className="text-[10px] font-black text-slate-500 uppercase">Agrupar:</span>
        <select
          value={agrupacion}
          onChange={(e) => setAgrupacion(e.target.value as Parameters<typeof setAgrupacion>[0])}
          className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-hidden cursor-pointer"
        >
          <option value="NINGUNA">Sin Agrupar (Lista)</option>
          <option value="FECHA">Por Fecha / Mes</option>
          <option value="TIPO_ESTUDIO">Por Tipo de Estudio</option>
          <option value="MEDICO">Por Médico Tratante</option>
          {!pacienteSeleccionado && <option value="PACIENTE">Por Paciente</option>}
        </select>
      </div>

      {/* Botón de Filtros Avanzados */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)}
        className={`h-8 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
          mostrarFiltrosAvanzados || hayFiltrosActivos 
            ? 'bg-clinica-selection border-clinica-primary/50 text-clinica-dark font-black' 
            : 'border-slate-200 text-slate-700 hover:bg-slate-100'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-clinica-primary" />
        <span>Filtros Avanzados</span>
        {hayFiltrosActivos && (
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        )}
        {mostrarFiltrosAvanzados ? (
          <ChevronUp className="w-3 h-3 text-slate-500 ml-0.5" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-500 ml-0.5" />
        )}
      </Button>

      {/* Limpiar Filtros */}
      {hayFiltrosActivos && (
        <Button
          size="sm"
          variant="ghost"
          onClick={limpiarTodosLosFiltros}
          className="h-8 px-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1"
          title="Restablecer todos los filtros"
        >
          <X className="w-3.5 h-3.5" />
          <span>Limpiar</span>
        </Button>
      )}
    </div>
  </div>
);
