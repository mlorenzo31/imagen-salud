'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, ListOrdered } from 'lucide-react';
import { mapearEstudioAGrupo } from '@/lib/gruposClinicos';
import type { PacienteTurno } from '../ModuloKanbanSalaEspera';

interface MultiEstudioDialogProps {
  modalMultiEstudio: { visible: boolean; paciente: PacienteTurno | null; estudiosDisponibles: Array<{ id: string; nombre: string; area?: string; medico?: string; }>; estudioSeleccionado: string; };
  setModalMultiEstudio: React.Dispatch<React.SetStateAction<{ visible: boolean; paciente: PacienteTurno | null; estudiosDisponibles: Array<{ id: string; nombre: string; area?: string; medico?: string; }>; estudioSeleccionado: string; }>>;
  handleConfirmarEstudioPrincipal: () => Promise<void>;
}

export const MultiEstudioDialog: React.FC<MultiEstudioDialogProps> = ({ modalMultiEstudio, setModalMultiEstudio, handleConfirmarEstudioPrincipal }) => (
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
);
