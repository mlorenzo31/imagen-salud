'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, Plus, Search, Edit3, Clock, Percent, Power } from 'lucide-react';
import { DoctorCatalogo } from '@/types';

interface TabEspecialistasProps {
  busqueda: string;
  setBusqueda: React.Dispatch<React.SetStateAction<string>>;
  isReadOnly: boolean;
  handleAbrirEditarDoctor: (d?: DoctorCatalogo) => void;
  doctores: DoctorCatalogo[];
  handleToggleEstadoDoctor: (id: number | string) => void;
}

export const TabEspecialistas: React.FC<TabEspecialistasProps> = ({ busqueda, setBusqueda, isReadOnly, handleAbrirEditarDoctor, doctores, handleToggleEstadoDoctor }) => (
  <div className="space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80">
      <div className="relative flex-1 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
        <Input
          placeholder="Buscar por médico o especialidad..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
        />
      </div>
      {!isReadOnly && (
        <Button
          onClick={() => handleAbrirEditarDoctor()}
          className="h-9 px-4 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Especialista</span>
        </Button>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {doctores
        .filter(d => d.nombre.toLowerCase().includes(busqueda.toLowerCase()) || d.especialidad.toLowerCase().includes(busqueda.toLowerCase()))
        .map(d => (
          <Card
            key={d.id}
            className={`border bg-white rounded-2xl transition-all shadow-xs hover:shadow-md ${
              d.activo ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/70 opacity-75'
            }`}
          >
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-start justify-between pb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-800 flex items-center justify-center shrink-0 border border-cyan-200">
                  <Stethoscope className="w-5 h-5 text-[#1D7A70]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 leading-snug truncate">{d.nombre}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {d.cedula_rif || 'Sin Registrar'}
                    </span>
                    <p className="text-xs text-slate-500 font-medium truncate">{d.especialidad}</p>
                  </div>
                </div>
              </div>
              <Badge className={d.activo ? 'bg-emerald-100 text-emerald-800 text-[10px]' : 'bg-slate-200 text-slate-600 text-[10px]'}>
                {d.activo ? 'Operativo' : 'Inactivo'}
              </Badge>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Turno Asignado</span>
                  <div className="flex items-center gap-1 mt-0.5 font-bold text-slate-800">
                    <Clock className="w-3 h-3 text-[#1D7A70]" />
                    <span>{d.turno === 'AM' ? 'Mañana (AM)' : d.turno === 'PM' ? 'Tarde (PM)' : 'Jornada Completa'}</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Honorario Pactado</span>
                  <div className="flex items-center gap-1 mt-0.5 font-mono font-black text-[#1D7A70]">
                    <Percent className="w-3 h-3 text-[#1D7A70]" />
                    <span>{d.comision_pct}% Comisión</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                <span>Consultorio habitual:</span>
                <span className="font-semibold text-slate-700">{d.consultorio_defecto}</span>
              </div>

              {!isReadOnly && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAbrirEditarDoctor(d)}
                    className="flex-1 h-8 rounded-xl text-xs font-semibold border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Editar Especialista</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleEstadoDoctor(d.id)}
                    className={`h-8 px-2.5 rounded-xl text-xs font-semibold border-slate-200 ${
                      d.activo ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                    title={d.activo ? 'Desactivar Operativamente' : 'Activar Médico'}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
    </div>
  </div>
);
