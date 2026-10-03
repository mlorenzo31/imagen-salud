'use client';

import React from 'react';
import { DoctorCatalogo } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { limpiarNombreInput } from '@/lib/pacienteValidation';

interface ModalEspecialistaProps {
  modalDoctor: { visible: boolean; item?: DoctorCatalogo; };
  errorDuplicadoDoctor: string | null;
  formDoctor: Partial<DoctorCatalogo>;
  setFormDoctor: React.Dispatch<React.SetStateAction<Partial<DoctorCatalogo>>>;
  setErrorDuplicadoDoctor: React.Dispatch<React.SetStateAction<string | null>>;
  guardandoDoctor: boolean;
  setModalDoctor: React.Dispatch<React.SetStateAction<{ visible: boolean; item?: DoctorCatalogo; }>>;
  handleGuardarDoctor: () => Promise<void>;
}

export const ModalEspecialista: React.FC<ModalEspecialistaProps> = ({ modalDoctor, errorDuplicadoDoctor, formDoctor, setFormDoctor, setErrorDuplicadoDoctor, guardandoDoctor, setModalDoctor, handleGuardarDoctor }) => (
  <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
      <div>
        <h3 className="text-sm font-black text-slate-900">
          {modalDoctor.item ? 'Editar Especialista Médico' : 'Registrar Nuevo Especialista'}
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          La Cédula o RIF se valida para impedir registros duplicados en el cuerpo médico.
        </p>
      </div>

      {errorDuplicadoDoctor && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="font-semibold">{errorDuplicadoDoctor}</span>
        </div>
      )}

      <div className="space-y-3 text-xs">
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">
            Cédula / RIF del Especialista <span className="text-rose-500">*</span>
          </label>
          <Input
            value={formDoctor.cedula_rif || ''}
            onChange={e => {
              const val = e.target.value.toUpperCase();
              const prefijo = val.charAt(0);
              if (['V', 'E', 'J', 'G'].includes(prefijo)) {
                const digitos = val.slice(1).replace(/\D/g, '').slice(0, 9);
                setFormDoctor({ ...formDoctor, cedula_rif: `${prefijo}${digitos}` });
              } else {
                setFormDoctor({ ...formDoctor, cedula_rif: val.replace(/\D/g, '').slice(0, 9) });
              }
              if (errorDuplicadoDoctor) setErrorDuplicadoDoctor(null);
            }}
            placeholder="Ej: V12345678 o J315046482"
            className="h-8 text-xs rounded-xl font-mono uppercase"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">
            Nombre Completo (Dr. / Dra.) <span className="text-rose-500">*</span>
          </label>
          <Input
            value={formDoctor.nombre || ''}
            onChange={e => setFormDoctor({ ...formDoctor, nombre: limpiarNombreInput(e.target.value) })}
            placeholder="Dr. Nombre Apellido"
            className="h-8 text-xs rounded-xl"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">
            Especialidad Médica <span className="text-rose-500">*</span>
          </label>
          <Input
            value={formDoctor.especialidad || ''}
            onChange={e => setFormDoctor({ ...formDoctor, especialidad: e.target.value.toUpperCase() })}
            placeholder="Ej. Ginecología, Radiología, Traumatología"
            className="h-8 text-xs rounded-xl uppercase placeholder:normal-case font-bold"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Turno Asignado</label>
            <select
              value={formDoctor.turno || 'AM'}
              onChange={e => setFormDoctor({ ...formDoctor, turno: e.target.value as DoctorCatalogo['turno'] })}
              className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs"
            >
              <option value="AM">Mañana (AM)</option>
              <option value="PM">Tarde (PM)</option>
              <option value="COMPLETO">Jornada Completa</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Honorario (% Comisión)</label>
            <Input
              type="number"
              value={formDoctor.comision_pct || ''}
              onChange={e => setFormDoctor({ ...formDoctor, comision_pct: parseFloat(e.target.value) || 0 })}
              placeholder="70"
              className="h-8 text-xs rounded-xl font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Consultorio / Box Habitual</label>
          <Input
            value={formDoctor.consultorio_defecto || ''}
            onChange={e => setFormDoctor({ ...formDoctor, consultorio_defecto: e.target.value.toUpperCase() })}
            placeholder="Consultorio 1"
            className="h-8 text-xs rounded-xl uppercase placeholder:normal-case"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <Button
          variant="outline"
          disabled={guardandoDoctor}
          onClick={() => setModalDoctor({ visible: false })}
          className="flex-1 h-8 rounded-xl text-xs"
        >
          Cancelar
        </Button>
        <Button
          disabled={guardandoDoctor}
          onClick={handleGuardarDoctor}
          className="flex-1 h-8 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold"
        >
          {guardandoDoctor ? 'Guardando...' : 'Guardar Especialista'}
        </Button>
      </div>
    </div>
  </div>
);
