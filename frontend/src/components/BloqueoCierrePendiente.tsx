'use client';

import { despacharWhatsApp, resumenOmitidos } from '@/lib/despacharWhatsApp';
import React, { useState } from 'react';
import { resolverPacienteCierre } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Undo2, Stethoscope, Clock, Send, MessageCircle, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PacientePendiente } from '@/types';
import { getErrorMessage } from '@/lib/utils';

interface BloqueoCierrePendienteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fechaPendiente: string;
  pacientesPendientes: PacientePendiente[];
  pacientesWhatsAppPendientes?: PacientePendiente[];
  onCierreCompletado: () => void;
  esJornadaAnterior?: boolean;
}

export const BloqueoCierrePendiente: React.FC<BloqueoCierrePendienteProps> = ({
  open,
  onOpenChange,
  fechaPendiente,
  pacientesPendientes,
  pacientesWhatsAppPendientes = [],
  onCierreCompletado,
  esJornadaAnterior = false
}) => {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [listaSala, setListaSala] = useState<PacientePendiente[]>(pacientesPendientes);
  const [listaWhatsApp, setListaWhatsApp] = useState<PacientePendiente[]>(pacientesWhatsAppPendientes);
  const [despachandoMasivo, setDespachandoMasivo] = useState(false);

  const handleAccionSala = async (pacienteId: number, accion: 'COMPLETAR' | 'ANULAR') => {
    setLoadingId(pacienteId);
    try {
      await resolverPacienteCierre({ 
        registro_id: pacienteId, 
        accion: accion === 'COMPLETAR' ? 'CULMINAR' : 'ANULAR', 
        usuario: 'Director Médico (Admin)' 
      });
      const nuevaLista = listaSala.filter(p => p.id !== pacienteId);
      setListaSala(nuevaLista);
      if (nuevaLista.length === 0 && listaWhatsApp.length === 0) {
        onCierreCompletado();
        onOpenChange(false);
      }
    } catch (err) {
      alert('Error al procesar el saneamiento: ' + getErrorMessage(err));
    } finally {
      setLoadingId(null);
    }
  };

  const handleDespacharWhatsApp = async (p: PacientePendiente) => {
    setLoadingId(p.id);
    try {
      let tel = (p.telefono_paciente || '').replace(/\D/g, '');
      if (!tel) tel = '584140000000';
      if (tel.startsWith('0')) tel = '58' + tel.slice(1);

      const bot = await despacharWhatsApp([p.id]);
      if (bot.modo === 'bot') {
        if (bot.encolados === 0) {
          alert('No se encoló:\n' + resumenOmitidos(bot.omitidos));
          return;
        }
        const restantes = listaWhatsApp.filter(item => item.id !== p.id);
        setListaWhatsApp(restantes);
        if (listaSala.length === 0 && restantes.length === 0) {
          alert('✅ Mensajes en cola. El cierre se habilita cuando el bot confirme los envíos (unos segundos).');
          onOpenChange(false);
        }
        return;
      }

      const mensaje = encodeURIComponent(
        '🏥 *IMAGEN SALUD - Notificación de Resultados*\n\n' +
        'Estimado(a) *' + p.paciente_nombre + '*:\n' +
        'Le informamos que los resultados de su estudio *' + (p.especialidad || 'médico') + '* ya están listos y validados.\n\n' +
        '_Centro Clínico Imagen Salud, C.A._'
      );

      window.open('https://api.whatsapp.com/send?phone=' + tel + '&text=' + mensaje, '_blank');

      await fetch('/api/facturas/' + p.id + '/estado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_enviado: true,
          whatsapp_fecha_envio: new Date().toISOString()
        })
      });

      const nuevaListaWA = listaWhatsApp.filter(item => item.id !== p.id);
      setListaWhatsApp(nuevaListaWA);
      if (listaSala.length === 0 && nuevaListaWA.length === 0) {
        onCierreCompletado();
        onOpenChange(false);
      }
    } catch (err) {
      alert('Error despachando WhatsApp: ' + getErrorMessage(err));
    } finally {
      setLoadingId(null);
    }
  };

  const handleDespachoMasivo = async () => {
    if (listaWhatsApp.length === 0) return;
    setDespachandoMasivo(true);
    try {
      const bot = await despacharWhatsApp(listaWhatsApp.map(x => x.id));
      if (bot.modo === 'bot') {
        const fallidos = new Set(bot.omitidos.filter(o => o.motivo !== 'Ya en cola' && o.motivo !== 'Ya enviado').map(o => o.id));
        setListaWhatsApp(listaWhatsApp.filter(x => fallidos.has(x.id)));
        alert('✅ ' + bot.encolados + ' mensajes en cola; el cierre se habilita al confirmarse los envíos.' +
          (fallidos.size ? '\n\nRequieren atención:\n' + resumenOmitidos(bot.omitidos.filter(o => fallidos.has(o.id))) : ''));
        if (fallidos.size === 0 && listaSala.length === 0) onOpenChange(false);
        return;
      }
      for (const p of listaWhatsApp) {
        await fetch('/api/facturas/' + p.id + '/estado', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            whatsapp_enviado: true,
            whatsapp_fecha_envio: new Date().toISOString()
          })
        });
      }
      setListaWhatsApp([]);
      if (listaSala.length === 0) {
        onCierreCompletado();
        onOpenChange(false);
      }
      alert('✅ Todos los resultados pendientes fueron marcados como enviados por WhatsApp. Cierre diario desbloqueado.');
    } catch (err) {
      alert('Error en despacho masivo: ' + getErrorMessage(err));
    } finally {
      setDespachandoMasivo(false);
    }
  };

  const totalPendientes = listaSala.length + listaWhatsApp.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-3xl p-6 bg-white shadow-2xl border-2 border-clinica-coral/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-clinica-coral font-black text-lg">
            <div className="p-2 bg-clinica-coral-soft rounded-xl text-clinica-coral">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <span>
              BLOQUEO CRÍTICO DE CIERRE DIARIO ({totalPendientes} pendientes)
            </span>
          </DialogTitle>
          <div className="text-xs text-slate-600 mt-1 space-y-1">
            <p>
              Fecha Evaluada: <strong className="font-mono font-bold text-slate-800">{fechaPendiente}</strong>
            </p>
            <p className="text-slate-500">
              Para garantizar la integridad médica y el arqueo legal, el sistema bloquea el cierre hasta que no existan pacientes en sala ni resultados pendientes por enviar por WhatsApp.
            </p>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* SECCIÓN 1: PACIENTES ACTIVOS EN SALA */}
          {listaSala.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>1. Pacientes Activos en Sala de Espera ({listaSala.length})</span>
                </span>
                <span className="text-[10px] text-amber-700">Resolver para cuadrar arqueo</span>
              </div>

              <div className="space-y-2">
                {listaSala.map(p => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold px-2 py-0.5 bg-slate-800 text-white rounded">
                          #{p.numero_turno || p.id}
                        </span>
                        <strong className="text-slate-900">{p.paciente_nombre}</strong>
                        <Badge className="bg-amber-100 text-amber-800 text-[9px]">{p.estado}</Badge>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">{p.especialidad} • ${p.total_usd || 0} USD</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        disabled={loadingId === p.id}
                        onClick={() => handleAccionSala(p.id, 'COMPLETAR')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl h-7 px-2.5"
                      >
                        Culminar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingId === p.id}
                        onClick={() => handleAccionSala(p.id, 'ANULAR')}
                        className="border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold rounded-xl h-7 px-2.5"
                      >
                        Anular
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN 2: RESULTADOS CULMINADOS PENDIENTES POR WHATSAPP */}
          {listaWhatsApp.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                <span className="flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span>2. Resultados Culminados Pendientes por WhatsApp ({listaWhatsApp.length})</span>
                </span>
                <Button
                  size="sm"
                  disabled={despachandoMasivo}
                  onClick={handleDespachoMasivo}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold h-6 px-2 rounded-lg"
                >
                  {despachandoMasivo ? 'Enviando...' : 'Despachar Todos'}
                </Button>
              </div>

              <div className="space-y-2">
                {listaWhatsApp.map(p => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold px-2 py-0.5 bg-emerald-600 text-white rounded">
                          #{p.numero_turno || p.id}
                        </span>
                        <strong className="text-slate-900">{p.paciente_nombre}</strong>
                        <Badge className="bg-amber-100 text-amber-800 text-[9px]">WhatsApp Pendiente</Badge>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        {p.especialidad} • Adjunto: {p.adjunto_nombre || 'Informe Digital'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        disabled={loadingId === p.id}
                        onClick={() => handleDespacharWhatsApp(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl h-7 px-2.5 flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Enviar WhatsApp</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalPendientes === 0 && (
            <div className="p-8 text-center text-emerald-700 bg-emerald-50 rounded-2xl font-bold text-xs flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Bandeja saneada al 100%. Ya puede consolidar el cierre diario sin bloqueos.</span>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 pt-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-semibold"
          >
            Cerrar Ventana
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
