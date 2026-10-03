'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Search, CheckCheck } from 'lucide-react';
import type { PagoRecibidoCaja } from '../ModuloConciliacionPOS';

interface SeccionPagosRecibidosProps {
  busquedaPagos: string;
  setBusquedaPagos: React.Dispatch<React.SetStateAction<string>>;
  filtroMetodoPago: string;
  setFiltroMetodoPago: React.Dispatch<React.SetStateAction<string>>;
  isReadOnly: boolean;
  handleConciliarTodosLosPagos: () => void;
  pagosFiltrados: PagoRecibidoCaja[];
  handleConciliarPagoIndividual: (id: number) => void;
}

export const SeccionPagosRecibidos: React.FC<SeccionPagosRecibidosProps> = ({ busquedaPagos, setBusquedaPagos, filtroMetodoPago, setFiltroMetodoPago, isReadOnly, handleConciliarTodosLosPagos, pagosFiltrados, handleConciliarPagoIndividual }) => (
  <div className="space-y-4">
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
      <div className="relative flex-1 w-full max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <Input
          placeholder="Buscar paciente, cédula, referencia o factura..."
          value={busquedaPagos}
          onChange={e => setBusquedaPagos(e.target.value)}
          className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
        />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={filtroMetodoPago}
          onChange={e => setFiltroMetodoPago(e.target.value)}
          className="h-9 px-3 text-xs bg-slate-100 border-none rounded-xl font-bold text-slate-700 cursor-pointer"
        >
          <option value="TODOS">Todos los Métodos</option>
          <option value="PUNTO_POS">Punto POS (Tarjeta)</option>
          <option value="PAGO_MOVIL">Pago Móvil</option>
          <option value="TRANSFERENCIA">Transferencia</option>
        </select>

        {!isReadOnly && (
          <Button
            size="sm"
            onClick={handleConciliarTodosLosPagos}
            className="h-9 px-3.5 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Conciliar Todos Pendientes</span>
          </Button>
        )}
      </div>
    </div>

    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3">Factura</th>
              <th className="p-3">Fecha/Hora</th>
              <th className="p-3">Paciente & Cédula</th>
              <th className="p-3">Método / Terminal</th>
              <th className="p-3 font-mono">Ref. Caja</th>
              <th className="p-3 text-right">Monto (Bs)</th>
              <th className="p-3 text-right">Monto ($)</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  No se encontraron pagos registrados para conciliar.
                </td>
              </tr>
            ) : (
              pagosFiltrados.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-mono font-bold text-slate-900">{p.factura_id}</td>
                  <td className="p-3 text-slate-500">{p.fecha} <span className="text-[10px]">{p.hora}</span></td>
                  <td className="p-3">
                    <span className="font-bold text-slate-900 block">{p.paciente}</span>
                    <span className="font-mono text-slate-400 text-[10px]">{p.cedula}</span>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[9px] font-bold border-cyan-300 bg-cyan-50 text-cyan-900">
                      {p.metodo === 'PUNTO_POS' ? 'Punto POS' : p.metodo === 'PAGO_MOVIL' ? 'Pago Móvil' : 'Transferencia'}
                    </Badge>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{p.banco}</span>
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-700">{p.referencia}</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900">
                    Bs. {p.monto_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-[#1D7A70]">
                    ${p.monto_usd.toFixed(2)}
                  </td>
                  <td className="p-3 text-center">
                    <Badge className={p.estado === 'CONCILIADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>
                      {p.estado === 'CONCILIADO' ? '✓ Conciliado' : 'Pendiente'}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    {p.estado === 'CONCILIADO' ? (
                      <span className="text-[11px] text-emerald-700 font-bold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{p.referencia_extracto || 'Verificado'}</span>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConciliarPagoIndividual(p.id)}
                        className="h-7 px-2.5 text-xs font-bold bg-[#1D7A70] hover:bg-[#155A52] text-white rounded-xl shadow-xs"
                      >
                        ✓ Conciliar
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
