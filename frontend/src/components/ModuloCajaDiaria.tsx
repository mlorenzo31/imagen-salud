'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Receipt, 
  Search, 
  Filter, 
  Printer, 
  Ban, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  Calendar,
  Eye,
  RefreshCw,
  Building2,
  Phone,
  User,
  Landmark,
  CreditCard,
  Smartphone,
  Layers,
  ChevronDown,
  ChevronRight,
  X,
  SlidersHorizontal,
  FolderTree,
  CalendarDays,
  Sparkles,
  Stethoscope,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { FacturaCaja, UserRole } from '@/types';
import { exportarAExcel, exportarAPDF } from '@/lib/exportUtils';
import { hoyLocal, sumarDias } from '@/lib/date';

interface ModuloCajaDiariaProps {
  currentRole: UserRole;
}

type GrupoClinicoFiltro = 'NINGUNO' | 'MEDICO' | 'AREA' | 'ESTADO' | 'METODO_PAGO' | 'FECHA';

export const ModuloCajaDiaria: React.FC<ModuloCajaDiariaProps> = ({ currentRole }) => {
  const [facturas, setFacturas] = useState<FacturaCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaCaja | null>(null);
  const [mostrarModalTicket, setMostrarModalTicket] = useState(false);
  const [anulandoId, setAnulandoId] = useState<number | null>(null);

  // Tasa Oficial BCV
  const [tasaBcv, setTasaBcv] = useState<number>(832.49);

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
        clave = f.estado === 'ANULADA' ? 'Anuladas' :
                f.etapa_actual === '2' || f.estado === 'FINALIZADO' ? 'Finalizadas / Atendidas' :
                f.etapa_actual === '1' || f.estado === 'ATENCION' ? 'En Atención' : 'En Espera';
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
      const subtotalUSD = items.filter(x => x.estado !== 'ANULADA').reduce((sum, x) => sum + Number(x.precio_usd || 0), 0);
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
  const facturasActivas = facturasFiltradas.filter(f => f.estado !== 'ANULADA');
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

  const totalAnuladas = facturasFiltradas.filter(f => f.estado === 'ANULADA').length;

  // Anular factura
  const handleAnular = async (id: number) => {
    if (!confirm('¿Está seguro de anular esta factura? Esta acción quedará auditada.')) return;
    setAnulandoId(id);
    try {
      const res = await fetch(`/api/facturas/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'ANULADA', etapa_actual: 'FINALIZADO' })
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
      const isAnulada = f.estado === 'ANULADA';
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
        'Etapa': f.etapa_actual === '2' ? 'FINALIZADO' : f.etapa_actual === '1' ? 'ATENCIÓN' : 'ESPERA',
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
      .filter(f => f.estado !== 'ANULADA')
      .reduce((acc, f) => acc + Number(f.precio_usd || 0), 0);
    const totalBS = totalUSD * tasaBcv;

    const filas = facturasFiltradas.map(f => {
      const isAnulada = f.estado === 'ANULADA';
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
        isAnulada ? 'ANULADA' : f.etapa_actual === '2' ? 'LISTO' : 'PROCESO'
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
          <div className="relative flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-50 border-2 border-slate-300 focus-within:border-cyan-500 focus-within:bg-white transition-all">
            <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />

            {/* Chips de Filtros Activos (Etiquetas de Filtrado) */}
            {filtroPeriodo !== 'TODOS' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-100 text-cyan-900 text-xs font-bold border border-cyan-300">
                <CalendarDays className="w-3 h-3" />
                <span>{filtroPeriodo === 'HOY' ? 'Hoy' : filtroPeriodo === 'SEMANA' ? 'Últimos 7 Días' : 'Mes Actual'}</span>
                <button onClick={() => setFiltroPeriodo('TODOS')} className="hover:text-cyan-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroEstados.map(st => (
              <span key={st} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs font-bold border border-blue-300">
                <span>Estado: {st}</span>
                <button onClick={() => toggleFiltroEstado(st)} className="hover:text-blue-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {filtroSoloDivisas && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-300">
                <span>Divisas ($)</span>
                <button onClick={() => setFiltroSoloDivisas(false)} className="hover:text-emerald-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroSoloBs && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 text-xs font-bold border border-purple-300">
                <span>Bolívares (Bs)</span>
                <button onClick={() => setFiltroSoloBs(false)} className="hover:text-purple-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroMontoMayor50 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300">
                <span>Monto &gt; $50</span>
                <button onClick={() => setFiltroMontoMayor50(false)} className="hover:text-amber-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {agruparPor !== 'NINGUNO' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold">
                <FolderTree className="w-3 h-3 text-cyan-400" />
                <span>Agrupado por: {agruparPor}</span>
                <button onClick={() => setAgruparPor('NINGUNO')} className="hover:text-slate-300">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Input de Búsqueda Libre */}
            <input
              type="text"
              placeholder={agruparPor !== 'NINGUNO' ? "Buscar dentro de los grupos..." : "Buscar por paciente, cédula, turno, médico o estudio..."}
              value={busquedaTexto}
              onChange={(e) => setBusquedaTexto(e.target.value)}
              className="flex-1 min-w-[200px] bg-transparent border-0 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
            />

            {/* Botón Desplegable Clinico (Filtros & Agrupaciones) */}
            <button
              type="button"
              onClick={() => setMenuFiltrosAbierto(!menuFiltrosAbierto)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                menuFiltrosAbierto || agruparPor !== 'NINGUNO' || filtroEstados.length > 0
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros & Agrupaciones</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${menuFiltrosAbierto ? 'rotate-180' : ''}`} />
            </button>
          </div>

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
          <p className="text-[11px] text-slate-400">Total en vista: ${totalCobradoUSD.toFixed(2)} (Bs. {totalCobradoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
        </CardHeader>

        <div className="overflow-x-auto">
          {/* CASO 1: VISTA AGRUPADA (GROUP BY) */}
          {grupos ? (
            <div className="divide-y divide-slate-200">
              {grupos.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
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
                            const isAnulada = f.estado === 'ANULADA';
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
                                    f.etapa_actual === '2' || f.estado === 'FINALIZADO' ? 'bg-emerald-600' :
                                    f.etapa_actual === '1' || f.estado === 'ATENCION' ? 'bg-amber-500' : 'bg-blue-600'
                                  }>
                                    {isAnulada ? 'ANULADA' : f.etapa_actual === '2' || f.estado === 'FINALIZADO' ? 'LISTO' : f.etapa_actual === '1' || f.estado === 'ATENCION' ? 'ATENCIÓN' : 'ESPERA'}
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
                                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs font-medium">
                      No se encontraron comprobantes para los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  facturasFiltradas.map((f) => {
                    const isAnulada = f.estado === 'ANULADA';
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
                          <p className="text-[10px] text-slate-400 font-mono">{f.cedula_paciente}</p>
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
                          ) : f.etapa_actual === '2' || f.estado === 'FINALIZADO' ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold">
                              FINALIZADO
                            </Badge>
                          ) : f.etapa_actual === '1' || f.estado === 'ATENCION' ? (
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
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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

      {/* Modal de Ticket Térmico Imprimible */}
      {mostrarModalTicket && facturaSeleccionada && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            {/* Ticket Térmico Design */}
            <div id="ticket-termico" className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 font-mono text-xs text-slate-800">
              <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                <h3 className="font-black text-sm tracking-wider text-slate-900">IMAGEN SALUD C.A.</h3>
                <p className="text-[10px] text-slate-500">RIF: J-50123456-7</p>
                <p className="text-[10px] text-slate-500">Av. Principal, Edif. Clínico, Piso 1</p>
                <div className="mt-2 py-1 bg-slate-900 text-white rounded text-center">
                  <p className="font-black text-sm">TURNO #{facturaSeleccionada.turno_num ? String(facturaSeleccionada.turno_num).padStart(3, '0') : facturaSeleccionada.id}</p>
                </div>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2 mb-2">
                <p><span className="text-slate-400">Folio:</span> #{facturaSeleccionada.id}</p>
                <p><span className="text-slate-400">Fecha/Hora:</span> {facturaSeleccionada.fecha} {facturaSeleccionada.hora}</p>
                <p><span className="text-slate-400">Paciente:</span> {facturaSeleccionada.nombre_paciente}</p>
                <p><span className="text-slate-400">Cédula:</span> {facturaSeleccionada.cedula_paciente}</p>
                <p><span className="text-slate-400">Médico:</span> {facturaSeleccionada.medico || 'De Guardia'}</p>
              </div>

              <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Servicios:</p>
                <p className="font-bold text-slate-900">{facturaSeleccionada.estudio}</p>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2 mb-2">
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
                  <span>TOTAL FACTURADO:</span>
                  <span>${Number(facturaSeleccionada.precio_usd || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-cyan-800">
                  <span>EQUIVALENTE EN BS:</span>
                  <span>Bs. {(Number(facturaSeleccionada.precio_usd || 0) * Number(facturaSeleccionada.tasa_bcv || tasaBcv)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Tasa Oficial BCV:</span>
                  <span>Bs. {Number(facturaSeleccionada.tasa_bcv || tasaBcv).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1 text-[10px] text-slate-600">
                <p className="font-bold text-slate-700">Formas de Pago Aplicadas:</p>
                {Number(facturaSeleccionada.pago_divisas || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Efectivo Divisas ($):</span>
                    <span className="font-bold">${Number(facturaSeleccionada.pago_divisas).toFixed(2)}</span>
                  </div>
                )}
                {Number(facturaSeleccionada.pago_efectivo_bs || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Efectivo Bolívares:</span>
                    <span className="font-bold">Bs. {Number(facturaSeleccionada.pago_efectivo_bs).toFixed(2)}</span>
                  </div>
                )}
                {Number(facturaSeleccionada.pago_punto || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Punto de Venta:</span>
                    <span className="font-bold">Bs. {Number(facturaSeleccionada.pago_punto).toFixed(2)}</span>
                  </div>
                )}
                {Number(facturaSeleccionada.pago_movil || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Pago Móvil:</span>
                    <span className="font-bold">Bs. {Number(facturaSeleccionada.pago_movil).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[10px] text-slate-400 mt-4 pt-3 border-t border-dashed border-slate-300">
                <p>¡Gracias por su confianza!</p>
                <p>Favor esperar su llamado en sala por pantalla.</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setMostrarModalTicket(false)} 
                className="flex-1 rounded-xl text-xs"
              >
                Cerrar
              </Button>
              <Button 
                onClick={() => {
                  const texto = 'IMAGEN SALUD - COMPROBANTE DIGITAL\n' +
                    'Turno #' + (facturaSeleccionada.turno_num || facturaSeleccionada.id) + '\n' +
                    'Paciente: ' + facturaSeleccionada.nombre_paciente + '\n' +
                    'Estudio: ' + facturaSeleccionada.estudio + '\n' +
                    'Total: $' + Number(facturaSeleccionada.precio_usd || 0).toFixed(2);
                  navigator.clipboard.writeText(texto);
                  alert('Comprobante copiado al portapapeles. Impresión en papel desactivada.');
                }} 
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs flex items-center justify-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Copiar Digital</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
