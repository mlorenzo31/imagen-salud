'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit3, Phone, Power } from 'lucide-react';
import { calcularEdadReal } from '@/lib/date';
import { PacienteCatalogo } from '@/types';

interface TabPacientesProps {
  busqueda: string;
  setBusqueda: React.Dispatch<React.SetStateAction<string>>;
  isReadOnly: boolean;
  handleAbrirEditarPaciente: (p?: PacienteCatalogo) => void;
  pacientes: PacienteCatalogo[];
  handleToggleEstadoPaciente: (id: number | string) => void;
}

export const TabPacientes: React.FC<TabPacientesProps> = ({ busqueda, setBusqueda, isReadOnly, handleAbrirEditarPaciente, pacientes, handleToggleEstadoPaciente }) => (
  <div className="space-y-4">
    {/* Barra de Filtros y Botón Crear */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80">
      <div className="relative flex-1 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
        <Input
          placeholder="Buscar por cédula o nombre..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
        />
      </div>
      {!isReadOnly && (
        <Button
          onClick={() => handleAbrirEditarPaciente()}
          className="h-9 px-4 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Paciente</span>
        </Button>
      )}
    </div>

    {/* Grid de Tarjetas Interactivas de Pacientes */}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {pacientes
        .filter(p => p.nombres.toLowerCase().includes(busqueda.toLowerCase()) || p.cedula.toLowerCase().includes(busqueda.toLowerCase()))
        .map(p => (
          <Card
            key={p.id}
            className={`border bg-white rounded-2xl transition-all shadow-xs hover:shadow-md ${
              p.activo ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/70 opacity-75'
            }`}
          >
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-start justify-between pb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EBF9F7] text-[#1D7A70] flex items-center justify-center font-black text-sm shrink-0 border border-[#80DDD2]/50">
                  {p.nombres.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 leading-snug">{p.nombres}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-bold text-[#1D7A70]">{p.cedula}</span>
                    <Badge variant="outline" className="text-[10px] font-bold py-0.5 px-2 bg-teal-50 text-teal-800 border-teal-200">
                      {p.fecha_nacimiento ? `${calcularEdadReal(p.fecha_nacimiento)} años` : (p.edad ? `${p.edad} años` : 'Edad N/R')}
                    </Badge>
                  </div>
                </div>
              </div>
              <Badge className={p.activo ? 'bg-emerald-100 text-emerald-800 text-[10px]' : 'bg-slate-200 text-slate-600 text-[10px]'}>
                {p.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{p.telefono || 'Sin teléfono registrado'}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-500 text-[11px]">Historial de Atenciones:</span>
                  <span className="font-bold text-slate-800">{p.historial_visitas} visitas</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Saldo Pendiente:</span>
                  <span className={`font-mono font-black ${p.saldo_pendiente_usd > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    ${p.saldo_pendiente_usd.toFixed(2)}
                  </span>
                </div>
              </div>

              {!isReadOnly && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAbrirEditarPaciente(p)}
                    className="flex-1 h-8 rounded-xl text-xs font-semibold border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Editar Datos</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleEstadoPaciente(p.id)}
                    className={`h-8 px-2.5 rounded-xl text-xs font-semibold border-slate-200 ${
                      p.activo ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                    title={p.activo ? 'Inactivar Paciente' : 'Activar Paciente'}
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
