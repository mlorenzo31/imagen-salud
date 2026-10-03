'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Search } from 'lucide-react';
import { ConciliacionPOS } from '@/types';

interface SeccionLotesPOSProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setFiltroEstado: React.Dispatch<React.SetStateAction<"TODOS" | "CONCILIADO" | "PENDIENTE" | "DESCUADRADO">>;
  filtroEstado: "TODOS" | "CONCILIADO" | "PENDIENTE" | "DESCUADRADO";
  filtroTipoTarjeta: string;
  setFiltroTipoTarjeta: React.Dispatch<React.SetStateAction<string>>;
  lotesFiltrados: ConciliacionPOS[];
  isReadOnly: boolean;
  handleReabrirLote: (id: number) => void;
  handleAbrirModalConciliar: (lote: ConciliacionPOS) => void;
  handleConciliarRapido: (lote: ConciliacionPOS) => void;
}

export const SeccionLotesPOS: React.FC<SeccionLotesPOSProps> = ({ searchQuery, setSearchQuery, setFiltroEstado, filtroEstado, filtroTipoTarjeta, setFiltroTipoTarjeta, lotesFiltrados, isReadOnly, handleReabrirLote, handleAbrirModalConciliar, handleConciliarRapido }) => (
  <div className="space-y-4">
    {/* Barra de Filtros */}
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
      <div className="relative flex-1 w-full max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <Input
          placeholder="Buscar por lote, terminal o banco..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
          {(['TODOS', 'CONCILIADO', 'PENDIENTE', 'DESCUADRADO'] as const).map(est => (
            <button
              key={est}
              onClick={() => setFiltroEstado(est)}
              className={`px-3 py-1 rounded-lg transition-all ${
                filtroEstado === est ? 'bg-white text-[#1D7A70] shadow-sm font-black' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {est === 'TODOS' ? 'Todos' : est === 'CONCILIADO' ? 'Conciliados' : est === 'PENDIENTE' ? 'Pendientes' : 'Descuadrados'}
            </button>
          ))}
        </div>

        <select
          value={filtroTipoTarjeta}
          onChange={e => setFiltroTipoTarjeta(e.target.value)}
          className="h-9 px-3 text-xs bg-slate-100 border-none rounded-xl font-bold text-slate-700 cursor-pointer"
        >
          <option value="TODAS">Todas las Tarjetas</option>
          <option value="TDD">TDD Débito</option>
          <option value="TDC">TDC Crédito</option>
        </select>
      </div>
    </div>

    {/* Tabla de Lotes POS con Botones de Acción */}
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3">N° Lote</th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Tipo Tarjeta</th>
              <th className="p-3">Terminal / Banco</th>
              <th className="p-3 text-right">Bruto POS</th>
              <th className="p-3 text-right">Comisión Banco</th>
              <th className="p-3 text-right">Neto Liquidado</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lotesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  No se encontraron lotes para el criterio de búsqueda.
                </td>
              </tr>
            ) : (
              lotesFiltrados.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-mono font-bold text-slate-900">
                    <span className="px-2 py-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px]">
                      Lote #{l.lote_numero}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 font-medium">{l.fecha_operacion}</td>
                  <td className="p-3">
                    <Badge className={
                      l.tipo_tarjeta === 'TDD' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }>
                      {l.tipo_tarjeta}
                    </Badge>
                  </td>
                  <td className="p-3 font-semibold text-slate-800">{l.banco}</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900">
                    Bs. {l.monto_bruto_pos_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-rose-600">
                    -Bs. {l.comision_bancaria_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    <div className="text-[10px] text-slate-400 font-normal">({l.comision_porcentaje}%)</div>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-[#1D7A70]">
                    Bs. {l.monto_neto_liquidado_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <Badge className={
                      l.estado === 'CONCILIADO' ? 'bg-emerald-100 text-emerald-800' :
                      l.estado === 'PENDIENTE' ? 'bg-rose-100 text-rose-800 font-bold' :
                      'bg-amber-100 text-amber-800'
                    }>
                      {l.estado === 'CONCILIADO' ? '✓ Conciliado' : l.estado}
                    </Badge>
                  </td>
                  {/* COLUMNA DE ACCIONES DE CONCILIACIÓN */}
                  <td className="p-3 text-center">
                    {l.estado === 'CONCILIADO' ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Verificado</span>
                        </span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleReabrirLote(l.id)}
                            className="text-[10px] text-slate-400 hover:text-slate-600 ml-1.5 underline"
                            title="Reabrir para editar"
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleAbrirModalConciliar(l)}
                          className="h-7 px-3 text-xs font-bold bg-[#1D7A70] hover:bg-[#155A52] text-white rounded-xl shadow-xs flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Conciliar Abono</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConciliarRapido(l)}
                          className="h-7 px-2 text-[11px] font-medium border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl"
                          title="Conciliar directamente si el abono bancario coincide exactamente"
                        >
                          Rápido
                        </Button>
                      </div>
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
