'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Volume2, CheckCircle2, Clock, Play, AlertTriangle, XCircle, Lock, Check, Paperclip, UploadCloud, ListOrdered, MessageCircle } from 'lucide-react';
import { calcularEdadReal } from '@/lib/date';
import { normalizarCedulaRif } from '@/lib/cedulaRif';
import type { PacienteTurno } from '../ModuloKanbanSalaEspera';

interface TableroKanbanProps {
  pacientesEspera: PacienteTurno[];
  verificarConflictoConcurrencia: (p: PacienteTurno) => PacienteTurno | undefined;
  obtenerHermanosMismoGrupo: (p: PacienteTurno) => PacienteTurno[];
  extraerSubEstudios: (p: PacienteTurno) => Array<{ id: string; nombre: string; area?: string; medico?: string; }>;
  handleAbrirPrioridadEstudio: (p: PacienteTurno) => void;
  isReadOnly: boolean;
  llamandoId: number | null;
  handleLlamarPaciente: (p: PacienteTurno, forzarUnificado?: boolean) => Promise<void>;
  isAdmin: boolean;
  setPacienteAAnular: React.Dispatch<React.SetStateAction<PacienteTurno | null>>;
  pacientesAtencion: PacienteTurno[];
  handleFinalizarAtencion: (p: PacienteTurno, finalizarTodosMismoGrupo?: boolean) => Promise<void>;
  pacientesFinalizados: PacienteTurno[];
  handleTriggerAdjunto: (pacienteId: number) => void;
  handleEnviarWhatsAppIndividual: (p: PacienteTurno) => Promise<void>;
}

export const TableroKanban: React.FC<TableroKanbanProps> = ({ pacientesEspera, verificarConflictoConcurrencia, obtenerHermanosMismoGrupo, extraerSubEstudios, handleAbrirPrioridadEstudio, isReadOnly, llamandoId, handleLlamarPaciente, isAdmin, setPacienteAAnular, pacientesAtencion, handleFinalizarAtencion, pacientesFinalizados, handleTriggerAdjunto, handleEnviarWhatsAppIndividual }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

    {/* 1. EN ESPERA */}
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">1. En Espera</h3>
        </div>
        <Badge className="bg-amber-600 text-white text-xs font-mono">{pacientesEspera.length}</Badge>
      </div>

      <div className="space-y-3 min-h-[420px]">
        {pacientesEspera.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white text-slate-400 text-xs">
            No hay pacientes en espera
          </div>
        ) : (
          pacientesEspera.map((p) => {
            const conflicto = verificarConflictoConcurrencia(p);
            const hermanosMismoGrupo = obtenerHermanosMismoGrupo(p);
            const tieneVariosMismoGrupo = hermanosMismoGrupo.length > 1;
            const subEstudios = extraerSubEstudios(p);
            const tieneMultiEstudio = subEstudios.length > 1;

            return (
              <Card 
                key={p.id} 
                className={'rounded-2xl border transition-all shadow-sm bg-white p-4 space-y-3 ' + (
                  conflicto 
                    ? 'border-rose-300 bg-rose-50/30 opacity-75' 
                    : p.retorno_sala 
                      ? 'border-clinica-coral/60 bg-clinica-coral-soft/50 ring-2 ring-clinica-coral/20' 
                      : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={'font-mono text-xs font-black px-2.5 py-1 rounded-xl text-white ' + (
                      p.retorno_sala ? 'bg-clinica-coral animate-pulse' : 'bg-slate-900'
                    )}>
                      {p.grupo_clinico}-{String(p.turno_num).padStart(2, '0')}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-snug">{p.nombre_paciente}</h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                        <span className="font-mono text-slate-700 font-bold">{normalizarCedulaRif(p.cedula_paciente) || 'S/C'}</span>
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
                  
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={'text-[10px] font-bold ' + (
                      p.grupo_clinico === 'A' ? 'bg-clinica-selection text-clinica-dark border border-clinica-aquamarine/40' :
                      p.grupo_clinico === 'B' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    )}>
                      Grupo {p.grupo_clinico}
                    </Badge>
                    {p.retorno_sala && (
                      <Badge className="bg-clinica-coral text-white text-[9px] font-bold">
                        Retorno Prioritario
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Detalle del estudio y box */}
                <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-800 font-semibold">{p.estudio}</p>
                    {tieneMultiEstudio && (
                      <button
                        onClick={() => handleAbrirPrioridadEstudio(p)}
                        className="text-[10px] font-bold text-clinica-primary hover:underline flex items-center gap-1"
                        title="Definir estudio principal y orden de llamado"
                      >
                        <ListOrdered className="w-3 h-3" />
                        <span>Multi-Estudio ({subEstudios.length})</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{p.box_asignado}</span>
                    <span>{p.medico || 'De Guardia'}</span>
                  </div>
                </div>

                {/* Alerta de Concurrencia si está en otro consultorio */}
                {conflicto && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>En atención en {conflicto.box_asignado} (Grupo {conflicto.grupo_clinico})</span>
                  </div>
                )}

                {/* Botones de Acción */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={isReadOnly || Boolean(conflicto) || llamandoId === p.id}
                    onClick={() => handleLlamarPaciente(p, tieneVariosMismoGrupo)}
                    className={'flex-1 text-white text-xs font-bold rounded-xl h-8 flex items-center justify-center gap-1.5 shadow-sm ' + (
                      conflicto
                        ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                        : p.retorno_sala 
                          ? 'bg-clinica-coral hover:bg-clinica-coral'
                          : 'bg-clinica-primary hover:bg-clinica-primary-dark'
                    )}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>
                      {llamandoId === p.id 
                        ? 'Llamando...' 
                        : tieneVariosMismoGrupo 
                          ? 'Llamado Unificado' 
                          : 'Llamar a Box'}
                    </span>
                  </Button>

                  {/* Anulación en Sala de Espera (Solo Administrador) */}
                  {isAdmin && !isReadOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPacienteAAnular(p)}
                      className="text-slate-400 hover:text-clinica-coral hover:bg-clinica-coral-soft rounded-xl h-8 px-2"
                      title="Anular atención en sala y enviar fondos a reversión"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
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
        <Badge className="bg-blue-600 text-white text-xs font-mono">{pacientesAtencion.length}</Badge>
      </div>

      <div className="space-y-3 min-h-[420px]">
        {pacientesAtencion.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white text-slate-400 text-xs">
            No hay pacientes en curso
          </div>
        ) : (
          pacientesAtencion.map((p) => {
            const hermanosMismoGrupo = obtenerHermanosMismoGrupo(p);
            const tieneVariosMismoGrupo = hermanosMismoGrupo.length > 1;

            return (
              <Card key={p.id} className="rounded-2xl border-2 border-blue-400/40 shadow-md bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black px-2.5 py-1 bg-blue-600 text-white rounded-xl animate-pulse">
                      {p.grupo_clinico}-{String(p.turno_num).padStart(2, '0')}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-snug">{p.nombre_paciente}</h4>
                      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                        <span className="font-mono font-bold text-slate-700">{normalizarCedulaRif(p.cedula_paciente) || 'S/C'}</span>
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
                  <Badge className="bg-blue-100 text-blue-800 text-[10px] font-bold">
                    Grupo {p.grupo_clinico}
                  </Badge>
                </div>

                <div className="p-2.5 bg-blue-50/50 rounded-xl space-y-1 text-xs">
                  <p className="text-slate-800 font-semibold">{p.estudio}</p>
                  <p className="text-slate-500 text-[11px]">{p.box_asignado}</p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={isReadOnly}
                    onClick={() => handleFinalizarAtencion(p, tieneVariosMismoGrupo)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-8 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Culminar Estudio</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isReadOnly}
                    onClick={() => handleLlamarPaciente(p, false)}
                    className="text-slate-600 text-xs rounded-xl h-8 px-2.5 font-bold"
                    title="Re-llamar por altavoz"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })
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
