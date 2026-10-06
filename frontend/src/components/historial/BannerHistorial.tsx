'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Phone, MapPin, Calendar, MessageCircle } from 'lucide-react';
import { normalizarCedulaRif } from '@/lib/cedulaRif';
import { calcularEdadReal, formatearFechaNacimiento } from '@/lib/date';
import type { PacienteData } from '../ModuloHistorialPacientes';

interface BannerHistorialProps {
  pacienteSeleccionado: PacienteData;
  cargarMovimientosGlobales: () => Promise<void>;
}

export const BannerHistorial: React.FC<BannerHistorialProps> = ({ pacienteSeleccionado, cargarMovimientosGlobales }) => (
  <Card className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-13 h-13 bg-clinica-primary text-white rounded-2xl flex items-center justify-center font-black text-base shadow-md shadow-clinica-primary/20">
          {pacienteSeleccionado.nombre ? pacienteSeleccionado.nombre.charAt(0).toUpperCase() : 'P'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900">
              {pacienteSeleccionado.nombre}
            </h3>
            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
              Paciente Seleccionado
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
              CI: {normalizarCedulaRif(pacienteSeleccionado.cedula)}
            </span>
            {(pacienteSeleccionado.fecha_nacimiento || pacienteSeleccionado.edad) && (
              <span className="flex items-center gap-1.5 font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                {pacienteSeleccionado.fecha_nacimiento
                  ? `${calcularEdadReal(pacienteSeleccionado.fecha_nacimiento)} años (${formatearFechaNacimiento(pacienteSeleccionado.fecha_nacimiento)})`
                  : `${pacienteSeleccionado.edad} años`}
              </span>
            )}
            {pacienteSeleccionado.telefono && (
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                {pacienteSeleccionado.telefono}
              </span>
            )}
            {pacienteSeleccionado.direccion && (
              <span className="flex items-center gap-1 truncate max-w-xs">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{pacienteSeleccionado.direccion}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
        {pacienteSeleccionado.telefono && (
          <Button
            size="sm"
            onClick={() => {
              const tel = pacienteSeleccionado.telefono?.replace(/\D/g, '') || '';
              const telInt = tel.startsWith('0') ? '58' + tel.slice(1) : tel;
              window.open(`https://api.whatsapp.com/send?phone=${telInt}`, '_blank');
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Contactar WhatsApp</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={cargarMovimientosGlobales}
          className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center gap-1"
          title="Regresar a la auditoría general de todos los pacientes"
        >
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <span>Ver Todos</span>
        </Button>
      </div>
    </div>
  </Card>
);
