'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Undo2 } from 'lucide-react';
import { ReembolsoPendiente } from '@/types';

interface BandejaReembolsosProps {
  reembolsos: ReembolsoPendiente[];
  isAdmin: boolean;
  isReadOnly: boolean;
  setReembolsos: React.Dispatch<React.SetStateAction<ReembolsoPendiente[]>>;
}

export const BandejaReembolsos: React.FC<BandejaReembolsosProps> = ({ reembolsos, isAdmin, isReadOnly, setReembolsos }) => (
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
);
