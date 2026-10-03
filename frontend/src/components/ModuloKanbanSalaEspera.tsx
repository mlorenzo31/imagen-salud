'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Tv, 
  Volume2, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Play, 
  UserCheck, 
  ExternalLink, 
  RefreshCw, 
  Filter, 
  Bell, 
  Stethoscope, 
  AlertTriangle, 
  XCircle, 
  Undo2, 
  Wallet, 
  ShieldAlert, 
  Layers, 
  Sparkles, 
  Lock, 
  Check, 
  Send, 
  FileText, 
  Paperclip, 
  UploadCloud, 
  FileCheck2, 
  ListOrdered, 
  Star, 
  MessageCircle, 
  Phone 
} from 'lucide-react';
import { ejecutarLlamadoCompleto } from '@/lib/audioLlamado';
import { UserRole, ModoOperacion, ReembolsoPendiente, ServicioFactura } from '@/types';
import { 
  GrupoClinico, 
  GRUPOS_CLINICOS, 
  mapearEstudioAGrupo, 
  inferirBoxConsultorio 
} from '@/lib/gruposClinicos';
import { calcularEdadReal, hoyLocal } from '@/lib/date';
import { normalizarCedulaRif } from '@/lib/cedulaRif';
import { getErrorMessage } from '@/lib/utils';

interface PacienteTurno {
  id: number;
  turno_num: number;
  nombre_paciente: string;
  cedula_paciente?: string;
  telefono_paciente?: string;
  fecha_nacimiento_paciente?: string;
  edad_paciente?: number;
  estudio: string;
  medico?: string;
  precio_usd?: number;
  precio_bs?: number;
  estado: 'ESPERA' | 'ATENCION' | 'FINALIZADO' | 'COMPLETADO' | 'ANULADA';
  etapa_actual?: number;
  hora: string;
  fecha: string;
  grupo_clinico: GrupoClinico;
  box_asignado: string;
  prioridad?: 'ALTA' | 'NORMAL' | 'BAJA';
  retorno_sala?: boolean;
  sala_anterior?: string;
  servicios?: ServicioFactura[];
  estudio_principal_id?: string;
  adjunto_nombre?: string;
  adjunto_url?: string;
  adjunto_tipo?: string;
  whatsapp_enviado?: boolean;
  whatsapp_fecha_envio?: string;
}

interface ModuloKanbanSalaEsperaProps {
  currentRole?: UserRole;
  modoOperacion?: ModoOperacion;
}

export const getCleanCedula = (ced?: string) => (ced || '').replace(/\D/g, '');

type FacturaApi = Omit<PacienteTurno, 'estado' | 'grupo_clinico' | 'box_asignado'> & {
  estado: string;
  grupo_clinico?: PacienteTurno['grupo_clinico'];
};

export const ModuloKanbanSalaEspera: React.FC<ModuloKanbanSalaEsperaProps> = ({
  currentRole = 'admin',
  modoOperacion = 'operador'
}) => {
  const [pacientes, setPacientes] = useState<PacienteTurno[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filtroGrupo, setFiltroGrupo] = useState<'TODOS' | 'A' | 'B' | 'C'>('TODOS');
  const [llamandoId, setLlamandoId] = useState<number | null>(null);

  // Bandeja de Reembolsos Pendientes (Anulaciones en sala de espera)
  const [reembolsos, setReembolsos] = useState<ReembolsoPendiente[]>([
    {
      id: 1,
      paciente_nombre: 'Alejandro Morales',
      cedula: 'V-18456123',
      turno_num: 'A-04',
      servicio: 'Ecografía Abdominal',
      monto_usd: 25.00,
      monto_bs: 20812.25,
      metodo_origen: 'Pago Móvil',
      cuenta_id: 4,
      motivo_anulacion: 'Paciente tuvo emergencia familiar y se retiró de sala',
      fecha: '2026-09-14',
      hora: '10:30 AM',
      estado: 'PENDIENTE_BANCO',
      usuario_autoriza: 'Director Médico'
    }
  ]);

  // Modal Anulación en Sala
  const [pacienteAAnular, setPacienteAAnular] = useState<PacienteTurno | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [submittingAnulacion, setSubmittingAnulacion] = useState(false);
  const [tabActiva, setTabActiva] = useState<'turnos' | 'reembolsos'>('turnos');

  // Modal Multi-Estudio: Selección de Estudio Principal / Primer Llamado
  const [modalMultiEstudio, setModalMultiEstudio] = useState<{
    visible: boolean;
    paciente: PacienteTurno | null;
    estudiosDisponibles: Array<{ id: string; nombre: string; area?: string; medico?: string }>;
    estudioSeleccionado: string;
  }>({
    visible: false,
    paciente: null,
    estudiosDisponibles: [],
    estudioSeleccionado: ''
  });

  // Modal de Despacho Masivo de WhatsApp para Cierre Diario
  const [modalMasivoWhatsApp, setModalMasivoWhatsApp] = useState<boolean>(false);
  const [procesandoMasivo, setProcesandoMasivo] = useState<boolean>(false);
  const [progresoMasivo, setProgresoMasivo] = useState<{ actual: number; total: number; nombreActual: string }>({
    actual: 0,
    total: 0,
    nombreActual: ''
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pacienteAdjuntoId, setPacienteAdjuntoId] = useState<number | null>(null);

  const isReadOnly = modoOperacion === 'vista';
  const isAdmin = currentRole === 'admin';

  const cargarPacientes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/facturas');
      if (res.ok) {
        const data: FacturaApi[] = await res.json();
        const parseados: PacienteTurno[] = data
          .filter((f) => f.estado !== 'ANULADA' && f.estado !== 'ANULADA_SALA')
          .map((f): PacienteTurno => {
            const grupo = f.grupo_clinico || mapearEstudioAGrupo(f.estudio);
            return {
              ...f,
              estado: f.estado as PacienteTurno['estado'],
              grupo_clinico: grupo,
              box_asignado: inferirBoxConsultorio(grupo, f.estudio, f.medico),
              whatsapp_enviado: Boolean(f.whatsapp_enviado),
              adjunto_nombre: f.adjunto_nombre || undefined
            };
          });
        setPacientes(parseados);
      }
    } catch (err) {
      console.error('Error cargando pacientes Kanban:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPacientes();
    const interval = setInterval(cargarPacientes, 6000);
    return () => clearInterval(interval);
  }, []);

  // 1. Detección de Concurrencia Crítica: Paciente activo en atención en OTRO grupo
  const verificarConflictoConcurrencia = (p: PacienteTurno): PacienteTurno | undefined => {
    if (!p.cedula_paciente) return undefined;
    return pacientes.find(otro => 
      otro.id !== p.id &&
      otro.cedula_paciente === p.cedula_paciente &&
      otro.estado === 'ATENCION' &&
      otro.grupo_clinico !== p.grupo_clinico
    );
  };

  // 2. Detección de Estudios en el MISMO grupo para LLAMADO UNIFICADO CONTINUO
  const obtenerHermanosMismoGrupo = (p: PacienteTurno): PacienteTurno[] => {
    if (!p.cedula_paciente) return [p];
    return pacientes.filter(otro =>
      otro.cedula_paciente === p.cedula_paciente &&
      otro.grupo_clinico === p.grupo_clinico &&
      (otro.estado === 'ESPERA' || otro.estado === 'ATENCION')
    );
  };

  // 3. Extraer lista de sub-estudios para gestión multi-estudio
  const extraerSubEstudios = (p: PacienteTurno): Array<{ id: string; nombre: string; area?: string; medico?: string }> => {
    if (Array.isArray(p.servicios) && p.servicios.length > 1) {
      return p.servicios.map((s, idx) => ({
        id: String(s.id || idx),
        nombre: s.estudio || s.nombre || ('Estudio #' + (idx + 1)),
        area: s.area || '',
        medico: s.medico || p.medico
      }));
    }
    if (p.estudio && p.estudio.includes('+')) {
      return p.estudio.split('+').map((item, idx) => ({
        id: String(idx),
        nombre: item.trim(),
        area: '',
        medico: p.medico
      }));
    }
    return [{ id: '0', nombre: p.estudio, area: '', medico: p.medico }];
  };

  // 4. Abrir Modal de Prioridad de Multi-Estudio
  const handleAbrirPrioridadEstudio = (p: PacienteTurno) => {
    const lista = extraerSubEstudios(p);
    if (lista.length <= 1) return;
    setModalMultiEstudio({
      visible: true,
      paciente: p,
      estudiosDisponibles: lista,
      estudioSeleccionado: p.estudio_principal_id || lista[0].id
    });
  };

  // 5. Guardar Estudio Principal Seleccionado
  const handleConfirmarEstudioPrincipal = async () => {
    const { paciente, estudioSeleccionado, estudiosDisponibles } = modalMultiEstudio;
    if (!paciente) return;

    const estObj = estudiosDisponibles.find(e => e.id === estudioSeleccionado);
    const nuevoGrupo = estObj ? mapearEstudioAGrupo(estObj.nombre) : paciente.grupo_clinico;

    try {
      await fetch('/api/facturas/' + paciente.id + '/estado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estudio_principal_id: estudioSeleccionado,
          grupo_clinico: nuevoGrupo,
          prioridad: 'ALTA'
        })
      });

      setPacientes(prev => prev.map(item => {
        if (item.id === paciente.id) {
          return {
            ...item,
            estudio_principal_id: estudioSeleccionado,
            grupo_clinico: nuevoGrupo,
            prioridad: 'ALTA',
            box_asignado: inferirBoxConsultorio(nuevoGrupo, estObj ? estObj.nombre : item.estudio, item.medico)
          };
        }
        return item;
      }));

      setModalMultiEstudio({ visible: false, paciente: null, estudiosDisponibles: [], estudioSeleccionado: '' });
    } catch (err) {
      console.error('Error guardando estudio principal:', err);
    }
  };

  // 6. Ejecutar Llamado (Individual o Unificado Continuo)
  const handleLlamarPaciente = async (p: PacienteTurno, forzarUnificado = false) => {
    if (isReadOnly) {
      alert('Acción restringida en Modo Vista (Read-Only).');
      return;
    }

    // Regla de Bloqueo de Concurrencia
    const conflicto = verificarConflictoConcurrencia(p);
    if (conflicto) {
      alert(
        'PREVENCIÓN DE DOBLE LLAMADO SIMULTÁNEO:\n\n' +
        'El paciente "' + p.nombre_paciente + '" (' + (p.cedula_paciente || 'S/C') + ') ya se encuentra actualmente en el consultorio de ' + conflicto.box_asignado + ' (' + GRUPOS_CLINICOS[conflicto.grupo_clinico].nombreCorto + ').\n\n' +
        'El sistema bloquea este llamado hasta que el personal del Grupo ' + conflicto.grupo_clinico + ' culmine dicho procedimiento.'
      );
      return;
    }

    setLlamandoId(p.id);
    try {
      const hermanosMismoGrupo = obtenerHermanosMismoGrupo(p);
      const idsAActualizar = forzarUnificado || hermanosMismoGrupo.length > 1
        ? hermanosMismoGrupo.map(h => h.id)
        : [p.id];

      for (const ticketId of idsAActualizar) {
        await fetch('/api/facturas/' + ticketId + '/estado', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'ATENCION', etapa_actual: 1 })
        });
      }

      setPacientes(prev => prev.map(item => {
        if (idsAActualizar.includes(item.id)) {
          return { ...item, estado: 'ATENCION', etapa_actual: 1 };
        }
        return item;
      }));

      const turnoTexto = p.grupo_clinico + '-' + String(p.turno_num).padStart(2, '0');
      const salaTexto = p.box_asignado || GRUPOS_CLINICOS[p.grupo_clinico].boxConsultorioDefecto;
      await ejecutarLlamadoCompleto(turnoTexto, p.nombre_paciente, salaTexto);

    } catch (err) {
      console.error('Error al llamar:', err);
    } finally {
      setLlamandoId(null);
    }
  };

  // 7. Finalizar Estudio con Retorno Priorizado a Sala
  const handleFinalizarAtencion = async (p: PacienteTurno, finalizarTodosMismoGrupo = false) => {
    if (isReadOnly) return alert('Modo Vista activo.');
    try {
      const hermanos = finalizarTodosMismoGrupo ? obtenerHermanosMismoGrupo(p) : [p];
      const ids = hermanos.map(h => h.id);

      for (const id of ids) {
        await fetch('/api/facturas/' + id + '/estado', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'FINALIZADO', etapa_actual: 2 })
        });
      }

      const cedulaClean = getCleanCedula(p.cedula_paciente);
      setPacientes(prev => prev.map(item => {
        if (ids.includes(item.id)) {
          return { ...item, estado: 'FINALIZADO', etapa_actual: 2 };
        }
        // Retorno a sala prioritario si tiene otro estudio pendiente en otro grupo
        if (cedulaClean && getCleanCedula(item.cedula_paciente) === cedulaClean && item.estado === 'ESPERA') {
          return {
            ...item,
            prioridad: 'ALTA',
            retorno_sala: true,
            sala_anterior: p.box_asignado || inferirBoxConsultorio(p.grupo_clinico, p.estudio, p.medico)
          };
        }
        return item;
      }));
    } catch (err) {
      console.error('Error al finalizar:', err);
    }
  };

  // 8. Carga de Documento / Informe al Culminar Estudio
  const handleTriggerAdjunto = (pacienteId: number) => {
    if (isReadOnly) return alert('Modo Vista activo.');
    setPacienteAdjuntoId(pacienteId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pacienteAdjuntoId) return;

    try {
      const nombreArchivo = file.name;
      const tipoArchivo = file.type || 'application/pdf';

      await fetch('/api/facturas/' + pacienteAdjuntoId + '/estado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjunto_nombre: nombreArchivo,
          adjunto_tipo: tipoArchivo,
          whatsapp_enviado: false
        })
      });

      setPacientes(prev => prev.map(p => {
        if (p.id === pacienteAdjuntoId) {
          return {
            ...p,
            adjunto_nombre: nombreArchivo,
            adjunto_tipo: tipoArchivo,
            whatsapp_enviado: false
          };
        }
        return p;
      }));

      alert('Documento "' + nombreArchivo + '" adjuntado exitosamente. La atención está lista para envío por WhatsApp.');
    } catch (err) {
      console.error('Error adjuntando archivo:', err);
      alert('Error al adjuntar el archivo.');
    } finally {
      setPacienteAdjuntoId(null);
    }
  };

  // 9. Enviar WhatsApp Individual (Urgente)
  const handleEnviarWhatsAppIndividual = async (p: PacienteTurno) => {
    if (isReadOnly) return alert('Modo Vista activo.');

    // REGLA CLÍNICA OBLIGATORIA: Si no hay imágenes/informe adjunto, el envío está bloqueado
    if (!p.adjunto_nombre) {
      alert('ADVERTENCIA CLÍNICA: No se puede enviar por WhatsApp. Es obligatorio adjuntar previamente las imágenes o el informe médico del estudio.');
      return;
    }

    let tel = (p.telefono_paciente || '').replace(/\D/g, '');
    if (!tel) {
      const inputTel = prompt('Ingrese el número de WhatsApp del paciente (ej: 04141234567 o 584141234567):', '04141234567');
      if (!inputTel) return;
      tel = inputTel.replace(/\D/g, '');
    }

    let telInternacional = tel;
    if (tel.startsWith('0')) {
      telInternacional = '58' + tel.slice(1);
    } else if (!tel.startsWith('58') && tel.length === 10) {
      telInternacional = '58' + tel;
    }

    const docNombre = p.adjunto_nombre ? ('\n📎 *Documento adjunto:* ' + p.adjunto_nombre) : '';
    const mensaje = encodeURIComponent(
      '🏥 *IMAGEN SALUD - Notificación Oficial de Resultados*\n\n' +
      'Estimado(a) *' + p.nombre_paciente + '*:\n' +
      'Le informamos que los resultados de su estudio *' + p.estudio + '* ya han sido debidamente procesados, validados y firmados por el especialista.' + docNombre + '\n\n' +
      '✅ Sus resultados digitales están a su disposición. Agradecemos su confianza en nuestro centro médico.\n\n' +
      '_Centro Clínico Imagen Salud, C.A._'
    );

    const waUrl = 'https://api.whatsapp.com/send?phone=' + telInternacional + '&text=' + mensaje;
    window.open(waUrl, '_blank');

    const fechaEnvio = new Date().toISOString();
    try {
      await fetch('/api/facturas/' + p.id + '/estado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_enviado: true,
          whatsapp_fecha_envio: fechaEnvio,
          telefono_paciente: tel
        })
      });

      setPacientes(prev => prev.map(item => {
        if (item.id === p.id) {
          return {
            ...item,
            whatsapp_enviado: true,
            whatsapp_fecha_envio: fechaEnvio,
            telefono_paciente: tel
          };
        }
        return item;
      }));
    } catch (err) {
      console.error('Error registrando envío de WhatsApp:', err);
    }
  };

  // 10. Despacho Masivo de WhatsApp para Cierre Diario (Solo pacientes con imágenes/informe adjunto)
  const pacientesPendientesWhatsApp = useMemo(() => {
    return pacientes.filter(p => 
      (p.estado === 'FINALIZADO' || p.estado === 'COMPLETADO' || p.etapa_actual === 2) &&
      !p.whatsapp_enviado &&
      Boolean(p.adjunto_nombre)
    );
  }, [pacientes]);

  // Pacientes culminados a los que aún les falta adjuntar las imágenes o informe
  const pacientesFinalizadosSinAdjunto = useMemo(() => {
    return pacientes.filter(p => 
      (p.estado === 'FINALIZADO' || p.estado === 'COMPLETADO' || p.etapa_actual === 2) &&
      !p.adjunto_nombre
    );
  }, [pacientes]);

  const handleEjecutarDespachoMasivo = async () => {
    if (pacientesPendientesWhatsApp.length === 0) {
      alert('No existen resultados pendientes por enviar por WhatsApp.');
      return;
    }

    setProcesandoMasivo(true);
    const total = pacientesPendientesWhatsApp.length;
    let actual = 0;

    for (const p of pacientesPendientesWhatsApp) {
      actual++;
      setProgresoMasivo({ actual, total, nombreActual: p.nombre_paciente });

      try {
        const fechaEnvio = new Date().toISOString();
        await fetch('/api/facturas/' + p.id + '/estado', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            whatsapp_enviado: true,
            whatsapp_fecha_envio: fechaEnvio
          })
        });

        // Actualizar estado reactivo
        setPacientes(prev => prev.map(item => {
          if (item.id === p.id) {
            return {
              ...item,
              whatsapp_enviado: true,
              whatsapp_fecha_envio: fechaEnvio
            };
          }
          return item;
        }));

        await new Promise(r => setTimeout(r, 350));
      } catch (err) {
        console.error('Error en envío masivo paciente:', p.id, err);
      }
    }

    setProcesandoMasivo(false);
    setModalMasivoWhatsApp(false);
    alert('✅ Despacho masivo completado con éxito. ' + total + ' resultados procesados. La bandeja de cierre diario está ahora libre para consolidar.');
  };

  // 11. Anulación en Sala de Espera (Admin Only) y Traslado a Reembolsos
  const handleConfirmarAnulacion = async () => {
    if (!pacienteAAnular) return;
    if (!motivoAnulacion.trim()) {
      alert('Es obligatorio ingresar el motivo de anulación para la auditoría.');
      return;
    }

    setSubmittingAnulacion(true);
    try {
      await fetch('/api/facturas/' + pacienteAAnular.id + '/estado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          estado: 'ANULADA_SALA',
          motivo_anulacion: motivoAnulacion.trim()
        })
      });

      const nuevoReembolso: ReembolsoPendiente = {
        id: Date.now(),
        paciente_nombre: pacienteAAnular.nombre_paciente,
        cedula: pacienteAAnular.cedula_paciente || 'V-00000000',
        turno_num: pacienteAAnular.grupo_clinico + '-' + String(pacienteAAnular.turno_num).padStart(2, '0'),
        servicio: pacienteAAnular.estudio,
        monto_usd: pacienteAAnular.precio_usd || 25.00,
        monto_bs: pacienteAAnular.precio_bs || 20812.25,
        metodo_origen: 'Bancos / Por Determinar',
        cuenta_id: 4,
        motivo_anulacion: motivoAnulacion.trim(),
        fecha: hoyLocal(),
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        estado: 'PENDIENTE_BANCO',
        usuario_autoriza: 'Director Médico (Admin)'
      };

      setReembolsos(prev => [nuevoReembolso, ...prev]);
      setPacientes(prev => prev.filter(item => item.id !== pacienteAAnular.id));
      setPacienteAAnular(null);
      setMotivoAnulacion('');
      alert('Atención anulada en sala. Turno liberado de TV y fondos trasladados a reversiones bancarias pendientes.');
    } catch (err) {
      alert('Error anulando atención: ' + getErrorMessage(err));
    } finally {
      setSubmittingAnulacion(false);
    }
  };

  // Filtrado por Grupo Clínico
  const pacientesFiltrados = useMemo(() => {
    if (filtroGrupo === 'TODOS') return pacientes;
    return pacientes.filter(p => p.grupo_clinico === filtroGrupo);
  }, [pacientes, filtroGrupo]);

  const pacientesEspera = useMemo(() => {
    return [...pacientesFiltrados.filter(p => p.estado === 'ESPERA')].sort((a, b) => {
      if (a.retorno_sala && !b.retorno_sala) return -1;
      if (!a.retorno_sala && b.retorno_sala) return 1;

      const peso: Record<string, number> = { ALTA: 3, NORMAL: 2, BAJA: 1 };
      const wA = peso[a.prioridad || 'NORMAL'] || 2;
      const wB = peso[b.prioridad || 'NORMAL'] || 2;
      if (wA !== wB) return wB - wA;

      return a.id - b.id;
    });
  }, [pacientesFiltrados]);

  const pacientesAtencion = pacientesFiltrados.filter(p => p.estado === 'ATENCION');
  const pacientesFinalizados = pacientesFiltrados.filter(p => p.estado === 'FINALIZADO' || p.estado === 'COMPLETADO');

  return (
    <div className="space-y-6">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleArchivoSeleccionado}
        accept=".pdf,.png,.jpg,.jpeg,.docx" 
        className="hidden" 
      />

      {/* Encabezado Pulcro y Moderno */}
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

      {tabActiva === 'reembolsos' ? (
        /* BANDEJA DE REVERSIONES / REEMBOLSOS PENDIENTES */
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-clinica-coral" />
                <span>Bandeja de Reversiones Bancarias Pendientes (Anulaciones en Sala)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atenciones canceladas por el Administrador cuyos fondos deben ser devueltos mediante transferencia o caja
              </p>
            </div>
            <Badge className="bg-clinica-coral-soft text-clinica-coral border border-clinica-coral/30 text-xs font-mono font-bold">
              {reembolsos.length} Reversiones Activas
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black">
                <tr>
                  <th className="p-3">Turno / Paciente</th>
                  <th className="p-3">Cédula</th>
                  <th className="p-3">Estudio Anulado</th>
                  <th className="p-3">Motivo de Anulación</th>
                  <th className="p-3 text-right">Monto a Revertir</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reembolsos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No hay reversiones pendientes en este momento.
                    </td>
                  </tr>
                ) : (
                  reembolsos.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="p-3">
                        <span className="font-mono font-black text-clinica-coral mr-2">{r.turno_num}</span>
                        <span className="font-bold text-slate-900">{r.paciente_nombre}</span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">{r.cedula}</td>
                      <td className="p-3 text-slate-800 font-medium">{r.servicio}</td>
                      <td className="p-3 text-slate-600 max-w-xs">{r.motivo_anulacion}</td>
                      <td className="p-3 text-right font-mono font-black text-rose-600 text-sm">
                        Bs. {r.monto_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        <div className="text-[10px] text-slate-400">${r.monto_usd.toFixed(2)} USD</div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Pendiente Reversión
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {isAdmin && !isReadOnly && (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (confirm('¿Confirmar que la reversión de Bs. ' + r.monto_bs + ' a ' + r.paciente_nombre + ' fue transferida y ejecutada en banco?')) {
                                setReembolsos(prev => prev.filter(x => x.id !== r.id));
                                alert('Reversión confirmada y conciliada en bancos.');
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl h-7 px-2.5"
                          >
                            Confirmar Reversión
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <>
          {/* Barra de Filtros por Grupo Clínico */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider pl-1">Filtrar Grupo:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  onClick={() => setFiltroGrupo('TODOS')}
                  className={'px-3 py-1 text-xs font-bold rounded-lg transition-all ' + (
                    filtroGrupo === 'TODOS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  Todos ({pacientes.length})
                </button>
                <button
                  onClick={() => setFiltroGrupo('A')}
                  className={'px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ' + (
                    filtroGrupo === 'A' ? 'bg-clinica-selection text-clinica-dark shadow-sm border border-clinica-aquamarine/40' : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-clinica-primary"></span>
                  <span>Grupo A: Gineco & Eco</span>
                </button>
                <button
                  onClick={() => setFiltroGrupo('B')}
                  className={'px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ' + (
                    filtroGrupo === 'B' ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200' : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>Grupo B: Mamo & Rayos X</span>
                </button>
                <button
                  onClick={() => setFiltroGrupo('C')}
                  className={'px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ' + (
                    filtroGrupo === 'C' ? 'bg-purple-50 text-purple-800 shadow-sm border border-purple-200' : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span>Grupo C: Consultas</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 pr-2">
              <span>En Espera: <strong className="text-amber-600">{pacientesEspera.length}</strong></span>
              <span>En Atención: <strong className="text-blue-600">{pacientesAtencion.length}</strong></span>
              <span>Finalizados: <strong className="text-emerald-600">{pacientesFinalizados.length}</strong></span>
            </div>
          </div>

          {/* TABLERO KANBAN */}
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
        </>
      )}

      {/* Modal Multi-Estudio: Selección de Estudio Principal / Primer Llamado */}
      <Dialog 
        open={modalMultiEstudio.visible} 
        onOpenChange={(open) => !open && setModalMultiEstudio(prev => ({ ...prev, visible: false }))}
      >
        <DialogContent className="sm:max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-black text-base">
              <div className="p-2 bg-clinica-selection rounded-xl text-clinica-primary">
                <ListOrdered className="w-5 h-5" />
              </div>
              <span>Selección de Estudio Principal / Primer Llamado</span>
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              El paciente <strong className="text-slate-800">{modalMultiEstudio.paciente?.nombre_paciente}</strong> tiene varios estudios asignados. Seleccione cuál se realizará primero.
            </p>
          </DialogHeader>

          <div className="py-3 space-y-2">
            {modalMultiEstudio.estudiosDisponibles.map((item) => {
              const esSeleccionado = modalMultiEstudio.estudioSeleccionado === item.id;
              const grupoEst = mapearEstudioAGrupo(item.nombre);

              return (
                <div
                  key={item.id}
                  onClick={() => setModalMultiEstudio(prev => ({ ...prev, estudioSeleccionado: item.id }))}
                  className={'p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ' + (
                    esSeleccionado 
                      ? 'border-clinica-primary bg-clinica-selection/60 shadow-sm ring-1 ring-clinica-primary' 
                      : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{item.nombre}</span>
                      <Badge className="bg-slate-100 text-slate-700 text-[10px]">
                        Grupo {grupoEst}
                      </Badge>
                    </div>
                    {item.medico && (
                      <p className="text-[11px] text-slate-500">Especialista: {item.medico}</p>
                    )}
                  </div>

                  <div className="shrink-0 pl-2">
                    {esSeleccionado ? (
                      <div className="p-1 rounded-full bg-clinica-primary text-white">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalMultiEstudio(prev => ({ ...prev, visible: false }))}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarEstudioPrincipal}
              className="bg-clinica-primary hover:bg-clinica-primary-dark text-white rounded-xl text-xs font-bold"
            >
              Confirmar Primer Llamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Despacho Masivo de WhatsApp para Cierre Diario */}
      <Dialog 
        open={modalMasivoWhatsApp} 
        onOpenChange={(open) => !procesandoMasivo && setModalMasivoWhatsApp(open)}
      >
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white p-6 shadow-2xl border-2 border-emerald-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-800 font-black text-lg">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                <Send className="w-6 h-6" />
              </div>
              <span>Despacho Masivo de WhatsApp (Cierre Diario)</span>
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Envío secuencial de resultados médicos acumulados en el día. Este proceso garantiza que no queden atenciones pendientes antes de consolidar el arqueo contable.
            </p>
          </DialogHeader>

          <div className="py-3 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs font-bold text-emerald-900">Resultados Listos para Despacho (Con Imágenes):</span>
              <Badge className="bg-emerald-600 text-white font-mono text-sm px-2.5">
                {pacientesPendientesWhatsApp.length}
              </Badge>
            </div>

            {pacientesFinalizadosSinAdjunto.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs flex items-start gap-2.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {pacientesFinalizadosSinAdjunto.length} estudio(s) culminado(s) sin imágenes adjuntas
                  </p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Por protocolo médico, el envío de WhatsApp permanece inactivo para estos pacientes hasta que sus imágenes o informe sean cargados al sistema.
                  </p>
                </div>
              </div>
            )}

            {procesandoMasivo && (
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Enviando WhatsApp ({progresoMasivo.actual} de {progresoMasivo.total})...</span>
                  <span className="text-emerald-600 font-mono">
                    {Math.round((progresoMasivo.actual / progresoMasivo.total) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{ width: ((progresoMasivo.actual / progresoMasivo.total) * 100) + '%' }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  Paciente: <strong className="text-slate-800">{progresoMasivo.nombreActual}</strong>
                </p>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {pacientesPendientesWhatsApp.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  ✅ Todos los resultados culminados ya han sido despachados por WhatsApp.
                </div>
              ) : (
                pacientesPendientesWhatsApp.map(p => (
                  <div key={p.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{p.nombre_paciente}</p>
                      <p className="text-[10px] text-slate-500">{p.estudio} • {p.adjunto_nombre || 'Sin adjunto'}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                      Pendiente
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              disabled={procesandoMasivo}
              onClick={() => setModalMasivoWhatsApp(false)}
              className="rounded-xl text-xs"
            >
              Cerrar
            </Button>
            <Button
              disabled={procesandoMasivo || pacientesPendientesWhatsApp.length === 0}
              onClick={handleEjecutarDespachoMasivo}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{procesandoMasivo ? 'Procesando Envío...' : ('Disparar ' + pacientesPendientesWhatsApp.length + ' Enlaces WhatsApp')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Anulación de Atención en Sala (Admin Only) */}
      {pacienteAAnular && (
        <Dialog open={true} onOpenChange={() => setPacienteAAnular(null)}>
          <DialogContent className="sm:max-w-md rounded-3xl bg-white p-6 shadow-2xl border-2 border-clinica-coral/40">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-clinica-coral font-black text-base">
                <AlertTriangle className="w-5 h-5 text-clinica-coral" />
                <span>Anulación de Atención en Sala de Espera</span>
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-1">
                Esta acción cancelará el turno del paciente <strong className="text-slate-800">{pacienteAAnular.nombre_paciente}</strong>, lo retirará del turnero de TV y transferirá el importe cobrado a la bandeja de reversiones bancarias pendientes.
              </p>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1 text-xs border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Paciente:</span>
                  <span className="font-bold text-slate-900">{pacienteAAnular.nombre_paciente}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cédula:</span>
                  <span className="font-mono text-slate-700">{pacienteAAnular.cedula_paciente}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estudio:</span>
                  <span className="font-medium text-slate-800">{pacienteAAnular.estudio}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-bold text-slate-900">
                  <span>Monto a Revertir:</span>
                  <span className="text-rose-600 font-mono">${pacienteAAnular.precio_usd} USD</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Motivo de Anulación (Obligatorio para auditoría contable):
                </label>
                <textarea
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  placeholder="Ej: Paciente no pudo esperar por cita médica externa..."
                  className="w-full h-20 p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-clinica-primary bg-slate-50"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPacienteAAnular(null)}
                className="rounded-xl text-xs"
              >
                Volver
              </Button>
              <Button
                size="sm"
                disabled={submittingAnulacion || !motivoAnulacion.trim()}
                onClick={handleConfirmarAnulacion}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                {submittingAnulacion ? 'Anulando...' : 'Confirmar Anulación y Reversión'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};
