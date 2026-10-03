'use client';

import React from 'react';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Paperclip, CheckCircle2, Clock, AlertTriangle, RefreshCw, Eye, Filter, FolderTree } from 'lucide-react';
import { normalizarCedulaRif, sonMismoDocumento } from '@/lib/cedulaRif';
import { esAnulada } from '@/lib/estados';
import { FacturaCaja } from '@/types';
import type { PacienteData } from '../ModuloHistorialPacientes';
import { parseFechaLocal } from '@/lib/date';

interface TablaMovimientosHistorialProps {
  cargandoMovimientos: boolean;
  movimientosFiltrados: FacturaCaja[];
  hayFiltrosActivos: boolean;
  limpiarTodosLosFiltros: () => void;
  pacienteSeleccionado: PacienteData | null;
  agrupacion: "NINGUNA" | "FECHA" | "TIPO_ESTUDIO" | "MEDICO" | "PACIENTE";
  movimientosAgrupados: Record<string, FacturaCaja[]> | null;
  formatUSD: (val?: number | string | null) => string;
  pacientesDirectorio: PacienteData[];
  cargarMovimientosPaciente: (paciente: PacienteData) => Promise<void>;
  setFacturaDetalle: React.Dispatch<React.SetStateAction<FacturaCaja | null>>;
}

export const TablaMovimientosHistorial: React.FC<TablaMovimientosHistorialProps> = ({ cargandoMovimientos, movimientosFiltrados, hayFiltrosActivos, limpiarTodosLosFiltros, pacienteSeleccionado, agrupacion, movimientosAgrupados, formatUSD, pacientesDirectorio, cargarMovimientosPaciente, setFacturaDetalle }) => (
  <CardContent className="p-0">
    {cargandoMovimientos ? (
      <div className="p-12 text-center space-y-2">
        <RefreshCw className="w-6 h-6 animate-spin text-clinica-primary mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Cargando movimientos clínicos...</p>
      </div>
    ) : movimientosFiltrados.length === 0 ? (
      <div className="p-12 text-center space-y-2">
        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl mx-auto flex items-center justify-center">
          <Filter className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-700">Sin movimientos con los filtros aplicados</p>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No se encontraron atenciones o estudios que coincidan con los criterios seleccionados. Intente ajustar o restablecer los filtros.
        </p>
        {hayFiltrosActivos && (
          <Button
            size="sm"
            variant="outline"
            onClick={limpiarTodosLosFiltros}
            className="mt-2 text-xs font-bold rounded-xl border-slate-200"
          >
            Restablecer Filtros
          </Button>
        )}
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Fecha / Hora</th>
              <th className="py-3 px-3">N° Control</th>
              {!pacienteSeleccionado && <th className="py-3 px-3">Paciente</th>}
              <th className="py-3 px-4">Estudio Realizado</th>
              <th className="py-3 px-3">Médico</th>
              <th className="py-3 px-3">Total / Pagos</th>
              <th className="py-3 px-3 text-center">Estado</th>
              <th className="py-3 px-3">Imágenes / Informe</th>
              <th className="py-3 px-3 text-center">WhatsApp</th>
              <th className="py-3 px-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* RENDERIZADO AGRUPADO O PLANO */}
            {agrupacion !== 'NINGUNA' && movimientosAgrupados ? (
              Object.entries(movimientosAgrupados).map(([nombreGrupo, listaEnGrupo]) => {
                const subtotalGrupo = listaEnGrupo
                  .filter(x => !esAnulada(x.estado))
                  .reduce((acc, x) => acc + (parseFloat(String(x.precio_usd)) || 0), 0);

                const colSpanTotal = !pacienteSeleccionado ? 10 : 9;

                return (
                  <React.Fragment key={nombreGrupo}>
                    {/* Encabezado del Grupo */}
                    <tr className="bg-slate-100/90 border-y border-slate-200">
                      <td colSpan={colSpanTotal} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FolderTree className="w-4 h-4 text-clinica-primary" />
                            <span className="font-black text-slate-800 text-xs tracking-tight">
                              {nombreGrupo}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono bg-white text-slate-700 ml-1">
                              {listaEnGrupo.length} {listaEnGrupo.length === 1 ? 'estudio' : 'estudios'}
                            </Badge>
                          </div>
                          <span className="font-mono text-emerald-800 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Subtotal: {formatUSD(subtotalGrupo)}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {listaEnGrupo.map((m) => {
                      const fechaFormateada = m.fecha ? parseFechaLocal(m.fecha).toLocaleDateString('es-VE') : 'N/A';
                      const tieneAdjunto = Boolean(m.adjunto_nombre);
                      const waEnviado = Boolean(m.whatsapp_enviado);

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Fecha y Hora */}
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900">{fechaFormateada}</p>
                            <p className="text-[10px] text-slate-400">{m.hora || '--:--'}</p>
                          </td>

                          {/* N° Control / ID Factura */}
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg text-[10px]">
                              #{m.id} {m.turno_num ? `(T-${m.turno_num})` : ''}
                            </span>
                          </td>

                          {/* Paciente (si estamos en vista global) */}
                          {!pacienteSeleccionado && (
                            <td className="py-3 px-3 max-w-[170px]">
                              <div
                                onClick={() => {
                                  const matchP = pacientesDirectorio.find(p => sonMismoDocumento(p.cedula, m.cedula_paciente));
                                  if (matchP) {
                                    cargarMovimientosPaciente(matchP);
                                  } else {
                                    cargarMovimientosPaciente({
                                      cedula: m.cedula_paciente || '',
                                      nombre: m.nombre_paciente || '',
                                      telefono: m.telefono_paciente || undefined
                                    });
                                  }
                                }}
                                className="cursor-pointer group"
                                title="Haga clic para filtrar exclusivamente por este paciente"
                              >
                                <p className="font-bold text-slate-900 truncate group-hover:text-clinica-primary transition-colors">
                                  {m.nombre_paciente || 'Paciente'}
                                </p>
                                <p className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-clinica-primary transition-colors">
                                  {normalizarCedulaRif(m.cedula_paciente || '')}
                                </p>
                              </div>
                            </td>
                          )}

                          {/* Estudio Realizado */}
                          <td className="py-3 px-4 max-w-[200px]">
                            <p className="font-bold text-slate-800 truncate" title={m.estudio}>
                              {m.estudio}
                            </p>
                            {m.servicios && Array.isArray(m.servicios) && m.servicios.length > 1 && (
                              <Badge variant="outline" className="text-[9px] font-bold text-clinica-primary border-clinica-primary/30 mt-0.5">
                                {m.servicios.length} estudios en paquete
                              </Badge>
                            )}
                          </td>

                          {/* Médico */}
                          <td className="py-3 px-3 text-slate-600 truncate max-w-[120px]" title={m.medico}>
                            {m.medico || 'De Guardia'}
                          </td>

                          {/* Total / Desglose Pagos */}
                          <td className="py-3 px-3">
                            <p className="font-bold font-mono text-slate-900">
                              {formatUSD(m.precio_usd)}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-500 font-mono">
                              {parseFloat(String(m.pago_divisas)) > 0 && (
                                <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                                  Div: {formatUSD(m.pago_divisas)}
                                </span>
                              )}
                              {(parseFloat(String(m.pago_movil)) > 0 || parseFloat(String(m.pago_punto)) > 0) && (
                                <span className="text-blue-700 bg-blue-50 px-1 rounded">
                                  Bs
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Estado Clínico */}
                          <td className="py-3 px-3 text-center">
                            {m.estado === 'FINALIZADO' || m.estado === 'COMPLETADO' ? (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200">
                                Culminado
                              </Badge>
                            ) : esAnulada(m.estado) ? (
                              <Badge className="bg-rose-100 text-rose-800 text-[9px] font-bold border border-rose-200">
                                Anulado
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-200">
                                {m.estado || 'En Sala'}
                              </Badge>
                            )}
                          </td>

                          {/* Imágenes / Informe Adjunto */}
                          <td className="py-3 px-3">
                            {tieneAdjunto ? (
                              <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-mono bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/60 max-w-[150px] truncate">
                                <Paperclip className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="truncate" title={m.adjunto_nombre}>
                                  {m.adjunto_nombre}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <AlertTriangle className="w-3 h-3 text-slate-300" />
                                <span>Sin adjunto</span>
                              </div>
                            )}
                          </td>

                          {/* Estado de WhatsApp */}
                          <td className="py-3 px-3 text-center">
                            {waEnviado ? (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200 flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Enviado</span>
                              </Badge>
                            ) : tieneAdjunto ? (
                              <Badge className="bg-amber-50 text-amber-800 text-[9px] font-bold border border-amber-200 flex items-center justify-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Listo WA</span>
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-400 text-[9px] font-bold border border-slate-200">
                                Inactivo
                              </Badge>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setFacturaDetalle(m)}
                              className="h-7 px-2 text-xs font-bold text-clinica-primary hover:bg-clinica-selection rounded-lg"
                              title="Ver detalle completo de la factura y servicios"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              <span>Detalle</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })
            ) : (
              movimientosFiltrados.map((m) => {
                const fechaFormateada = m.fecha ? parseFechaLocal(m.fecha).toLocaleDateString('es-VE') : 'N/A';
                const tieneAdjunto = Boolean(m.adjunto_nombre);
                const waEnviado = Boolean(m.whatsapp_enviado);

                return (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Fecha y Hora */}
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{fechaFormateada}</p>
                      <p className="text-[10px] text-slate-400">{m.hora || '--:--'}</p>
                    </td>

                    {/* N° Control / ID Factura */}
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg text-[10px]">
                        #{m.id} {m.turno_num ? `(T-${m.turno_num})` : ''}
                      </span>
                    </td>

                    {/* Paciente (si estamos en vista global) */}
                    {!pacienteSeleccionado && (
                      <td className="py-3 px-3 max-w-[170px]">
                        <div
                          onClick={() => {
                            const matchP = pacientesDirectorio.find(p => sonMismoDocumento(p.cedula, m.cedula_paciente));
                            if (matchP) {
                              cargarMovimientosPaciente(matchP);
                            } else {
                              cargarMovimientosPaciente({
                                cedula: m.cedula_paciente || '',
                                nombre: m.nombre_paciente || '',
                                telefono: m.telefono_paciente || undefined
                              });
                            }
                          }}
                          className="cursor-pointer group"
                          title="Haga clic para filtrar exclusivamente por este paciente"
                        >
                          <p className="font-bold text-slate-900 truncate group-hover:text-clinica-primary transition-colors">
                            {m.nombre_paciente || 'Paciente'}
                          </p>
                          <p className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-clinica-primary transition-colors">
                            {normalizarCedulaRif(m.cedula_paciente || '')}
                          </p>
                        </div>
                      </td>
                    )}

                    {/* Estudio Realizado */}
                    <td className="py-3 px-4 max-w-[200px]">
                      <p className="font-bold text-slate-800 truncate" title={m.estudio}>
                        {m.estudio}
                      </p>
                      {m.servicios && Array.isArray(m.servicios) && m.servicios.length > 1 && (
                        <Badge variant="outline" className="text-[9px] font-bold text-clinica-primary border-clinica-primary/30 mt-0.5">
                          {m.servicios.length} estudios en paquete
                        </Badge>
                      )}
                    </td>

                    {/* Médico */}
                    <td className="py-3 px-3 text-slate-600 truncate max-w-[120px]" title={m.medico}>
                      {m.medico || 'De Guardia'}
                    </td>

                    {/* Total / Desglose Pagos */}
                    <td className="py-3 px-3">
                      <p className="font-bold font-mono text-slate-900">
                        {formatUSD(m.precio_usd)}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-500 font-mono">
                        {parseFloat(String(m.pago_divisas)) > 0 && (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                            Div: {formatUSD(m.pago_divisas)}
                          </span>
                        )}
                        {(parseFloat(String(m.pago_movil)) > 0 || parseFloat(String(m.pago_punto)) > 0) && (
                          <span className="text-blue-700 bg-blue-50 px-1 rounded">
                            Bs
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Estado Clínico */}
                    <td className="py-3 px-3 text-center">
                      {m.estado === 'FINALIZADO' || m.estado === 'COMPLETADO' ? (
                        <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200">
                          Culminado
                        </Badge>
                      ) : esAnulada(m.estado) ? (
                        <Badge className="bg-rose-100 text-rose-800 text-[9px] font-bold border border-rose-200">
                          Anulado
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-200">
                          {m.estado || 'En Sala'}
                        </Badge>
                      )}
                    </td>

                    {/* Imágenes / Informe Adjunto */}
                    <td className="py-3 px-3">
                      {tieneAdjunto ? (
                        <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-mono bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/60 max-w-[150px] truncate">
                          <Paperclip className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate" title={m.adjunto_nombre}>
                            {m.adjunto_nombre}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <AlertTriangle className="w-3 h-3 text-slate-300" />
                          <span>Sin adjunto</span>
                        </div>
                      )}
                    </td>

                    {/* Estado de WhatsApp */}
                    <td className="py-3 px-3 text-center">
                      {waEnviado ? (
                        <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Enviado</span>
                        </Badge>
                      ) : tieneAdjunto ? (
                        <Badge className="bg-amber-50 text-amber-800 text-[9px] font-bold border border-amber-200 flex items-center justify-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Listo WA</span>
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-400 text-[9px] font-bold border border-slate-200">
                          Inactivo
                        </Badge>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFacturaDetalle(m)}
                        className="h-7 px-2 text-xs font-bold text-clinica-primary hover:bg-clinica-selection rounded-lg"
                        title="Ver detalle completo de la factura y servicios"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        <span>Detalle</span>
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    )}
  </CardContent>
);
