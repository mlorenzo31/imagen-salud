'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tv, ExternalLink, RefreshCw, Send } from 'lucide-react';
import { ReembolsoPendiente } from '@/types';
import type { PacienteTurno } from '../ModuloKanbanSalaEspera';

interface EncabezadoSalaEsperaProps {
  setModalMasivoWhatsApp: React.Dispatch<React.SetStateAction<boolean>>;
  pacientesPendientesWhatsApp: PacienteTurno[];
  setTabActiva: React.Dispatch<React.SetStateAction<"turnos" | "reembolsos">>;
  tabActiva: "turnos" | "reembolsos";
  reembolsos: ReembolsoPendiente[];
  cargarPacientes: () => Promise<void>;
  loading: boolean;
}

export const EncabezadoSalaEspera: React.FC<EncabezadoSalaEsperaProps> = ({ setModalMasivoWhatsApp, pacientesPendientesWhatsApp, setTabActiva, tabActiva, reembolsos, cargarPacientes, loading }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
    <div>
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-clinica-selection rounded-xl text-clinica-primary">
          <Tv className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">Sala de Espera y Turnero Clínico</h2>
            <Badge className="bg-clinica-primary text-white text-[10px] font-mono">
              Full HD / 4K
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Segmentación por grupos clínicos (A, B, C), multi-estudio priorizado y despacho de WhatsApp individual y masivo
          </p>
        </div>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      {/* Botón de Envío Masivo de WhatsApp para Cierre Diario */}
      <Button
        size="sm"
        onClick={() => setModalMasivoWhatsApp(true)}
        className={'rounded-xl text-xs font-bold flex items-center gap-1.5 h-9 ' + (
          pacientesPendientesWhatsApp.length > 0 
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 animate-pulse'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
        )}
        title="Despacho masivo secuencial de todos los resultados culminados del día"
      >
        <Send className="w-3.5 h-3.5" />
        <span>Despacho Masivo WhatsApp</span>
        <Badge className={'ml-1 text-[10px] font-mono ' + (
          pacientesPendientesWhatsApp.length > 0 ? 'bg-white text-emerald-800' : 'bg-slate-200 text-slate-600'
        )}>
          {pacientesPendientesWhatsApp.length} pendientes
        </Badge>
      </Button>

      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
        <button
          onClick={() => setTabActiva('turnos')}
          className={'px-3 py-1.5 rounded-lg transition-all ' + (
            tabActiva === 'turnos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          )}
        >
          Control de Turnos
        </button>
        <button
          onClick={() => setTabActiva('reembolsos')}
          className={'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ' + (
            tabActiva === 'reembolsos' ? 'bg-white text-clinica-coral shadow-sm' : 'text-slate-500 hover:text-slate-900'
          )}
        >
          <span>Reversiones en Espera</span>
          {reembolsos.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-clinica-coral text-white text-[10px] inline-flex items-center justify-center font-bold">
              {reembolsos.length}
            </span>
          )}
        </button>
      </div>

      <Button 
        variant="outline" 
        size="sm" 
        onClick={cargarPacientes} 
        disabled={loading}
        className="rounded-xl text-xs flex items-center gap-1.5 h-9"
      >
        <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
        <span>Actualizar</span>
      </Button>

      <Button 
        size="sm"
        onClick={() => window.open('/tv', '_blank')}
        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs flex items-center gap-1.5 h-9 shadow-sm"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        <span>Abrir Pantalla TV</span>
      </Button>
    </div>
  </div>
);
