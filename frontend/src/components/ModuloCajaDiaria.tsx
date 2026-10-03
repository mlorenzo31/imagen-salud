'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, Filter, CheckCircle2, Clock, RefreshCw, Layers, FileSpreadsheet, FileText } from 'lucide-react';import { FacturaCaja, UserRole } from '@/types';
import { exportarAExcel, exportarAPDF } from '@/lib/exportUtils';
import { hoyLocal, sumarDias } from '@/lib/date';
import { esAnulada } from '@/lib/estados';
import { TicketTermico } from '@/components/cajadiaria/TicketTermico';
import { TablaFacturasCaja } from '@/components/cajadiaria/TablaFacturasCaja';
import { BarraBusquedaCaja } from '@/components/cajadiaria/BarraBusquedaCaja';

interface ModuloCajaDiariaProps {
  currentRole: UserRole;
}

export type GrupoClinicoFiltro = 'NINGUNO' | 'MEDICO' | 'AREA' | 'ESTADO' | 'METODO_PAGO' | 'FECHA';

export const ModuloCajaDiaria: React.FC<ModuloCajaDiariaProps> = ({ currentRole }) => {
  const [facturas, setFacturas] = useState<FacturaCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaCaja | null>(null);
  const [mostrarModalTicket, setMostrarModalTicket] = useState(false);
  const [anulandoId, setAnulandoId] = useState<number | null>(null);

  // Tasa Oficial BCV
  const [tasaBcv, setTasaBcv] = useState<number>(0);

  // === MOTOR DE BÚSQUEDA Y SEGMENTACIÓN: BUSCADOR, FILTROS Y AGRUPACIONES ===
  const [busquedaTexto, setBusquedaTexto] = useState<string>('');
  const [menuFiltrosAbierto, setMenuFiltrosAbierto] = useState<boolean>(false);
  
  // Filtros Activos (Etiquetas de Filtrado)
  const [filtroPeriodo, setFiltroPeriodo] = useState<'HOY' | 'SEMANA' | 'MES' | 'TODOS'>('HOY');
  const [filtroEstados, setFiltroEstados] = useState<string[]>([]);
  const [filtroSoloDivisas, setFiltroSoloDivisas] = useState<boolean>(false);
  const [filtroSoloBs, setFiltroSoloBs] = useState<boolean>(false);
  const [filtroMontoMayor50, setFiltroMontoMayor50] = useState<boolean>(false);
  
  // Agrupación Activa (Clinico Group By)
  const [agruparPor, setAgruparPor] = useState<GrupoClinicoFiltro>('NINGUNO');
  const [gruposColapsados, setGruposColapsados] = useState<Record<string, boolean>>({});

  const cargarTasaBcv = async () => {
    try {
      const res = await fetch('/api/bcv');
      if (res.ok) {
        const data = await res.json();
        if (data && data.tasa) setTasaBcv(Number(parseFloat(data.tasa).toFixed(2)));
      }
    } catch (e) {
      console.warn('Error cargando tasa BCV en Caja:', e);
    }
  };

  const cargarFacturas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/facturas');
      if (res.ok) {
        const data = await res.json();
        setFacturas(data);
      }
    } catch (err) {
      console.error('Error cargando facturas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTasaBcv();
    cargarFacturas();
  }, []);

  // Helper de fechas para filtros
  const hoyStr = hoyLocal();
  const fechaUnaSemanaAtras = sumarDias(hoyLocal(), -7);
  const mesActualStr = hoyStr.slice(0, 7);

  // Filtrado estilo Clinico
  const facturasFiltradas = useMemo(() => {
    return facturas.filter(f => {
      // 1. Filtro Período
      if (filtroPeriodo === 'HOY' && !f.fecha.startsWith(hoyStr)) return false;
      if (filtroPeriodo === 'SEMANA' && f.fecha < fechaUnaSemanaAtras) return false;
      if (filtroPeriodo === 'MES' && !f.fecha.startsWith(mesActualStr)) return false;

      // 2. Filtro Estados
      if (filtroEstados.length > 0) {
        const matchesEstado = filtroEstados.includes(f.estado) || 
          (f.etapa_actual !== undefined && filtroEstados.includes(String(f.etapa_actual)));
        if (!matchesEstado) return false;
      }

      // 3. Filtros Específicos
      if (filtroSoloDivisas && Number(f.pago_divisas || 0) <= 0) return false;
      if (filtroSoloBs && (Number(f.pago_efectivo_bs || 0) + Number(f.pago_punto || 0) + Number(f.pago_movil || 0)) <= 0) return false;
      if (filtroMontoMayor50 && Number(f.precio_usd || 0) < 50) return false;

      // 4. Búsqueda por texto (Paciente, Cédula, Folio, Médico, Estudio)
      const q = busquedaTexto.toLowerCase().trim();
      if (q) {
        const matchNombre = f.nombre_paciente && f.nombre_paciente.toLowerCase().includes(q);
        const matchCedula = f.cedula_paciente && f.cedula_paciente.toLowerCase().includes(q);
        const matchFolio = f.id && String(f.id).includes(q);
        const matchTurno = f.turno_num && String(f.turno_num).includes(q);
        const matchMedico = f.medico && f.medico.toLowerCase().includes(q);
        const matchEstudio = f.estudio && f.estudio.toLowerCase().includes(q);
        if (!matchNombre && !matchCedula && !matchFolio && !matchTurno && !matchMedico && !matchEstudio) {
          return false;
        }
      }

      return true;
    });
  }, [facturas, filtroPeriodo, filtroEstados, filtroSoloDivisas, filtroSoloBs, filtroMontoMayor50, busquedaTexto, hoyStr, fechaUnaSemanaAtras, mesActualStr]);

  // Agrupación dinámica estilo Clinico Tree/Group View
  const grupos = useMemo(() => {
    if (agruparPor === 'NINGUNO') return null;

    const mapGrupos: Record<string, FacturaCaja[]> = {};

    facturasFiltradas.forEach(f => {
      let clave = 'Sin clasificar';

      if (agruparPor === 'MEDICO') {
        clave = f.medico ? f.medico.trim() : 'De Guardia / Sin Médico';
      } else if (agruparPor === 'AREA') {
        const est = f.estudio ? f.estudio.toUpperCase() : '';
        if (est.includes('ECO')) clave = 'Ecografía';
        else if (est.includes('RAYOS') || est.includes('TÓRAX') || est.includes('COLUMNA')) clave = 'Radiología';
        else if (est.includes('MAMOGRAFÍA')) clave = 'Mamografía';
        else if (est.includes('CONSULTA')) clave = 'Consultas Médicas';
        else if (est.includes('BIOPSIA') || est.includes('CITOLOGÍA')) clave = 'Ginecología & Patología';
        else clave = 'Otros Procedimientos';
      } else if (agruparPor === 'ESTADO') {
        clave = esAnulada(f.estado) ? 'Anuladas' :
                String(f.etapa_actual) === '2' || f.estado === 'FINALIZADO' ? 'Finalizadas / Atendidas' :
                String(f.etapa_actual) === '1' || f.estado === 'ATENCION' ? 'En Atención' : 'En Espera';
      } else if (agruparPor === 'METODO_PAGO') {
        if (Number(f.pago_divisas || 0) > 0 && (Number(f.pago_punto || 0) + Number(f.pago_movil || 0) + Number(f.pago_efectivo_bs || 0)) > 0) {
          clave = 'Pago Mixto (Divisas + Bolívares)';
        } else if (Number(f.pago_divisas || 0) > 0) {
          clave = 'Efectivo Divisas ($)';
        } else if (Number(f.pago_punto || 0) > 0) {
          clave = 'Punto de Venta POS (Bs)';
        } else if (Number(f.pago_movil || 0) > 0) {
          clave = 'Pago Móvil (Bs)';
        } else if (Number(f.pago_efectivo_bs || 0) > 0) {
          clave = 'Efectivo Bolívares (Bs)';
        } else {
          clave = 'Sin Forma de Pago Registrada';
        }
      } else if (agruparPor === 'FECHA') {
        clave = f.fecha ? f.fecha.slice(0, 10) : 'Sin Fecha';
      }

      if (!mapGrupos[clave]) mapGrupos[clave] = [];
      mapGrupos[clave].push(f);
    });

    return Object.entries(mapGrupos).map(([nombreGrupo, items]) => {
      const subtotalUSD = items.filter(x => !esAnulada(x.estado)).reduce((sum, x) => sum + Number(x.precio_usd || 0), 0);
      const subtotalBs = subtotalUSD * tasaBcv;
      return {
        nombreGrupo,
        items,
        subtotalUSD,
        subtotalBs,
        totalItems: items.length
      };
    });
  }, [facturasFiltradas, agruparPor, tasaBcv]);

  // Toggle colapsar grupo
  const toggleColapsarGrupo = (nombre: string) => {
    setGruposColapsados(prev => ({ ...prev, [nombre]: !prev[nombre] }));
  };

  // Toggle estado de filtro
  const toggleFiltroEstado = (est: string) => {
    setFiltroEstados(prev => 
      prev.includes(est) ? prev.filter(x => x !== est) : [...prev, est]
    );
  };

  // Métricas Multimoneda
  const facturasActivas = facturasFiltradas.filter(f => !esAnulada(f.estado));
  const totalFacturas = facturasFiltradas.length;
  const totalCobradoUSD = facturasActivas.reduce((sum, f) => sum + Number(f.precio_usd || 0), 0);
  const totalCobradoBs = totalCobradoUSD * tasaBcv;

  const totalDivisasUSD = facturasActivas.reduce((sum, f) => sum + Number(f.pago_divisas || 0), 0);
  const totalDivisasEquivBs = totalDivisasUSD * tasaBcv;

  const totalEfectivoBs = facturasActivas.reduce((sum, f) => sum + Number(f.pago_efectivo_bs || 0), 0);
  const totalEfectivoEquivUSD = tasaBcv > 0 ? totalEfectivoBs / tasaBcv : 0;

  const totalPuntoBs = facturasActivas.reduce((sum, f) => sum + Number(f.pago_punto || 0), 0);
  const totalPuntoEquivUSD = tasaBcv > 0 ? totalPuntoBs / tasaBcv : 0;

  const totalPagoMovilBs = facturasActivas.reduce((sum, f) => sum + Number(f.pago_movil || 0), 0);
  const totalPagoMovilEquivUSD = tasaBcv > 0 ? totalPagoMovilBs / tasaBcv : 0;

  const totalAnuladas = facturasFiltradas.filter(f => esAnulada(f.estado)).length;

  // Anular factura
  const handleAnular = async (id: number) => {
    if (!confirm('¿Está seguro de anular esta factura? Esta acción quedará auditada.')) return;
    setAnulandoId(id);
    try {
      const res = await fetch(`/api/facturas/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'ANULADA', etapa_actual: 2 })
      });
      if (res.ok) {
        alert('Factura anulada con éxito.');
        cargarFacturas();
      } else {
        alert('Error al anular la factura.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    } finally {
      setAnulandoId(null);
    }
  };

  const verTicket = (factura: FacturaCaja) => {
    setFacturaSeleccionada(factura);
    setMostrarModalTicket(true);
  };

  const handleExportarExcel = () => {
    if (facturasFiltradas.length === 0) {
      alert('No hay facturas filtradas para exportar.');
      return;
    }

    const filas = facturasFiltradas.map(f => {
      const isAnulada = esAnulada(f.estado);
      const precioUSD = Number(f.precio_usd || 0);
      const tasa = Number(f.tasa_bcv || tasaBcv);
      const totalBS = precioUSD * tasa;

      return {
        'N° Registro': `#${f.id}`,
        'Fecha': f.fecha || 'N/A',
        'Hora': f.hora || 'N/A',
        'Paciente': f.nombre_paciente || 'Sin nombre',
        'Cédula': f.cedula_paciente || 'N/A',
        'Estudio / Servicio': f.estudio || 'N/A',
        'Médico / Especialista': f.medico || 'N/A',
        'Monto USD': isAnulada ? 0 : precioUSD,
        'Monto Bs': isAnulada ? 0 : totalBS,
        'Tasa BCV': tasa,
        'Efectivo Divisas ($)': Number(f.pago_divisas || 0),
        'Efectivo Bs': Number(f.pago_efectivo_bs || 0),
        'Punto POS Bs': Number(f.pago_punto || 0),
        'Pago Móvil Bs': Number(f.pago_movil || 0),
        'Estado': isAnulada ? 'ANULADA' : f.estado,
        'Etapa': String(f.etapa_actual) === '2' ? 'FINALIZADO' : String(f.etapa_actual) === '1' ? 'ATENCIÓN' : 'ESPERA',
        'Grupo Clinico': agruparPor !== 'NINGUNO' ? agruparPor : 'General'
      };
    });

    exportarAExcel('Caja_Diaria_Imagen_Salud', [
      { nombreHoja: 'Transacciones Filtradas', data: filas }
    ]);
  };

  const handleExportarPDF = () => {
    if (facturasFiltradas.length === 0) {
      alert('No hay facturas filtradas para exportar.');
      return;
    }

    const totalUSD = facturasFiltradas
      .filter(f => !esAnulada(f.estado))
      .reduce((acc, f) => acc + Number(f.precio_usd || 0), 0);
    const totalBS = totalUSD * tasaBcv;

    const filas = facturasFiltradas.map(f => {
      const isAnulada = esAnulada(f.estado);
      const precioUSD = Number(f.precio_usd || 0);
      const tasa = Number(f.tasa_bcv || tasaBcv);
      const totalBsRec = precioUSD * tasa;

      return [
        `#${f.id}`,
        f.fecha || 'N/A',
        (f.nombre_paciente || 'Sin nombre').slice(0, 20),
        f.cedula_paciente || 'N/A',
        (f.estudio || 'N/A').slice(0, 24),
        (f.medico || 'N/A').slice(0, 16),
        `$${precioUSD.toFixed(2)}`,
        `Bs. ${totalBsRec.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        isAnulada ? 'ANULADA' : String(f.etapa_actual) === '2' ? 'LISTO' : 'PROCESO'
      ];
    });

    const filtrosActivosText: string[] = [];
    if (busquedaTexto) filtrosActivosText.push(`Búsqueda: "${busquedaTexto}"`);
    filtrosActivosText.push(`Período: ${filtroPeriodo}`);
    if (filtroEstados.length > 0) filtrosActivosText.push(`Estados: ${filtroEstados.join(', ')}`);
    if (filtroSoloDivisas) filtrosActivosText.push('Solo Divisas ($)');
    if (filtroSoloBs) filtrosActivosText.push('Solo Bolívares (Bs)');
    if (filtroMontoMayor50) filtrosActivosText.push('Ticket > $50');
    if (agruparPor !== 'NINGUNO') filtrosActivosText.push(`Agrupado: ${agruparPor}`);

    exportarAPDF({
      titulo: 'REPORTE DE CAJA DIARIA E HISTORIAL CONTABLE',
      subtitulo: `Centro Clínico Radiológico Imagen Salud, C.A. — Tasa BCV Oficial: Bs. ${tasaBcv.toFixed(2)}`,
      nombreArchivo: 'Reporte_Caja_Diaria',
      filtrosAplicados: filtrosActivosText,
      kpis: [
        { label: 'Total Recaudado USD', valor: `$${totalUSD.toFixed(2)}` },
        { label: 'Total Recaudado Bs', valor: `Bs. ${totalBS.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
        { label: 'Facturas Filtradas', valor: `${facturasFiltradas.length}` },
        { label: 'Tasa BCV Aplicada', valor: `Bs. ${tasaBcv.toFixed(2)}` }
      ],
      columnas: ['Recibo', 'Fecha', 'Paciente', 'Cédula', 'Estudio', 'Médico', 'Total $', 'Total Bs', 'Estado'],
      filas: filas
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-cyan-600" />
            Caja Diaria e Historial con Filtros Clínicos Avanzados
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Buscador unificado, filtros multifacéticos y árbol de agrupaciones dinámicas (Group By)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-slate-900 text-white font-mono text-xs px-3 py-1">
            BCV: Bs. {tasaBcv.toFixed(2)}
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { cargarTasaBcv(); cargarFacturas(); }}
            disabled={loading}
            className="rounded-xl text-xs flex items-center gap-1.5 border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
          <Button
            size="sm"
            onClick={handleExportarExcel}
            disabled={facturasFiltradas.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </Button>
          <Button
            size="sm"
            onClick={handleExportarPDF}
            disabled={facturasFiltradas.length === 0}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm shadow-slate-800/20 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF (.pdf)</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards de Arqueo Multimoneda */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facturas Totales</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalFacturas}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{facturasActivas.length} activas • {totalAnuladas} anuladas</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/70 border-emerald-200">
          <CardContent className="p-3.5">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total Facturado</p>
            <p className="text-xl font-black text-emerald-950 mt-1">${totalCobradoUSD.toFixed(2)}</p>
            <p className="text-[11px] font-mono font-bold text-emerald-800 mt-0.5">
              Bs. {totalCobradoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Efectivo Divisas</p>
            <p className="text-xl font-black text-emerald-600 mt-1">${totalDivisasUSD.toFixed(2)}</p>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
              ≈ Bs. {totalDivisasEquivBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Efectivo Bs</p>
            <p className="text-lg font-black text-blue-600 mt-1">
              Bs. {totalEfectivoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
              ≈ ${totalEfectivoEquivUSD.toFixed(2)} USD
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Punto de Venta</p>
            <p className="text-lg font-black text-indigo-600 mt-1">
              Bs. {totalPuntoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
              ≈ ${totalPuntoEquivUSD.toFixed(2)} USD
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pago Móvil</p>
            <p className="text-lg font-black text-cyan-600 mt-1">
              Bs. {totalPagoMovilBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
              ≈ ${totalPagoMovilEquivUSD.toFixed(2)} USD
            </p>
          </CardContent>
        </Card>
      </div>

      {/* === BARRA DE BÚSQUEDA Y CONTROL CLÍNICO === */}
      <Card className="bg-white border-slate-300 shadow-md rounded-2xl overflow-visible">
        <CardContent className="p-4 space-y-3">
          
          {/* Barra Unificada de Búsqueda con Chips Clinico */}
          <BarraBusquedaCaja filtroPeriodo={filtroPeriodo} setFiltroPeriodo={setFiltroPeriodo} filtroEstados={filtroEstados} toggleFiltroEstado={toggleFiltroEstado} filtroSoloDivisas={filtroSoloDivisas} setFiltroSoloDivisas={setFiltroSoloDivisas} filtroSoloBs={filtroSoloBs} setFiltroSoloBs={setFiltroSoloBs} filtroMontoMayor50={filtroMontoMayor50} setFiltroMontoMayor50={setFiltroMontoMayor50} agruparPor={agruparPor} setAgruparPor={setAgruparPor} busquedaTexto={busquedaTexto} setBusquedaTexto={setBusquedaTexto} setMenuFiltrosAbierto={setMenuFiltrosAbierto} menuFiltrosAbierto={menuFiltrosAbierto} />

          {/* Menú Desplegable Estilo Clinico con Secciones Separadas */}
          {menuFiltrosAbierto && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in-50 duration-200">
              
              {/* SECCIÓN 1: FILTROS PREDETERMINADOS */}
              <div className="space-y-2 border-r border-slate-200/80 pr-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-3 h-3 text-cyan-600" />
                  <span>Filtros Rápidos</span>
                </p>
                <div className="space-y-1">
                  {[
                    { id: 'HOY', label: 'Jornada de Hoy' },
                    { id: 'SEMANA', label: 'Últimos 7 Días' },
                    { id: 'MES', label: 'Mes en Curso' },
                    { id: 'TODOS', label: 'Todo el Histórico' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setFiltroPeriodo(p.id as Parameters<typeof setFiltroPeriodo>[0])}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                        filtroPeriodo === p.id 
                          ? 'bg-cyan-600 text-white font-bold' 
                          : 'text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{p.label}</span>
                      {filtroPeriodo === p.id && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200/80 space-y-1">
                  <button
                    onClick={() => setFiltroSoloDivisas(!filtroSoloDivisas)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                      filtroSoloDivisas ? 'bg-emerald-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>Solo Cobros en Divisas ($)</span>
                    {filtroSoloDivisas && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setFiltroSoloBs(!filtroSoloBs)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                      filtroSoloBs ? 'bg-purple-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>Solo Cobros en Bolívares (Bs)</span>
                    {filtroSoloBs && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setFiltroMontoMayor50(!filtroMontoMayor50)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                      filtroMontoMayor50 ? 'bg-amber-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>Ticket Alto (&gt; $50)</span>
                    {filtroMontoMayor50 && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* SECCIÓN 2: AGRUPAR POR CRITERIO CLÍNICO */}
              <div className="space-y-2 border-r border-slate-200/80 pr-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-indigo-600" />
                  <span>Agrupar Por (Group By)</span>
                </p>
                <div className="space-y-1">
                  {[
                    { id: 'NINGUNO', label: 'Ninguno (Lista Plana)' },
                    { id: 'AREA', label: 'Área Médica / Especialidad' },
                    { id: 'MEDICO', label: 'Médico Tratante' },
                    { id: 'ESTADO', label: 'Estado Clínico de Atención' },
                    { id: 'METODO_PAGO', label: 'Forma de Pago Principal' },
                    { id: 'FECHA', label: 'Fecha de Emisión' }
                  ].map(g => (
                    <button
                      key={g.id}
                      onClick={() => setAgruparPor(g.id as GrupoClinicoFiltro)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                        agruparPor === g.id 
                          ? 'bg-slate-900 text-white font-bold' 
                          : 'text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{g.label}</span>
                      {agruparPor === g.id && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECCIÓN 3: ESTADOS Y BOTÓN DE LIMPIAR */}
              <div className="space-y-2 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Clock className="w-3 h-3 text-blue-600" />
                    <span>Filtrar por Estado Clínico</span>
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['ESPERA', 'ATENCION', 'FINALIZADO', 'ANULADA'].map(st => {
                      const isSel = filtroEstados.includes(st);
                      return (
                        <button
                          key={st}
                          onClick={() => toggleFiltroEstado(st)}
                          className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                            isSel 
                              ? 'bg-blue-600 text-white border-blue-700' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {st === 'ESPERA' ? 'En Espera' : st === 'ATENCION' ? 'En Atención' : st === 'FINALIZADO' ? 'Finalizados' : 'Anuladas'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFiltroPeriodo('TODOS');
                      setFiltroEstados([]);
                      setFiltroSoloDivisas(false);
                      setFiltroSoloBs(false);
                      setFiltroMontoMayor50(false);
                      setAgruparPor('NINGUNO');
                      setBusquedaTexto('');
                    }}
                    className="w-full text-xs font-bold rounded-xl text-slate-600 border-slate-300 hover:bg-slate-200"
                  >
                    Restablecer Todos los Filtros
                  </Button>
                </div>
              </div>

            </div>
          )}

        </CardContent>
      </Card>

      {/* === VISTA DE TABLA CON SOPORTE DE AGRUPACIÓN (TREE/GROUP VIEW) === */}
      <TablaFacturasCaja facturasFiltradas={facturasFiltradas} agruparPor={agruparPor} grupos={grupos} totalCobradoUSD={totalCobradoUSD} totalCobradoBs={totalCobradoBs} gruposColapsados={gruposColapsados} toggleColapsarGrupo={toggleColapsarGrupo} tasaBcv={tasaBcv} verTicket={verTicket} anulandoId={anulandoId} handleAnular={handleAnular} />

      {/* Modal de Ticket Térmico Imprimible */}
      {mostrarModalTicket && facturaSeleccionada && (
        <TicketTermico facturaSeleccionada={facturaSeleccionada} tasaBcv={tasaBcv} setMostrarModalTicket={setMostrarModalTicket} />
      )}
    </div>
  );
};
