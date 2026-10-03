'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import type { PacienteTurno } from '../ModuloKanbanSalaEspera';

interface AnularPacienteDialogProps {
  setPacienteAAnular: React.Dispatch<React.SetStateAction<PacienteTurno | null>>;
  pacienteAAnular: PacienteTurno;
  motivoAnulacion: string;
  setMotivoAnulacion: React.Dispatch<React.SetStateAction<string>>;
  submittingAnulacion: boolean;
  handleConfirmarAnulacion: () => Promise<void>;
}

export const AnularPacienteDialog: React.FC<AnularPacienteDialogProps> = ({ setPacienteAAnular, pacienteAAnular, motivoAnulacion, setMotivoAnulacion, submittingAnulacion, handleConfirmarAnulacion }) => (
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
);
