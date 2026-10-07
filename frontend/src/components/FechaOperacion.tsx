'use client';

import { useState } from 'react';
import { CalendarClock } from 'lucide-react';

export const hoyCaracas = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());

/**
 * Fecha contable de una operación de tesorería. Por defecto hoy; si se elige un día anterior pide el motivo
 * (el servidor valida además que no sea futura y que, si el día ya está cerrado, solo un administrador la registre).
 */
export function useFechaOperacion() {
  const [fecha, setFecha] = useState<string>(hoyCaracas);
  const [motivo, setMotivo] = useState('');
  const retroactiva = fecha !== '' && fecha < hoyCaracas();

  const payload = { fecha: fecha || undefined, motivo_retroactivo: retroactiva ? motivo.trim() : undefined };
  const incompleta = retroactiva && motivo.trim().length < 3;
  const reiniciar = () => { setFecha(hoyCaracas()); setMotivo(''); };

  const campo = (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><CalendarClock size={14} /> Fecha de la operación</span>
        <input type="date" value={fecha} max={hoyCaracas()} onChange={(e) => setFecha(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      </label>
      {retroactiva && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-amber-700">Motivo del registro en un día anterior (obligatorio)</span>
          <input type="text" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: no se registró ese día"
            className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm" />
        </label>
      )}
    </div>
  );

  return { campo, payload, incompleta, reiniciar };
}
