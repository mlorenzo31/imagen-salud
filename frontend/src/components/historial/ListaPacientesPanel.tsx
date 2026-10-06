'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, User, Globe, ChevronRight } from 'lucide-react';
import { normalizarCedulaRif, extraerDigitos, sonMismoDocumento } from '@/lib/cedulaRif';
import { calcularEdadReal } from '@/lib/date';
import type { PacienteData } from '../ModuloHistorialPacientes';

interface ListaPacientesPanelProps {
  pacientesFiltrados: PacienteData[];
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  cargarMovimientosGlobales: () => Promise<void>;
  pacienteSeleccionado: PacienteData | null;
  cargarMovimientosPaciente: (paciente: PacienteData) => Promise<void>;
}

export const ListaPacientesPanel: React.FC<ListaPacientesPanelProps> = ({ pacientesFiltrados, searchTerm, setSearchTerm, cargarMovimientosGlobales, pacienteSeleccionado, cargarMovimientosPaciente }) => (
  <div className="lg:col-span-4 space-y-4">
    <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-clinica-primary" />
            Directorio de Pacientes
          </span>
          <Badge variant="outline" className="text-[10px] font-mono border-slate-300">
            {pacientesFiltrados.length} encontrados
          </Badge>
        </CardTitle>

        {/* Input de Búsqueda de Pacientes */}
        <div className="relative mt-2.5">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            type="text"
            placeholder="Buscar por Cédula o Nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 text-xs h-9 rounded-xl border-slate-200 bg-white focus-visible:ring-clinica-primary"
          />
        </div>
      </CardHeader>

      <CardContent className="p-2 space-y-1.5 max-h-[560px] overflow-y-auto">
        {/* OPCIÓN SUPERIOR: AUDITORÍA GENERAL / TODOS LOS PACIENTES */}
        <div
          onClick={cargarMovimientosGlobales}
          className={`p-3 rounded-2xl cursor-pointer transition-all border flex items-center justify-between gap-3 ${
            !pacienteSeleccionado
              ? 'bg-clinica-selection border-clinica-primary/40 shadow-sm'
              : 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/70'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
              !pacienteSeleccionado ? 'bg-clinica-primary text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
              <Globe className="w-4 h-4" />
            </div>
            <div className="truncate">
              <p className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                <span>Auditoría General</span>
                <span className="text-[10px] font-semibold text-clinica-primary">(Todos)</span>
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                Historial consolidado de toda la clínica
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className={`text-[9px] font-mono shrink-0 ${
              !pacienteSeleccionado ? 'bg-white text-clinica-primary border-clinica-primary/30 font-bold' : 'bg-slate-100 text-slate-500'
            }`}
          >
            Global
          </Badge>
        </div>

        {/* LISTA DE PACIENTES INDIVIDUALES */}
        {pacientesFiltrados.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No se encontraron pacientes con el criterio ingresado.
          </div>
        ) : (
          pacientesFiltrados.map((p) => {
            const isSelected = pacienteSeleccionado && sonMismoDocumento(pacienteSeleccionado.cedula, p.cedula);
            const cedulaCanonica = normalizarCedulaRif(p.cedula);

            return (
              <div
                key={extraerDigitos(p.cedula)}
                onClick={() => cargarMovimientosPaciente(p)}
                className={`p-3 rounded-2xl cursor-pointer transition-all border flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-clinica-selection border-clinica-primary/40 shadow-sm'
                    : 'bg-white hover:bg-slate-50 border-transparent hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    isSelected ? 'bg-clinica-primary text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {p.nombre ? p.nombre.charAt(0).toUpperCase() : 'P'}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {p.nombre || 'Sin Nombre'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-mono font-bold text-slate-600">
                        {cedulaCanonica}
                      </span>
                      {p.fecha_nacimiento && (
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1 rounded border border-teal-200">
                          {calcularEdadReal(p.fecha_nacimiento)} años
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-clinica-primary translate-x-0.5' : 'text-slate-300'}`} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  </div>
);
