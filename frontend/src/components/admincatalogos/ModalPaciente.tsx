'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { aFormatoInputDate, calcularEdadReal, hoyLocal } from '@/lib/date';
import { limpiarCedulaInput, limpiarNombreInput, limpiarTelefonoInput } from '@/lib/pacienteValidation';
import { PacienteCatalogo } from '@/types';
import { inferirSexo, ETIQUETA_SEXO } from '@/lib/sexo';

interface ModalPacienteProps {
  modalPaciente: { visible: boolean; item?: PacienteCatalogo; };
  errorDuplicadoPaciente: string | null;
  formPaciente: Partial<PacienteCatalogo>;
  setFormPaciente: React.Dispatch<React.SetStateAction<Partial<PacienteCatalogo>>>;
  setErrorDuplicadoPaciente: React.Dispatch<React.SetStateAction<string | null>>;
  setModalPaciente: React.Dispatch<React.SetStateAction<{ visible: boolean; item?: PacienteCatalogo; }>>;
  handleGuardarPaciente: () => void;
}

export const ModalPaciente: React.FC<ModalPacienteProps> = ({ modalPaciente, errorDuplicadoPaciente, formPaciente, setFormPaciente, setErrorDuplicadoPaciente, setModalPaciente, handleGuardarPaciente }) => (
  <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
      <h3 className="text-sm font-black text-slate-900">
        {modalPaciente.item ? 'Editar Datos del Paciente' : 'Registrar Nuevo Paciente'}
      </h3>

      {errorDuplicadoPaciente && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="font-semibold">{errorDuplicadoPaciente}</span>
        </div>
      )}

      <div className="space-y-3 text-xs">
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">
            Cédula de Identidad <span className="text-rose-500">*</span>
          </label>
          <Input
            value={formPaciente.cedula || ''}
            onChange={e => {
              const val = e.target.value.toUpperCase();
              const prefijo = val.charAt(0);
              if (['V', 'E', 'J', 'G', 'P'].includes(prefijo)) {
                const digitos = limpiarCedulaInput(val.slice(1), prefijo === 'P' ? 'P' : 'V');
                setFormPaciente({ ...formPaciente, cedula: `${prefijo}${digitos}` });
              } else {
                setFormPaciente({ ...formPaciente, cedula: limpiarCedulaInput(val, 'V') });
              }
              if (errorDuplicadoPaciente) setErrorDuplicadoPaciente(null);
            }}
            placeholder="Ej: V23196410 (Solo números)"
            className="h-8 text-xs rounded-xl font-mono uppercase"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">
            Nombres y Apellidos <span className="text-rose-500">*</span>
          </label>
          <Input
            value={formPaciente.nombres || ''}
            onChange={e => {
              const nombres = limpiarNombreInput(e.target.value);
              // Sugiere el sexo por el nombre salvo que el paciente ya lo tenga registrado.
              setFormPaciente({ ...formPaciente, nombres, ...(modalPaciente.item?.sexo ? {} : { sexo: inferirSexo(nombres) }) });
            }}
            placeholder="Nombre completo (sin números)"
            className="h-8 text-xs rounded-xl"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">
            Sexo <span className="text-rose-500">*</span>
            {formPaciente.sexo && !modalPaciente.item?.sexo && (
              <span className="ml-1 font-normal text-slate-500">(sugerido por el nombre; confirme)</span>
            )}
          </label>
          <div className="flex gap-2">
            {(['F', 'M'] as const).map(op => (
              <button
                key={op}
                type="button"
                onClick={() => setFormPaciente({ ...formPaciente, sexo: op })}
                className={`flex-1 h-8 rounded-xl text-xs font-bold border transition-colors ${
                  formPaciente.sexo === op ? 'bg-[#1D7A70] border-[#1D7A70] text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {ETIQUETA_SEXO[op]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Teléfono</label>
            <Input
              value={formPaciente.telefono || ''}
              onChange={e => setFormPaciente({ ...formPaciente, telefono: limpiarTelefonoInput(e.target.value) })}
              maxLength={11}
              placeholder="04141234567"
              className="h-8 text-xs rounded-xl font-mono"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-600 block">F. Nacimiento</label>
              {formPaciente.fecha_nacimiento && (
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                  {calcularEdadReal(formPaciente.fecha_nacimiento)} años
                </span>
              )}
            </div>
            <Input
              type="date"
              value={aFormatoInputDate(formPaciente.fecha_nacimiento)}
              onChange={e => setFormPaciente({ ...formPaciente, fecha_nacimiento: e.target.value })}
              max={hoyLocal()}
              className="h-8 text-xs rounded-xl font-medium"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Dirección Habitual</label>
          <Input
            value={formPaciente.direccion || ''}
            onChange={e => setFormPaciente({ ...formPaciente, direccion: e.target.value.toUpperCase() })}
            placeholder="Ciudad / Municipio"
            className="h-8 text-xs rounded-xl uppercase placeholder:normal-case"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <Button
          variant="outline"
          onClick={() => setModalPaciente({ visible: false })}
          className="flex-1 h-8 rounded-xl text-xs"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleGuardarPaciente}
          className="flex-1 h-8 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold"
        >
          Guardar
        </Button>
      </div>
    </div>
  </div>
);
