'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { MessageCircle, Stethoscope, CalendarRange } from 'lucide-react';

interface PanelFiltrosAvanzadosProps {
  fechaDesde: string;
  setFechaDesde: React.Dispatch<React.SetStateAction<string>>;
  fechaHasta: string;
  setFechaHasta: React.Dispatch<React.SetStateAction<string>>;
  aplicarRangoRapido: (tipo: "HOY" | "7DIAS" | "ESTE_MES" | "ANO" | "TODO") => void;
  filtroTipoEstudio: string;
  setFiltroTipoEstudio: React.Dispatch<React.SetStateAction<string>>;
  categoriasDisponibles: string[];
  filtroWhatsApp: string;
  setFiltroWhatsApp: React.Dispatch<React.SetStateAction<string>>;
}

export const PanelFiltrosAvanzados: React.FC<PanelFiltrosAvanzadosProps> = ({ fechaDesde, setFechaDesde, fechaHasta, setFechaHasta, aplicarRangoRapido, filtroTipoEstudio, setFiltroTipoEstudio, categoriasDisponibles, filtroWhatsApp, setFiltroWhatsApp }) => (
  <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 animate-in fade-in-50 duration-200">
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
      {/* 1. Rango de Fechas */}
      <div className="md:col-span-6 space-y-1.5">
        <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
          <CalendarRange className="w-3.5 h-3.5 text-clinica-primary" />
          Rango de Fechas
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[9px] text-slate-400 block mb-0.5">Desde:</span>
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="h-8 text-xs font-mono rounded-xl"
            />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 block mb-0.5">Hasta:</span>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="h-8 text-xs font-mono rounded-xl"
            />
          </div>
        </div>
        {/* Accesos rápidos de fecha */}
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <button
            onClick={() => aplicarRangoRapido('HOY')}
            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Hoy
          </button>
          <button
            onClick={() => aplicarRangoRapido('7DIAS')}
            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            7 Días
          </button>
          <button
            onClick={() => aplicarRangoRapido('ESTE_MES')}
            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Este Mes
          </button>
          <button
            onClick={() => aplicarRangoRapido('ANO')}
            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Este Año
          </button>
          <button
            onClick={() => aplicarRangoRapido('TODO')}
            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Todo
          </button>
        </div>
      </div>

      {/* 2. Tipo / Área de Estudio */}
      <div className="md:col-span-3 space-y-1.5">
        <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
          <Stethoscope className="w-3.5 h-3.5 text-clinica-primary" />
          Área / Especialidad
        </label>
        <select
          value={filtroTipoEstudio}
          onChange={(e) => setFiltroTipoEstudio(e.target.value)}
          className="w-full h-8 px-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-cyan-500"
        >
          <option value="TODOS">Todas las Especialidades</option>
          <option value="Ecografía">Ecografía y Doppler</option>
          <option value="Ginecología">Ginecología y Obstetricia</option>
          <option value="Mamografía">Mamografía</option>
          <option value="Rayos X">Rayos X</option>
          <option value="Consulta Médica">Consulta Médica</option>
          <option value="Laboratorio">Laboratorio</option>
          {categoriasDisponibles
            .filter(c => !['Ecografía', 'Ginecología', 'Mamografía', 'Rayos X', 'Consulta Médica', 'Laboratorio'].includes(c))
            .map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
        </select>
      </div>

      {/* 3. Entrega de Resultados & WhatsApp */}
      <div className="md:col-span-3 space-y-1.5">
        <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
          Entrega y WhatsApp
        </label>
        <select
          value={filtroWhatsApp}
          onChange={(e) => setFiltroWhatsApp(e.target.value)}
          className="w-full h-8 px-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-cyan-500"
        >
          <option value="TODOS">Todos los Resultados</option>
          <option value="CON_WHATSAPP">✓ WhatsApp Enviado</option>
          <option value="SIN_WHATSAPP">Pendiente de Envío WA</option>
          <option value="CON_ADJUNTO">Con Informe Adjunto</option>
        </select>
      </div>
    </div>
  </div>
);
