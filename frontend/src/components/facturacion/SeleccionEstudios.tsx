'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Microscope, Lock, Clock } from 'lucide-react';
import { ESPECIALISTAS_MEDICOS, PATOLOGO_OFICIAL } from '@/lib/catalogos';
import { EstudioItem } from '@/lib/catalogos';

interface SeleccionEstudiosProps {
  selectedArea: string;
  setSelectedArea: React.Dispatch<React.SetStateAction<string>>;
  selectedEstudioNombre: string;
  setSelectedEstudioNombre: React.Dispatch<React.SetStateAction<string>>;
  estudiosActuales: EstudioItem[];
  tasaBcv: number;
  esEstudioTecnico: boolean;
  selectedDoctor: string;
  esEcografia: boolean;
  setSelectedDoctor: React.Dispatch<React.SetStateAction<string>>;
  handleAgregarEstudio: () => void;
  esBiopsiaOCitologia: boolean;
}

export const SeleccionEstudios: React.FC<SeleccionEstudiosProps> = ({ selectedArea, setSelectedArea, selectedEstudioNombre, setSelectedEstudioNombre, estudiosActuales, tasaBcv, esEstudioTecnico, selectedDoctor, esEcografia, setSelectedDoctor, handleAgregarEstudio, esBiopsiaOCitologia }) => (
  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
    
    {/* 1. Selector de Área Médica */}
    <div className="md:col-span-4">
      <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Área Médica</label>
      <select
        value={selectedArea}
        onChange={(e) => setSelectedArea(e.target.value)}
        className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-cyan-500"
      >
        <option value="ECOGRAFIA_AM">Ecografía AM (Mañana)</option>
        <option value="ECOGRAFIA_PM">Ecografía PM (Tarde)</option>
        <option value="RADIOLOGIA">Radiología General (Rayos X)</option>
        <option value="MAMOGRAFIA">Mamografía Digital</option>
        <option value="CONSULTAS">Consultas Especializadas</option>
        <option value="GINECOLOGIA">Ginecología & Biopsias</option>
      </select>
    </div>

    {/* 2. Selector de Estudio */}
    <div className="md:col-span-8">
      <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
        Estudio o Procedimiento
      </label>
      <select
        value={selectedEstudioNombre}
        onChange={(e) => setSelectedEstudioNombre(e.target.value)}
        className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-cyan-500"
      >
        {estudiosActuales.map((e, idx) => {
          const precioBsEstudio = e.precio * tasaBcv;
          return (
            <option key={idx} value={e.nombre}>
              {e.nombre} — ${e.precio.toFixed(2)} (Bs. {precioBsEstudio.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </option>
          );
        })}
      </select>
    </div>

    {/* 3. Selector / Reglas de Médico Tratante */}
    <div className="md:col-span-8">
      <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
        Médico Especialista Asignado
      </label>
      
      {/* CASO: RADIOLOGÍA Y MAMOGRAFÍA (Técnico / 100% Clínica) */}
      {esEstudioTecnico ? (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 border border-slate-200">
          <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-xs font-bold text-slate-700">
            {selectedDoctor} (Personal Técnico Clínico — 100% Clínica)
          </span>
        </div>
      ) : esEcografia ? (
        /* CASO: ECOGRAFÍA (Ecografista asignado según turno AM/PM) */
        <div className="flex items-center gap-2 p-2 rounded-xl bg-cyan-50 border border-cyan-200">
          <Clock className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
          <span className="text-xs font-bold text-cyan-900">
            {selectedDoctor} (Ecografista de Turno {selectedArea === 'ECOGRAFIA_AM' ? 'Matutino' : 'Vespertino'})
          </span>
        </div>
      ) : (
        /* CASO: CONSULTAS Y GINECOLOGÍA (Selección Obligatoria) */
        <select
          value={selectedDoctor}
          onChange={(e) => setSelectedDoctor(e.target.value)}
          className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-cyan-400 bg-cyan-50/40 text-slate-900 focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">-- Seleccionar Médico Especialista Obligatorio --</option>
          {(ESPECIALISTAS_MEDICOS[selectedArea] || []).map((doc, idx) => (
            <option key={idx} value={doc.nombre}>
              {doc.nombre} {doc.especialidad ? `(${doc.especialidad})` : ''} {doc.precio ? `— $${doc.precio.toFixed(2)} (Bs. ${(doc.precio * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2 })})` : ''}
            </option>
          ))}
        </select>
      )}
    </div>

    {/* Botón Agregar al Carrito */}
    <div className="md:col-span-4 flex items-end">
      <Button
        type="button"
        onClick={handleAgregarEstudio}
        className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 h-9 shadow-md shadow-cyan-600/20"
      >
        <Plus className="w-4 h-4" />
        <span>Agregar al Carrito</span>
      </Button>
    </div>

    {/* Banner Informativo si aplica Patología */}
    {esBiopsiaOCitologia && (
      <div className="md:col-span-12 p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Microscope className="w-4 h-4 text-purple-700 shrink-0" />
          <div>
            <p className="text-xs font-black text-purple-950">Estudio con Análisis de Patología</p>
            <p className="text-[10px] text-purple-700">
              Asignado automáticamente a: <span className="font-bold">{PATOLOGO_OFICIAL.nombre}</span> ({PATOLOGO_OFICIAL.especialidad})
            </p>
          </div>
        </div>
        <Badge className="bg-purple-200 text-purple-900 font-mono text-[10px] font-bold">
          Patología Activa
        </Badge>
      </div>
    )}
  </div>
);
