'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Play, AlertTriangle, Lock, Check, Paperclip, UploadCloud, MessageCircle } from 'lucide-react';
import { calcularEdadReal } from '@/lib/date';
import { normalizarCedulaRif } from '@/lib/cedulaRif';
import type { PacienteTurno } from '../ModuloKanbanSalaEspera';
import type { FilaSala } from '@/lib/sala';
import { TarjetaAtencion, TarjetaEspera } from './TarjetaTurno';

interface TableroKanbanProps {
  turnosTodos: FilaSala[];
  turnosEspera: FilaSala[];
  turnosAtencion: FilaSala[];
  isReadOnly: boolean;
  isAdmin: boolean;
  llamandoId: number | null;
  onLlamar: (ids: number[], box?: string) => void;
  onFinalizar: (ids: number[]) => void;
  onAusente: (t: FilaSala) => void;
  onRellamar: (t: FilaSala) => void;
  onAnular: (t: FilaSala) => void;
  pacientesFinalizados: PacienteTurno[];
  handleTriggerAdjunto: (pacienteId: number) => void;
  handleEnviarWhatsAppIndividual: (p: PacienteTurno) => Promise<void>;
}

export const TableroKanban: React.FC<TableroKanbanProps> = ({ turnosTodos, turnosEspera, turnosAtencion, isReadOnly, isAdmin, llamandoId, onLlamar, onFinalizar, onAusente, onRellamar, onAnular, pacientesFinalizados, handleTriggerAdjunto, handleEnviarWhatsAppIndividual }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

    {/* 1. EN ESPERA (un turno por estudio) */}
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">1. En Espera</h3>
        </div>
        <Badge className="bg-amber-600 text-white text-xs font-mono">{turnosEspera.length}</Badge>
      </div>
      <div className="space-y-3 min-h-[420px]">
        {turnosEspera.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white text-slate-400 text-xs">No hay pacientes en espera</div>
        ) : (
          turnosEspera.map((t) => (
            <TarjetaEspera key={t.id} turno={t} todos={turnosTodos} isReadOnly={isReadOnly} ocupado={false} isAdmin={isAdmin} llamando={llamandoId === t.id} onLlamar={onLlamar} onAnular={onAnular} />
          ))
        )}
      </div>
    </div>

    {/* 2. EN ATENCIÓN */}
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-blue-900">2. En Atención</h3>
        </div>
        <Badge className="bg-blue-600 text-white text-xs font-mono">{turnosAtencion.length}</Badge>
      </div>
      <div className="space-y-3 min-h-[420px]">
        {turnosAtencion.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white text-slate-400 text-xs">No hay pacientes en curso</div>
        ) : (
          turnosAtencion.map((t) => (
            <TarjetaAtencion key={t.id} turno={t} todos={turnosTodos} isReadOnly={isReadOnly} ocupado={false} onFinalizar={onFinalizar} onAusente={onAusente} onRellamar={onRellamar} />
          ))
        )}
      </div>
    </div>

    {/* 3. FINALIZADOS / CULMINADOS */}
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900">3. Culminados (Resultados)</h3>
        </div>
        <Badge className="bg-emerald-600 text-white text-xs font-mono">{pacientesFinalizados.length}</Badge>
      </div>

      <div className="space-y-3 min-h-[420px]">
        {pacientesFinalizados.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white text-slate-400 text-xs">
            Aún no hay pacientes culminados hoy
          </div>
        ) : (
          pacientesFinalizados.slice(0, 20).map((p) => {
            const tieneAdjunto = Boolean(p.adjunto_nombre);
            const whatsappEnviado = Boolean(p.whatsapp_enviado);

            return (
              <Card key={p.id} className="rounded-2xl border border-slate-200 shadow-sm bg-white p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg">
                      {p.grupo_clinico}-{String(p.turno_num).padStart(2, '0')}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{p.nombre_paciente}</h4>
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                        <span className="font-mono font-bold text-slate-600">{normalizarCedulaRif(p.cedula_paciente) || 'S/C'}</span>
                        {p.telefono_paciente && (
                          <>
                            <span>•</span>
                            <span>{p.telefono_paciente}</span>
                          </>
                        )}
                        {(p.fecha_nacimiento_paciente || p.edad_paciente) && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-teal-700">
                              {p.fecha_nacimiento_paciente 
                                ? `${calcularEdadReal(p.fecha_nacimiento_paciente)} años` 
                                : `${p.edad_paciente} años`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Estado de WhatsApp */}
                  {whatsappEnviado ? (
                    <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" />
                      <span>Enviado</span>
                    </Badge>
                  ) : tieneAdjunto ? (
                    <Badge className="bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-200 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>Pendiente WA</span>
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-50 text-rose-700 text-[9px] font-bold border border-rose-200 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                      <span>Sin Adjunto</span>
                    </Badge>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 font-medium truncate">{p.estudio}</p>

                {/* Sección de Documento Adjunto (Informe/PDF/Imagen) */}
                <div className={'p-2 rounded-xl text-xs flex items-center justify-between gap-2 border transition-all ' + (
                  tieneAdjunto 
                    ? 'bg-emerald-50/40 border-emerald-200/70' 
                    : 'bg-amber-50/40 border-amber-200/70'
                )}>
                  <div className="flex items-center gap-1.5 truncate">
                    <Paperclip className={'w-3.5 h-3.5 shrink-0 ' + (tieneAdjunto ? 'text-emerald-600' : 'text-amber-500')} />
                    <span className={'text-[11px] truncate font-mono ' + (tieneAdjunto ? 'text-slate-800 font-medium' : 'text-amber-800 font-semibold')}>
                      {p.adjunto_nombre || '⚠️ Sin informe adjunto'}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTriggerAdjunto(p.id)}
                    className="h-6 px-2 text-[10px] font-bold text-clinica-primary hover:bg-clinica-selection rounded-lg shrink-0"
                    title="Subir o cambiar informe médico digital (PDF o imagen)"
                  >
                    <UploadCloud className="w-3 h-3 mr-1" />
                    <span>{p.adjunto_nombre ? 'Cambiar' : 'Adjuntar'}</span>
                  </Button>
                </div>

                {/* Botón de Envío Individual Urgente por WhatsApp: DESHABILITADO SI NO HAY ADJUNTO */}
                <div className="pt-1">
                  <Button
                    size="sm"
                    disabled={!tieneAdjunto}
                    onClick={() => handleEnviarWhatsAppIndividual(p)}
                    className={'w-full text-xs font-bold rounded-xl h-8 flex items-center justify-center gap-1.5 transition-all ' + (
                      !tieneAdjunto
                        ? 'bg-slate-100 text-slate-400 border border-slate-200/80 cursor-not-allowed hover:bg-slate-100 shadow-none'
                        : whatsappEnviado
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 active:scale-[0.98]'
                    )}
                    title={
                      !tieneAdjunto 
                        ? "Debe adjuntar las imágenes o el informe médico para habilitar el envío por WhatsApp" 
                        : whatsappEnviado 
                          ? "Re-enviar notificación y resultados por WhatsApp" 
                          : "Envío urgente e inmediato de resultados por WhatsApp"
                    }
                  >
                    {!tieneAdjunto ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Adjunte Imagen para Enviar WA</span>
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{whatsappEnviado ? 'Re-enviar WhatsApp' : 'Enviar WhatsApp Urgente'}</span>
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>

  </div>
);
