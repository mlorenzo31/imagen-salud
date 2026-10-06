'use client';

import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ban, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { esAnulada } from '@/lib/estados';
import { FacturaCaja } from '@/types';
import type { GrupoClinicoFiltro } from '../ModuloCajaDiaria';

interface TablaFacturasCajaProps {
  facturasFiltradas: FacturaCaja[];
  agruparPor: GrupoClinicoFiltro;
  grupos: { nombreGrupo: string; items: FacturaCaja[]; subtotalUSD: number; subtotalBs: number; totalItems: number; }[] | null;
  totalCobradoUSD: number;
  totalCobradoBs: number;
  gruposColapsados: Record<string, boolean>;
  toggleColapsarGrupo: (nombre: string) => void;
  tasaBcv: number;
  verTicket: (factura: FacturaCaja) => void;
  anulandoId: number | null;
  handleAnular: (id: number) => Promise<void>;
}

export const TablaFacturasCaja: React.FC<TablaFacturasCajaProps> = ({ facturasFiltradas, agruparPor, grupos, totalCobradoUSD, totalCobradoBs, gruposColapsados, toggleColapsarGrupo, tasaBcv, verTicket, anulandoId, handleAnular }) => (
  <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
    <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
      <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-2">
        <span>Resultados: {facturasFiltradas.length} comprobantes</span>
        {agruparPor !== 'NINGUNO' && (
          <Badge className="bg-indigo-100 text-indigo-900 border border-indigo-300 text-[10px]">
            {grupos?.length || 0} Grupos Formados
          </Badge>
        )}
      </CardTitle>
      <p className="text-[11px] text-slate-500">Total en vista: ${totalCobradoUSD.toFixed(2)} (Bs. {totalCobradoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
    </CardHeader>

    <div className="overflow-x-auto">
      {/* CASO 1: VISTA AGRUPADA (GROUP BY) */}
      {grupos ? (
        <div className="divide-y divide-slate-200">
          {grupos.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs">
              No hay comprobantes que coincidan con los filtros y agrupaciones activas
            </div>
          ) : (
            grupos.map(grp => {
              const isColapsado = gruposColapsados[grp.nombreGrupo] || false;
              return (
                <div key={grp.nombreGrupo} className="border-b border-slate-200 last:border-0">
                  {/* Cabecera del Grupo Clínico */}
                  <div 
                    onClick={() => toggleColapsarGrupo(grp.nombreGrupo)}
                    className="bg-slate-100/90 hover:bg-slate-200/80 cursor-pointer p-3.5 flex items-center justify-between transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      {isColapsado ? (
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      )}
                      <span className="font-black text-xs text-slate-900 flex items-center gap-2">
                        <span>{grp.nombreGrupo}</span>
                        <Badge variant="outline" className="bg-white text-slate-700 font-mono text-[10px]">
                          {grp.totalItems} registros
                        </Badge>
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-xs font-black text-slate-900">${grp.subtotalUSD.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-500 font-bold ml-2">
                        (Bs. {grp.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    </div>
                  </div>

                  {/* Filas del Grupo */}
                  {!isColapsado && (
                    <div className="pl-4 bg-white divide-y divide-slate-100">
                      {grp.items.map(f => {
                        const isAnulada = esAnulada(f.estado);
                        const tasaFactura = Number(f.tasa_bcv || tasaBcv);
                        const totalBsFactura = Number(f.precio_usd || 0) * tasaFactura;
                        return (
                          <div key={f.id} className={`p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-xs ${isAnulada ? 'opacity-50 line-through bg-slate-50/50' : ''}`}>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-black text-slate-800 text-xs w-12">
                                #{f.turno_num ? String(f.turno_num).padStart(3, '0') : f.id}
                              </span>
                              <div>
                                <p className="font-bold text-slate-900">{f.nombre_paciente}</p>
                                <p className="text-[11px] text-slate-500">{f.estudio} • <span className="font-medium text-cyan-700">{f.medico || 'De Guardia'}</span></p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right font-mono">
                                <p className="font-black text-slate-900">${Number(f.precio_usd || 0).toFixed(2)}</p>
                                <p className="text-[10px] text-slate-500 font-bold">Bs. {totalBsFactura.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              </div>
                              <Badge className={
                                isAnulada ? 'bg-rose-600' :
                                String(f.etapa_actual) === '2' || f.estado === 'FINALIZADO' ? 'bg-emerald-600' :
                                String(f.etapa_actual) === '1' || f.estado === 'ATENCION' ? 'bg-amber-500' : 'bg-blue-600'
                              }>
                                {isAnulada ? 'ANULADA' : String(f.etapa_actual) === '2' || f.estado === 'FINALIZADO' ? 'LISTO' : String(f.etapa_actual) === '1' || f.estado === 'ATENCION' ? 'ATENCIÓN' : 'ESPERA'}
                              </Badge>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => verTicket(f)}
                                  className="p-1 rounded-lg text-slate-500 hover:text-cyan-700 hover:bg-cyan-50"
                                  title="Ver Comprobante"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {!isAnulada && (
                                  <button
                                    disabled={anulandoId === f.id}
                                    onClick={() => handleAnular(f.id)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                    title="Anular"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* CASO 2: VISTA DE TABLA PLANA */
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <th className="py-2.5 px-3">Folio/Turno</th>
              <th className="py-2.5 px-3">Hora</th>
              <th className="py-2.5 px-3">Paciente</th>
              <th className="py-2.5 px-3">Estudio / Médico</th>
              <th className="py-2.5 px-3 text-right">Total Facturado</th>
              <th className="py-2.5 px-3">Desglose de Pago Multimoneda</th>
              <th className="py-2.5 px-3 text-center">Estado</th>
              <th className="py-2.5 px-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {facturasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 text-xs font-medium">
                  No se encontraron comprobantes para los filtros seleccionados
                </td>
              </tr>
            ) : (
              facturasFiltradas.map((f) => {
                const isAnulada = esAnulada(f.estado);
                const tasaFactura = Number(f.tasa_bcv || tasaBcv);
                const totalBsFactura = Number(f.precio_usd || 0) * tasaFactura;

                return (
                  <tr 
                    key={f.id} 
                    className={`hover:bg-slate-50/60 transition-colors ${isAnulada ? 'opacity-50 bg-slate-50/40 line-through' : ''}`}
                  >
                    <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                      #{f.turno_num ? String(f.turno_num).padStart(3, '0') : f.id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {f.hora ? f.hora.slice(0, 5) : '--:--'}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-900 leading-tight">{f.nombre_paciente}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{f.cedula_paciente}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-800 line-clamp-1">{f.estudio}</p>
                      <p className="text-[10px] text-cyan-700 font-medium">{f.medico || 'Médico de Guardia'}</p>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <p className="font-black text-slate-900 text-sm">
                        ${Number(f.precio_usd || 0).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold">
                        Bs. {totalBsFactura.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {Number(f.pago_divisas || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-mono font-bold">
                            ${Number(f.pago_divisas).toFixed(2)} (Bs. {(Number(f.pago_divisas) * tasaFactura).toFixed(2)})
                          </span>
                        )}
                        {Number(f.pago_efectivo_bs || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-mono font-bold">
                            Bs.{Number(f.pago_efectivo_bs).toFixed(2)}
                          </span>
                        )}
                        {Number(f.pago_punto || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[10px] font-mono font-bold">
                            Punto: Bs.{Number(f.pago_punto).toFixed(2)}
                          </span>
                        )}
                        {Number(f.pago_movil || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-900 text-[10px] font-mono font-bold">
                            PM: Bs.{Number(f.pago_movil).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isAnulada ? (
                        <Badge variant="destructive" className="text-[10px] font-bold">
                          ANULADA
                        </Badge>
                      ) : String(f.etapa_actual) === '2' || f.estado === 'FINALIZADO' ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold">
                          FINALIZADO
                        </Badge>
                      ) : String(f.etapa_actual) === '1' || f.estado === 'ATENCION' ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] font-bold">
                          EN ATENCIÓN
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-600 hover:bg-blue-700 text-[10px] font-bold">
                          EN ESPERA
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => verTicket(f)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                          title="Ver Comprobante Térmico"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!isAnulada && (
                          <button
                            disabled={anulandoId === f.id}
                            onClick={() => handleAnular(f.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Anular Factura"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  </Card>
);
