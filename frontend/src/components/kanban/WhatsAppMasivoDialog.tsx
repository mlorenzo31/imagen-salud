'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, Send } from 'lucide-react';
import type { PacienteTurno } from '../ModuloKanbanSalaEspera';

interface WhatsAppMasivoDialogProps {
  modalMasivoWhatsApp: boolean;
  procesandoMasivo: boolean;
  setModalMasivoWhatsApp: React.Dispatch<React.SetStateAction<boolean>>;
  pacientesPendientesWhatsApp: PacienteTurno[];
  pacientesFinalizadosSinAdjunto: PacienteTurno[];
  progresoMasivo: { actual: number; total: number; nombreActual: string; };
  handleEjecutarDespachoMasivo: () => Promise<void>;
}

export const WhatsAppMasivoDialog: React.FC<WhatsAppMasivoDialogProps> = ({ modalMasivoWhatsApp, procesandoMasivo, setModalMasivoWhatsApp, pacientesPendientesWhatsApp, pacientesFinalizadosSinAdjunto, progresoMasivo, handleEjecutarDespachoMasivo }) => (
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
);
