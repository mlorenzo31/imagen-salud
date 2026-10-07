'use client';

import React from 'react';
import { Search, ChevronDown, X, SlidersHorizontal, FolderTree, CalendarDays } from 'lucide-react';
import type { GrupoClinicoFiltro } from '../ModuloCajaDiaria';

interface BarraBusquedaCajaProps {
  filtroPeriodo: "HOY" | "SEMANA" | "MES" | "TODOS";
  setFiltroPeriodo: React.Dispatch<React.SetStateAction<"HOY" | "SEMANA" | "MES" | "TODOS">>;
  filtroEstados: string[];
  toggleFiltroEstado: (est: string) => void;
  filtroSoloDivisas: boolean;
  setFiltroSoloDivisas: React.Dispatch<React.SetStateAction<boolean>>;
  filtroSoloBs: boolean;
  setFiltroSoloBs: React.Dispatch<React.SetStateAction<boolean>>;
  filtroMontoMayor50: boolean;
  setFiltroMontoMayor50: React.Dispatch<React.SetStateAction<boolean>>;
  agruparPor: GrupoClinicoFiltro;
  setAgruparPor: React.Dispatch<React.SetStateAction<GrupoClinicoFiltro>>;
  busquedaTexto: string;
  setBusquedaTexto: React.Dispatch<React.SetStateAction<string>>;
  setMenuFiltrosAbierto: React.Dispatch<React.SetStateAction<boolean>>;
  menuFiltrosAbierto: boolean;
  /** Cajero: solo operaciones del día, sin chips ni menú de filtros. */
  soloHoy?: boolean;
}

export const BarraBusquedaCaja: React.FC<BarraBusquedaCajaProps> = ({ filtroPeriodo, setFiltroPeriodo, filtroEstados, toggleFiltroEstado, filtroSoloDivisas, setFiltroSoloDivisas, filtroSoloBs, setFiltroSoloBs, filtroMontoMayor50, setFiltroMontoMayor50, agruparPor, setAgruparPor, busquedaTexto, setBusquedaTexto, setMenuFiltrosAbierto, menuFiltrosAbierto, soloHoy = false }) => (
  <div className="relative flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-50 border-2 border-slate-300 focus-within:border-cyan-500 focus-within:bg-white transition-all">
    <Search className="w-5 h-5 text-slate-500 shrink-0 ml-1" />

    {/* Chips de Filtros Activos (Etiquetas de Filtrado) */}
    {soloHoy && (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-100 text-cyan-900 text-xs font-bold border border-cyan-300">
        <CalendarDays className="w-3 h-3" />
        <span>Hoy</span>
      </span>
    )}

    {!soloHoy && filtroPeriodo !== 'TODOS' && (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-100 text-cyan-900 text-xs font-bold border border-cyan-300">
        <CalendarDays className="w-3 h-3" />
        <span>{filtroPeriodo === 'HOY' ? 'Hoy' : filtroPeriodo === 'SEMANA' ? 'Últimos 7 Días' : 'Mes Actual'}</span>
        <button onClick={() => setFiltroPeriodo('TODOS')} className="hover:text-cyan-700">
          <X className="w-3 h-3" />
        </button>
      </span>
    )}

    {filtroEstados.map(st => (
      <span key={st} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs font-bold border border-blue-300">
        <span>Estado: {st}</span>
        <button onClick={() => toggleFiltroEstado(st)} className="hover:text-blue-700">
          <X className="w-3 h-3" />
        </button>
      </span>
    ))}

    {filtroSoloDivisas && (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-300">
        <span>Divisas ($)</span>
        <button onClick={() => setFiltroSoloDivisas(false)} className="hover:text-emerald-700">
          <X className="w-3 h-3" />
        </button>
      </span>
    )}

    {filtroSoloBs && (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 text-xs font-bold border border-purple-300">
        <span>Bolívares (Bs)</span>
        <button onClick={() => setFiltroSoloBs(false)} className="hover:text-purple-700">
          <X className="w-3 h-3" />
        </button>
      </span>
    )}

    {filtroMontoMayor50 && (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300">
        <span>Monto &gt; $50</span>
        <button onClick={() => setFiltroMontoMayor50(false)} className="hover:text-amber-700">
          <X className="w-3 h-3" />
        </button>
      </span>
    )}

    {agruparPor !== 'NINGUNO' && (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold">
        <FolderTree className="w-3 h-3 text-cyan-400" />
        <span>Agrupado por: {agruparPor}</span>
        <button onClick={() => setAgruparPor('NINGUNO')} className="hover:text-slate-300">
          <X className="w-3 h-3" />
        </button>
      </span>
    )}

    {/* Input de Búsqueda Libre */}
    <input
      type="text"
      placeholder={agruparPor !== 'NINGUNO' ? "Buscar dentro de los grupos..." : "Buscar por paciente, cédula, turno, médico o estudio..."}
      value={busquedaTexto}
      onChange={(e) => setBusquedaTexto(e.target.value)}
      className="flex-1 min-w-[200px] bg-transparent border-0 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
    />

    {/* Botón Desplegable Clinico (Filtros & Agrupaciones) */}
    {!soloHoy && <button
      type="button"
      onClick={() => setMenuFiltrosAbierto(!menuFiltrosAbierto)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
        menuFiltrosAbierto || agruparPor !== 'NINGUNO' || filtroEstados.length > 0
          ? 'bg-slate-900 text-white shadow-sm'
          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
      }`}
    >
      <SlidersHorizontal className="w-3.5 h-3.5" />
      <span>Filtros & Agrupaciones</span>
      <ChevronDown className={`w-3 h-3 transition-transform ${menuFiltrosAbierto ? 'rotate-180' : ''}`} />
    </button>}
  </div>
);
