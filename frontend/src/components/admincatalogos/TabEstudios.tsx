'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit3, Power } from 'lucide-react';
import { GRUPOS_CLINICOS } from '@/lib/gruposClinicos';
import { ServicioCatalogo } from '@/types';

interface TabEstudiosProps {
  busqueda: string;
  setBusqueda: React.Dispatch<React.SetStateAction<string>>;
  isReadOnly: boolean;
  handleAbrirEditarServicio: (s?: ServicioCatalogo) => void;
  servicios: ServicioCatalogo[];
  handleToggleEstadoServicio: (id: number | string) => void;
}

export const TabEstudios: React.FC<TabEstudiosProps> = ({ busqueda, setBusqueda, isReadOnly, handleAbrirEditarServicio, servicios, handleToggleEstadoServicio }) => (
  <div className="space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80">
      <div className="relative flex-1 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
        <Input
          placeholder="Buscar por estudio o código..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
        />
      </div>
      {!isReadOnly && (
        <Button
          onClick={() => handleAbrirEditarServicio()}
          className="h-9 px-4 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Estudio / Tarifa</span>
        </Button>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {servicios
        .filter(s => s.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (s.codigo && s.codigo.toLowerCase().includes(busqueda.toLowerCase())))
        .map(s => {
          const infoGrupo = GRUPOS_CLINICOS[s.grupo_clinico];
          return (
            <Card
              key={s.id}
              className={`border bg-white rounded-2xl transition-all shadow-xs hover:shadow-md ${
                s.activo ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/70 opacity-75'
              }`}
            >
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-start justify-between pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      style={{
                        backgroundColor: infoGrupo.colorFondoSuave,
                        color: infoGrupo.colorTexto,
                        borderColor: infoGrupo.colorBorde
                      }}
                      className="border text-[9px] font-black uppercase tracking-wider"
                    >
                      Grupo {s.grupo_clinico}: {infoGrupo.nombreCorto}
                    </Badge>
                    {s.codigo && (
                      <span className="font-mono text-[10px] text-slate-500 font-bold">
                        #{s.codigo}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-black text-slate-900 leading-snug">{s.nombre}</h4>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-base font-mono font-black text-[#1D7A70]">
                    ${s.precio_usd.toFixed(2)}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {/* Desglose de Regla de Reparto */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
                    Regla de Reparto Financiero:
                  </span>
                  <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                    <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                      <span className="text-emerald-700 block font-bold">Clínica</span>
                      <span className="font-black text-emerald-900">{s.reparto_clinica_pct}%</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-cyan-50 border border-cyan-200">
                      <span className="text-cyan-700 block font-bold">Médico</span>
                      <span className="font-black text-cyan-900">{s.reparto_medico_pct}%</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200">
                      <span className="text-indigo-700 block font-bold">Ecógrafo</span>
                      <span className="font-black text-indigo-900">{s.reparto_eco_pct}%</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-200">
                      <span className="text-purple-700 block font-bold">Patólogo</span>
                      <span className="font-black text-purple-900">{s.reparto_patologo_pct}%</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                  <span>Sala asignada:</span>
                  <span className="font-semibold text-slate-700">{s.sala_defecto || 'Box General'}</span>
                </div>

                {!isReadOnly && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAbrirEditarServicio(s)}
                      className="flex-1 h-8 rounded-xl text-xs font-semibold border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Editar Tarifa</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleEstadoServicio(s.id)}
                      className={`h-8 px-2.5 rounded-xl text-xs font-semibold border-slate-200 ${
                        s.activo ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      title={s.activo ? 'Desactivar Estudio (sin alterar históricos)' : 'Reactivar Estudio'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
    </div>
  </div>
);
