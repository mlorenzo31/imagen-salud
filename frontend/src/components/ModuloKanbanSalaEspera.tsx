'use client';

import { despacharWhatsApp, resumenOmitidos } from '@/lib/despacharWhatsApp';
import { subirAdjuntos } from '@/lib/subirAdjuntos';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserRole, ModoOperacion, ReembolsoPendiente, ServicioFactura } from '@/types';
import { 
  GrupoClinico, 
  GRUPOS_CLINICOS, 
  mapearEstudioAGrupo, 
  inferirBoxConsultorio 
} from '@/lib/gruposClinicos';
import { RECURSOS, type FilaSala } from '@/lib/sala';
import { hoyLocal } from '@/lib/date';import { getErrorMessage } from '@/lib/utils';
import { AnularPacienteDialog } from '@/components/kanban/AnularPacienteDialog';
import { WhatsAppMasivoDialog } from '@/components/kanban/WhatsAppMasivoDialog';
import { TableroKanban } from '@/components/kanban/TableroKanban';
import { BandejaReembolsos } from '@/components/kanban/BandejaReembolsos';
import { EncabezadoSalaEspera } from '@/components/kanban/EncabezadoSalaEspera';
import { diferir } from '@/lib/diferir';

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
  const [turnos, setTurnos] = useState<FilaSala[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filtroGrupo, setFiltroGrupo] = useState<'TODOS' | 'A' | 'B' | 'C'>('TODOS');
  const [llamandoId, setLlamandoId] = useState<number | null>(null);

  // Bandeja de Reembolsos Pendientes (Anulaciones en sala de espera)
  // Bandeja de reversiones de la sesión (sin datos de muestra). Los reversos contables ya se asientan al anular la factura.
  const [reembolsos, setReembolsos] = useState<ReembolsoPendiente[]>([]);

  // Modal Anulación en Sala
  const [pacienteAAnular, setPacienteAAnular] = useState<PacienteTurno | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [submittingAnulacion, setSubmittingAnulacion] = useState(false);
  const [tabActiva, setTabActiva] = useState<'turnos' | 'reembolsos'>('turnos');

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
      const resSala = await fetch('/api/sala', { cache: 'no-store' });
      if (resSala.ok) setTurnos(((await resSala.json()) as { servicios: FilaSala[] }).servicios);
      const res = await fetch('/api/facturas?abiertas=1');
      if (res.ok) {
        const data: FacturaApi[] = await res.json();
        const parseados: PacienteTurno[] = data
          .filter((f) => f.estado !== 'ANULADA' && f.estado !== 'ANULADA_SALA')
          .map((f): PacienteTurno => {
            const primero = Array.isArray(f.servicios) ? f.servicios[0] : undefined;
            const grupo = mapearEstudioAGrupo(primero?.estudio || f.estudio, primero?.area);
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
    const cancelar = diferir(cargarPacientes);
    const interval = setInterval(cargarPacientes, 6000);
    return () => { cancelar(); clearInterval(interval); };
  }, []);

  // Acciones de sala: el servidor valida (paciente en un solo grupo, sala libre, médico libre) y decide la sala.
  const accionSala = async (accion: 'LLAMAR' | 'RELLAMAR' | 'FINALIZAR' | 'AUSENTE', ids: number[], box?: string) => {
    const res = await fetch('/api/sala/accion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, ids, box }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; asignaciones?: { id: number; box: string }[] };
    if (!res.ok) {
      alert(json.error ?? 'No se pudo completar la acción.');
      await cargarPacientes();
      return null;
    }
    await cargarPacientes();
    return json;
  };

  const handleLlamar = async (ids: number[], box?: string) => {
    if (isReadOnly) return alert('Acción restringida en Modo Vista (Read-Only).');
    setLlamandoId(ids[0]);
    try {
      // La voz se emite solo en la TV de la sala de espera, no en este puesto.
      await accionSala('LLAMAR', ids, box);
    } catch (err) {
      console.error('Error al llamar:', err);
    } finally {
      setLlamandoId(null);
    }
  };

  const handleFinalizar = async (ids: number[]) => {
    if (isReadOnly) return alert('Modo Vista activo.');
    await accionSala('FINALIZAR', ids);
  };

  const handleAusente = async (t: FilaSala) => {
    if (isReadOnly) return alert('Modo Vista activo.');
    if (!confirm('¿"' + (t.nombre_paciente ?? 'Paciente') + '" no se presentó al llamado? Volverá al final de la sala de espera.')) return;
    await accionSala('AUSENTE', [t.id]);
  };

  const handleRellamar = async (t: FilaSala) => {
    if (isReadOnly) return alert('Modo Vista activo.');
    await accionSala('RELLAMAR', [t.id]);
  };

  const handleAnularTurno = (t: FilaSala) => {
    const factura = pacientes.find(p => p.id === t.factura_id);
    if (factura) setPacienteAAnular(factura);
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
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0 || !pacienteAdjuntoId) return;
    const facturaId = pacienteAdjuntoId;

    try {
      const r = await subirAdjuntos(facturaId, archivos);
      if (r.subidos > 0) {
        setPacientes(prev => prev.map(p => p.id === facturaId
          ? { ...p, adjunto_nombre: r.adjuntoNombre ?? p.adjunto_nombre, whatsapp_enviado: false }
          : p));
      }
      const resumen = r.subidos > 0
        ? r.subidos + ' archivo(s) adjuntado(s). La atención está lista para envío por WhatsApp.'
        : 'No se adjuntó ningún archivo.';
      alert(resumen + (r.errores.length ? '\n\nNo se pudieron subir:\n' + r.errores.join('\n') : ''));
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

    const bot = await despacharWhatsApp([p.id], telInternacional);
    if (bot.modo === 'bot') {
      alert(bot.encolados > 0
        ? '✅ Mensaje en cola: el bot lo enviará en unos segundos y quedará registrado como enviado.'
        : 'No se encoló:\n' + resumenOmitidos(bot.omitidos));
      return;
    }

    const docNombre = p.adjunto_nombre ? ('\n📎 *Documento adjunto:* ' + p.adjunto_nombre) : '';
    const mensaje = encodeURIComponent(
      '🏥 *IMAGEN SALUD - Notificación Oficial de Resultados*\n\n' +
      'Estimado(a) *' + p.nombre_paciente + '*:\n' +
      'Le informamos que los resultados de su estudio *' + p.estudio + '* ya han sido debidamente procesados, validados y firmados por el especialista.' + docNombre + '\n\n' +
      (bot.enlaces[p.id] ? '🔗 Ver y descargar sus resultados:\n' + bot.enlaces[p.id] + '\n\n' : '') +
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

    const botMasivo = await despacharWhatsApp(pacientesPendientesWhatsApp.map(x => x.id));
    if (botMasivo.modo === 'bot') {
      setModalMasivoWhatsApp(false);
      alert('✅ ' + botMasivo.encolados + ' mensajes en cola; el bot los envía de forma escalonada.' +
        (botMasivo.omitidos.length ? '\n\nOmitidos:\n' + resumenOmitidos(botMasivo.omitidos) : ''));
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

  // Turnos por estudio (el servidor ya los entrega en orden de cola: retorno prioritario, prioridad, llegada).
  const turnosFiltrados = useMemo(
    () => (filtroGrupo === 'TODOS' ? turnos : turnos.filter(t => t.grupo === filtroGrupo)),
    [turnos, filtroGrupo]
  );
  const turnosEspera = turnosFiltrados.filter(t => t.estado === 'ESPERA');
  const turnosAtencion = turnosFiltrados.filter(t => t.estado === 'ATENCION');

  const pacientesFiltrados = useMemo(() => {
    if (filtroGrupo === 'TODOS') return pacientes;
    return pacientes.filter(p => p.grupo_clinico === filtroGrupo);
  }, [pacientes, filtroGrupo]);
  const pacientesFinalizados = pacientesFiltrados.filter(p => p.estado === 'FINALIZADO' || p.estado === 'COMPLETADO');

  return (
    <div className="space-y-6">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleArchivoSeleccionado}
        accept=".pdf,.png,.jpg,.jpeg,.webp,.docx" 
        multiple
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
                  Todos ({turnos.length})
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
              <span>En Espera: <strong className="text-amber-600">{turnosEspera.length}</strong></span>
              <span>En Atención: <strong className="text-blue-600">{turnosAtencion.length}</strong></span>
              <span>Finalizados: <strong className="text-emerald-600">{pacientesFinalizados.length}</strong></span>
            </div>
          </div>

          {/* TABLERO KANBAN */}
          <TableroKanban turnosTodos={turnos} turnosEspera={turnosEspera} turnosAtencion={turnosAtencion} isReadOnly={isReadOnly} isAdmin={isAdmin} llamandoId={llamandoId} onLlamar={handleLlamar} onFinalizar={handleFinalizar} onAusente={handleAusente} onRellamar={handleRellamar} onAnular={handleAnularTurno} pacientesFinalizados={pacientesFinalizados} handleTriggerAdjunto={handleTriggerAdjunto} handleEnviarWhatsAppIndividual={handleEnviarWhatsAppIndividual} />
        </>
      )}

      {/* Modal Despacho Masivo de WhatsApp para Cierre Diario */}
      <WhatsAppMasivoDialog modalMasivoWhatsApp={modalMasivoWhatsApp} procesandoMasivo={procesandoMasivo} setModalMasivoWhatsApp={setModalMasivoWhatsApp} pacientesPendientesWhatsApp={pacientesPendientesWhatsApp} pacientesFinalizadosSinAdjunto={pacientesFinalizadosSinAdjunto} progresoMasivo={progresoMasivo} handleEjecutarDespachoMasivo={handleEjecutarDespachoMasivo} />

      {/* Modal Anulación de Atención en Sala (Admin Only) */}
      {pacienteAAnular && (
        <AnularPacienteDialog setPacienteAAnular={setPacienteAAnular} pacienteAAnular={pacienteAAnular} motivoAnulacion={motivoAnulacion} setMotivoAnulacion={setMotivoAnulacion} submittingAnulacion={submittingAnulacion} handleConfirmarAnulacion={handleConfirmarAnulacion} />
      )}

    </div>
  );
};
