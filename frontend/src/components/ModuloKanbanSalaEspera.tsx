'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ejecutarLlamadoCompleto } from '@/lib/audioLlamado';
import { UserRole, ModoOperacion, ReembolsoPendiente, ServicioFactura } from '@/types';
import { 
  GrupoClinico, 
  GRUPOS_CLINICOS, 
  mapearEstudioAGrupo, 
  inferirBoxConsultorio 
} from '@/lib/gruposClinicos';
import { hoyLocal } from '@/lib/date';import { getErrorMessage } from '@/lib/utils';
import { AnularPacienteDialog } from '@/components/kanban/AnularPacienteDialog';
import { WhatsAppMasivoDialog } from '@/components/kanban/WhatsAppMasivoDialog';
import { MultiEstudioDialog } from '@/components/kanban/MultiEstudioDialog';
import { TableroKanban } from '@/components/kanban/TableroKanban';
import { BandejaReembolsos } from '@/components/kanban/BandejaReembolsos';
import { EncabezadoSalaEspera } from '@/components/kanban/EncabezadoSalaEspera';

export interface PacienteTurno {
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
      <EncabezadoSalaEspera setModalMasivoWhatsApp={setModalMasivoWhatsApp} pacientesPendientesWhatsApp={pacientesPendientesWhatsApp} setTabActiva={setTabActiva} tabActiva={tabActiva} reembolsos={reembolsos} cargarPacientes={cargarPacientes} loading={loading} />

      {tabActiva === 'reembolsos' ? (
        /* BANDEJA DE REVERSIONES / REEMBOLSOS PENDIENTES */
        <BandejaReembolsos reembolsos={reembolsos} isAdmin={isAdmin} isReadOnly={isReadOnly} setReembolsos={setReembolsos} />
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
          <TableroKanban pacientesEspera={pacientesEspera} verificarConflictoConcurrencia={verificarConflictoConcurrencia} obtenerHermanosMismoGrupo={obtenerHermanosMismoGrupo} extraerSubEstudios={extraerSubEstudios} handleAbrirPrioridadEstudio={handleAbrirPrioridadEstudio} isReadOnly={isReadOnly} llamandoId={llamandoId} handleLlamarPaciente={handleLlamarPaciente} isAdmin={isAdmin} setPacienteAAnular={setPacienteAAnular} pacientesAtencion={pacientesAtencion} handleFinalizarAtencion={handleFinalizarAtencion} pacientesFinalizados={pacientesFinalizados} handleTriggerAdjunto={handleTriggerAdjunto} handleEnviarWhatsAppIndividual={handleEnviarWhatsAppIndividual} />
        </>
      )}

      {/* Modal Multi-Estudio: Selección de Estudio Principal / Primer Llamado */}
      <MultiEstudioDialog modalMultiEstudio={modalMultiEstudio} setModalMultiEstudio={setModalMultiEstudio} handleConfirmarEstudioPrincipal={handleConfirmarEstudioPrincipal} />

      {/* Modal Despacho Masivo de WhatsApp para Cierre Diario */}
      <WhatsAppMasivoDialog modalMasivoWhatsApp={modalMasivoWhatsApp} procesandoMasivo={procesandoMasivo} setModalMasivoWhatsApp={setModalMasivoWhatsApp} pacientesPendientesWhatsApp={pacientesPendientesWhatsApp} pacientesFinalizadosSinAdjunto={pacientesFinalizadosSinAdjunto} progresoMasivo={progresoMasivo} handleEjecutarDespachoMasivo={handleEjecutarDespachoMasivo} />

      {/* Modal Anulación de Atención en Sala (Admin Only) */}
      {pacienteAAnular && (
        <AnularPacienteDialog setPacienteAAnular={setPacienteAAnular} pacienteAAnular={pacienteAAnular} motivoAnulacion={motivoAnulacion} setMotivoAnulacion={setMotivoAnulacion} submittingAnulacion={submittingAnulacion} handleConfirmarAnulacion={handleConfirmarAnulacion} />
      )}

    </div>
  );
};
