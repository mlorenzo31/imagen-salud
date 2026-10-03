'use client';

import React from 'react';
import { ServicioCatalogo } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ModalEstudioProps {
  modalServicio: { visible: boolean; item?: ServicioCatalogo; };
  formServicio: Partial<ServicioCatalogo>;
  setFormServicio: React.Dispatch<React.SetStateAction<Partial<ServicioCatalogo>>>;
  setModalServicio: React.Dispatch<React.SetStateAction<{ visible: boolean; item?: ServicioCatalogo; }>>;
  handleGuardarServicio: () => void;
}

export const ModalEstudio: React.FC<ModalEstudioProps> = ({ modalServicio, formServicio, setFormServicio, setModalServicio, handleGuardarServicio }) => (
  <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
      <h3 className="text-sm font-black text-slate-900">
        {modalServicio.item ? 'Editar Tarifa y Estudio Médico' : 'Crear Nuevo Estudio y Tarifa'}
      </h3>
      <div className="space-y-3 text-xs">
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Nombre del Estudio / Procedimiento</label>
          <Input
            value={formServicio.nombre || ''}
            onChange={e => setFormServicio({ ...formServicio, nombre: e.target.value.toUpperCase() })}
            placeholder="Nombre oficial del estudio"
            className="h-8 text-xs rounded-xl uppercase placeholder:normal-case font-bold"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Grupo Clínico</label>
            <select
              value={formServicio.grupo_clinico || 'A'}
              onChange={e => setFormServicio({ ...formServicio, grupo_clinico: e.target.value as ServicioCatalogo['grupo_clinico'] })}
              className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs"
            >
              <option value="A">Grupo A: Ginecología & Eco</option>
              <option value="B">Grupo B: Mamo & Rayos X</option>
              <option value="C">Grupo C: Consultas Médicas</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Precio Base ($ USD)</label>
            <Input
              type="number"
              value={formServicio.precio_usd || ''}
              onChange={e => setFormServicio({ ...formServicio, precio_usd: parseFloat(e.target.value) || 0 })}
              placeholder="35"
              className="h-8 text-xs rounded-xl font-mono font-bold text-[#1D7A70]"
            />
          </div>
        </div>

        {/* Repartos Porcentuales */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Reglas de Reparto (%):</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block">Clínica %</label>
              <Input
                type="number"
                value={formServicio.reparto_clinica_pct ?? 35}
                onChange={e => setFormServicio({ ...formServicio, reparto_clinica_pct: parseFloat(e.target.value) || 0 })}
                className="h-7 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block">Médico %</label>
              <Input
                type="number"
                value={formServicio.reparto_medico_pct ?? 50}
                onChange={e => setFormServicio({ ...formServicio, reparto_medico_pct: parseFloat(e.target.value) || 0 })}
                className="h-7 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block">Ecógrafo %</label>
              <Input
                type="number"
                value={formServicio.reparto_eco_pct ?? 0}
                onChange={e => setFormServicio({ ...formServicio, reparto_eco_pct: parseFloat(e.target.value) || 0 })}
                className="h-7 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block">Patólogo %</label>
              <Input
                type="number"
                value={formServicio.reparto_patologo_pct ?? 0}
                onChange={e => setFormServicio({ ...formServicio, reparto_patologo_pct: parseFloat(e.target.value) || 0 })}
                className="h-7 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <Button
          variant="outline"
          onClick={() => setModalServicio({ visible: false })}
          className="flex-1 h-8 rounded-xl text-xs"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleGuardarServicio}
          className="flex-1 h-8 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold"
        >
          Guardar
        </Button>
      </div>
    </div>
  </div>
);
