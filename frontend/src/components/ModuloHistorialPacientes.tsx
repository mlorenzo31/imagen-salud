'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader } from '@/components/ui/card';import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, History, Globe, DollarSign, Paperclip, RefreshCw, Download, Printer, MessageCircle, Activity, X } from 'lucide-react';import { UserRole, FacturaCaja } from '@/types';
import { normalizarCedulaRif, extraerDigitos, sonMismoDocumento } from '@/lib/cedulaRif';
import { hoyLocal, parseFechaLocal, sumarDias } from '@/lib/date';import { esAnulada } from '@/lib/estados';
import { DetalleFacturaDialog } from '@/components/historial/DetalleFacturaDialog';
import { TablaMovimientosHistorial } from '@/components/historial/TablaMovimientosHistorial';
import { PanelFiltrosAvanzados } from '@/components/historial/PanelFiltrosAvanzados';
import { ToolbarFiltrosHistorial } from '@/components/historial/ToolbarFiltrosHistorial';
import { BannerHistorial } from '@/components/historial/BannerHistorial';
import { ListaPacientesPanel } from '@/components/historial/ListaPacientesPanel';

interface ModuloHistorialPacientesProps {
  currentRole?: UserRole;
  cedulaInicial?: string;
}

export interface PacienteData {
  id?: number;
  cedula: string;
  nombre: string;
  fecha_nacimiento?: string;
  edad?: number | string;
  direccion?: string;
  telefono?: string;
}

export const ModuloHistorialPacientes: React.FC<ModuloHistorialPacientesProps> = ({
  currentRole = 'admin',
  cedulaInicial = ''
}) => {
  const [searchTerm, setSearchTerm] = useState(cedulaInicial);
  const [buscando, setBuscando] = useState(false);
  const [pacientesDirectorio, setPacientesDirectorio] = useState<PacienteData[]>([]);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<PacienteData | null>(null);
  const [movimientos, setMovimientos] = useState<FacturaCaja[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  
  // Filtros Avanzados y Agrupación
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroTextoEstudio, setFiltroTextoEstudio] = useState<string>('');
  const [filtroTipoEstudio, setFiltroTipoEstudio] = useState<string>('TODOS');
  const [filtroWhatsApp, setFiltroWhatsApp] = useState<string>('TODOS');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [agrupacion, setAgrupacion] = useState<'NINGUNA' | 'FECHA' | 'TIPO_ESTUDIO' | 'MEDICO' | 'PACIENTE'>('NINGUNA');
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState<boolean>(false);
  
  const [facturaDetalle, setFacturaDetalle] = useState<FacturaCaja | null>(null);

  // 1. Cargar directorio inicial de pacientes (con deduplicación estricta por número de documento)
  const cargarDirectorioPacientes = async () => {
    try {
      setBuscando(true);
      const res = await fetch('/api/pacientes');
      if (res.ok) {
        const data = await res.json();
        // Deduplicación estricta por dígitos de cédula
        const mapUnicos = new Map<string, PacienteData>();
        (data || []).forEach((p: PacienteData) => {
          const dig = extraerDigitos(p.cedula);
          if (dig && !mapUnicos.has(dig)) {
            mapUnicos.set(dig, {
              ...p,
              cedula: normalizarCedulaRif(p.cedula)
            });
          }
        });
        setPacientesDirectorio(Array.from(mapUnicos.values()));
      }
    } catch (err) {
      console.error('Error cargando directorio de pacientes:', err);
    } finally {
      setBuscando(false);
    }
  };

  // 2. Cargar todos los movimientos globales de la clínica
  const cargarMovimientosGlobales = async () => {
    setPacienteSeleccionado(null);
    setCargandoMovimientos(true);
    try {
      const res = await fetch('/api/facturas?limit=500');
      if (res.ok) {
        const facturas = await res.json();
        setMovimientos(facturas || []);
      } else {
        setMovimientos([]);
      }
    } catch (err) {
      console.error('Error cargando movimientos globales:', err);
      setMovimientos([]);
    } finally {
      setCargandoMovimientos(false);
    }
  };

  // 3. Cargar movimientos de un paciente específico por su cédula
  const cargarMovimientosPaciente = async (paciente: PacienteData) => {
    const pacienteNormalizado = {
      ...paciente,
      cedula: normalizarCedulaRif(paciente.cedula)
    };
    setPacienteSeleccionado(pacienteNormalizado);
    setCargandoMovimientos(true);
    try {
      const cedulaLimpia = extraerDigitos(paciente.cedula);
      const res = await fetch(`/api/facturas?cedula=${cedulaLimpia}&limit=500`);
      if (res.ok) {
        const facturas = await res.json();
        setMovimientos(facturas || []);
      } else {
        setMovimientos([]);
      }
    } catch (err) {
      console.error('Error cargando historial de facturas:', err);
      setMovimientos([]);
    } finally {
      setCargandoMovimientos(false);
    }
  };

  // Efecto inicial: Cargar directorio y movimientos globales o específicos
  useEffect(() => {
    cargarDirectorioPacientes();
    if (!cedulaInicial) {
      cargarMovimientosGlobales();
    }
  }, []);

  // Si viene cedulaInicial, cargar automáticamente dicho paciente
  useEffect(() => {
    if (cedulaInicial && pacientesDirectorio.length > 0) {
      const match = pacientesDirectorio.find(p => 
        sonMismoDocumento(p.cedula, cedulaInicial)
      );
      if (match) {
        cargarMovimientosPaciente(match);
      } else {
        // Cargar paciente on-the-fly
        fetch(`/api/pacientes?cedula=${extraerDigitos(cedulaInicial)}`)
          .then(r => r.json())
          .then(data => {
            if (data && data.cedula) {
              cargarMovimientosPaciente(data);
            }
          })
          .catch(console.error);
      }
    }
  }, [cedulaInicial, pacientesDirectorio]);

  // 4. Filtrar lista de pacientes coincidentes con la búsqueda (100% blindada anti-duplicados)
  const pacientesFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const digitosTerm = extraerDigitos(term);

    const filtrados = pacientesDirectorio.filter(p => {
      if (!term) return true;
      const digitosP = extraerDigitos(p.cedula);
      if (digitosTerm && digitosP.includes(digitosTerm)) return true;
      if (p.cedula.toLowerCase().includes(term)) return true;
      if (p.nombre && p.nombre.toLowerCase().includes(term)) return true;
      if (p.telefono && p.telefono.includes(term)) return true;
      return false;
    });

    // Filtro final que garantiza que nunca se repita el mismo número de documento
    const vistos = new Set<string>();
    return filtrados.filter(p => {
      const dig = extraerDigitos(p.cedula);
      if (vistos.has(dig)) return false;
      vistos.add(dig);
      return true;
    });
  }, [searchTerm, pacientesDirectorio]);

  // 5. Calcular KPIs (del paciente seleccionado o de la clínica completa)
  const kpis = useMemo(() => {
    if (!movimientos || movimientos.length === 0) {
      return {
        totalVisitas: 0,
        totalUSD: 0,
        totalBs: 0,
        totalDivisasUSD: 0,
        totalPagoMovilBs: 0,
        totalPuntoBs: 0,
        totalEfectivoBs: 0,
        conAdjunto: 0,
        conWhatsApp: 0,
        anuladas: 0,
        ultimaVisita: 'Sin registros'
      };
    }

    const noAnuladas = movimientos.filter(m => !esAnulada(m.estado));
    const totalUSD = noAnuladas.reduce((acc, m) => acc + (parseFloat(String(m.precio_usd)) || 0), 0);
    const totalDivisasUSD = noAnuladas.reduce((acc, m) => acc + (parseFloat(String(m.pago_divisas)) || 0), 0);
    const totalPagoMovilBs = noAnuladas.reduce((acc, m) => acc + (parseFloat(String(m.pago_movil)) || 0), 0);
    const totalPuntoBs = noAnuladas.reduce((acc, m) => acc + (parseFloat(String(m.pago_punto)) || 0), 0);
    const totalEfectivoBs = noAnuladas.reduce((acc, m) => acc + (parseFloat(String(m.pago_efectivo_bs)) || 0), 0);
    const conAdjunto = noAnuladas.filter(m => Boolean(m.adjunto_nombre)).length;
    const conWhatsApp = noAnuladas.filter(m => Boolean(m.whatsapp_enviado)).length;
    const anuladas = movimientos.filter(m => esAnulada(m.estado)).length;

    // Última fecha
    const fechaObj = movimientos[0]?.fecha ? parseFechaLocal(movimientos[0].fecha) : null;
    const ultimaVisita = fechaObj ? fechaObj.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';

    return {
      totalVisitas: movimientos.length,
      totalUSD,
      totalBs: (totalPagoMovilBs + totalPuntoBs + totalEfectivoBs),
      totalDivisasUSD,
      totalPagoMovilBs,
      totalPuntoBs,
      totalEfectivoBs,
      conAdjunto,
      conWhatsApp,
      anuladas,
      ultimaVisita
    };
  }, [movimientos]);

  // 6. Categorías únicas de estudio presentes en los movimientos
  const categoriasDisponibles = useMemo(() => {
    const cats = new Set<string>();
    movimientos.forEach(m => {
      const est = (m.estudio || '').toUpperCase();
      if (est.includes('ECO') || est.includes('DOPPLER')) cats.add('Ecografía');
      else if (est.includes('GINE') || est.includes('CITO') || est.includes('COLPO')) cats.add('Ginecología');
      else if (est.includes('MAMO')) cats.add('Mamografía');
      else if (est.includes('RAYOS') || est.includes('RX') || est.includes('RADIO')) cats.add('Rayos X');
      else if (est.includes('CONSULTA')) cats.add('Consulta Médica');
      else if (est.includes('LAB') || est.includes('PERFIL') || est.includes('SANGRE')) cats.add('Laboratorio');
      else cats.add('Otros Estudios');
    });
    return Array.from(cats);
  }, [movimientos]);

  // 7. Filtrar movimientos con criterios avanzados, texto libre y rangos de fecha
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      // 1. Filtro de Estado
      if (filtroEstado === 'CULMINADOS' && m.estado !== 'FINALIZADO' && m.estado !== 'COMPLETADO') return false;
      if (filtroEstado === 'EN_PROCESO' && m.estado !== 'PENDIENTE' && m.estado !== 'EN_PROCESO' && m.estado !== 'ESPERA' && m.estado !== 'ATENCION') return false;
      if (filtroEstado === 'ANULADOS' && !esAnulada(m.estado)) return false;

      // 2. Filtro de Rango de Fechas
      if (fechaDesde && m.fecha) {
        const fechaM = m.fecha.split('T')[0];
        if (fechaM < fechaDesde) return false;
      }
      if (fechaHasta && m.fecha) {
        const fechaM = m.fecha.split('T')[0];
        if (fechaM > fechaHasta) return false;
      }

      // 3. Filtro por Tipo de Estudio
      if (filtroTipoEstudio !== 'TODOS') {
        const est = (m.estudio || '').toUpperCase();
        if (filtroTipoEstudio === 'Ecografía' && !est.includes('ECO') && !est.includes('DOPPLER')) return false;
        if (filtroTipoEstudio === 'Ginecología' && !est.includes('GINE') && !est.includes('CITO') && !est.includes('COLPO')) return false;
        if (filtroTipoEstudio === 'Mamografía' && !est.includes('MAMO')) return false;
        if (filtroTipoEstudio === 'Rayos X' && !est.includes('RAYOS') && !est.includes('RX') && !est.includes('RADIO')) return false;
        if (filtroTipoEstudio === 'Consulta Médica' && !est.includes('CONSULTA')) return false;
        if (filtroTipoEstudio === 'Laboratorio' && !est.includes('LAB') && !est.includes('PERFIL') && !est.includes('SANGRE')) return false;
      }

      // 4. Filtro por Estado WhatsApp / Adjunto
      if (filtroWhatsApp === 'CON_WHATSAPP' && !m.whatsapp_enviado) return false;
      if (filtroWhatsApp === 'SIN_WHATSAPP' && m.whatsapp_enviado) return false;
      if (filtroWhatsApp === 'CON_ADJUNTO' && !m.adjunto_nombre) return false;

      // 5. Filtro de Texto libre (busca en estudio, médico, informe, ID, y además paciente y cédula)
      if (filtroTextoEstudio.trim()) {
        const query = filtroTextoEstudio.toLowerCase();
        const matchEstudio = (m.estudio || '').toLowerCase().includes(query);
        const matchMedico = (m.medico || '').toLowerCase().includes(query);
        const matchAdjunto = (m.adjunto_nombre || '').toLowerCase().includes(query);
        const matchId = String(m.id).includes(query);
        const matchPaciente = (m.nombre_paciente || '').toLowerCase().includes(query);
        const matchCedula = (m.cedula_paciente || '').toLowerCase().includes(query);

        if (!matchEstudio && !matchMedico && !matchAdjunto && !matchId && !matchPaciente && !matchCedula) return false;
      }

      return true;
    });
  }, [movimientos, filtroEstado, filtroTextoEstudio, filtroTipoEstudio, filtroWhatsApp, fechaDesde, fechaHasta]);

  // 8. Agrupación estructurada
  const movimientosAgrupados = useMemo(() => {
    if (agrupacion === 'NINGUNA') return null;

    const grupos: Record<string, FacturaCaja[]> = {};

    movimientosFiltrados.forEach(m => {
      let clave = 'Sin Categoría';

      if (agrupacion === 'FECHA') {
        if (m.fecha) {
          const d = parseFechaLocal(m.fecha);
          clave = d.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
          clave = clave.charAt(0).toUpperCase() + clave.slice(1);
        } else {
          clave = 'Sin Fecha Registrada';
        }
      } else if (agrupacion === 'TIPO_ESTUDIO') {
        const est = (m.estudio || '').toUpperCase();
        if (est.includes('ECO') || est.includes('DOPPLER')) clave = 'Ecografía y Doppler';
        else if (est.includes('GINE') || est.includes('CITO') || est.includes('COLPO')) clave = 'Ginecología y Obstetricia';
        else if (est.includes('MAMO')) clave = 'Mamografía';
        else if (est.includes('RAYOS') || est.includes('RX')) clave = 'Rayos X e Imagenología';
        else if (est.includes('CONSULTA')) clave = 'Consultas Médicas';
        else if (est.includes('LAB')) clave = 'Laboratorio Clínico';
        else clave = 'Otros Procedimientos';
      } else if (agrupacion === 'MEDICO') {
        clave = m.medico || 'Médico De Guardia';
      } else if (agrupacion === 'PACIENTE') {
        clave = `${m.nombre_paciente || 'Paciente'} (${normalizarCedulaRif(m.cedula_paciente || '')})`;
      }

      if (!grupos[clave]) grupos[clave] = [];
      grupos[clave].push(m);
    });

    return grupos;
  }, [movimientosFiltrados, agrupacion]);

  // Total USD filtrado
  const totalUSDFiltrado = useMemo(() => {
    return movimientosFiltrados
      .filter(m => !esAnulada(m.estado))
      .reduce((sum, m) => sum + (parseFloat(String(m.precio_usd)) || 0), 0);
  }, [movimientosFiltrados]);

  // Comprobar si hay filtros activos
  const hayFiltrosActivos = Boolean(
    filtroEstado !== 'TODOS' ||
    filtroTextoEstudio.trim() ||
    filtroTipoEstudio !== 'TODOS' ||
    filtroWhatsApp !== 'TODOS' ||
    fechaDesde ||
    fechaHasta ||
    agrupacion !== 'NINGUNA'
  );

  const aplicarRangoRapido = (tipo: 'HOY' | '7DIAS' | 'ESTE_MES' | 'ANO' | 'TODO') => {
    const hoyStr = hoyLocal();
    const anio = hoyStr.slice(0, 4);
    const mes = hoyStr.slice(0, 7);
    if (tipo === 'HOY') {
      setFechaDesde(hoyStr);
      setFechaHasta(hoyStr);
    } else if (tipo === '7DIAS') {
      setFechaDesde(sumarDias(hoyStr, -7));
      setFechaHasta(hoyStr);
    } else if (tipo === 'ESTE_MES') {
      setFechaDesde(`${mes}-01`);
      setFechaHasta(hoyStr);
    } else if (tipo === 'ANO') {
      setFechaDesde(`${anio}-01-01`);
      setFechaHasta(hoyStr);
    } else {
      setFechaDesde('');
      setFechaHasta('');
    }
  };

  const limpiarTodosLosFiltros = () => {
    setFiltroEstado('TODOS');
    setFiltroTextoEstudio('');
    setFiltroTipoEstudio('TODOS');
    setFiltroWhatsApp('TODOS');
    setFechaDesde('');
    setFechaHasta('');
    setAgrupacion('NINGUNA');
  };

  // Formato de moneda seguro con valores opcionales
  const formatUSD = (val?: number | string | null) => {
    const num = parseFloat(String(val ?? 0)) || 0;
    return `$${num.toFixed(2)}`;
  };

  const formatBs = (val?: number | string | null) => {
    const num = parseFloat(String(val ?? 0)) || 0;
    return `Bs. ${num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Exportar historial a CSV
  const handleExportarCSV = () => {
    if (movimientos.length === 0) return;

    const headers = [
      'ID Factura',
      'Fecha',
      'Hora',
      'Cédula',
      'Paciente',
      'Estudio',
      'Médico',
      'Estado',
      'Precio USD',
      'Pago Divisas USD',
      'Pago Móvil Bs',
      'Pago Punto Bs',
      'Efectivo Bs',
      'Tasa BCV',
      'Documento Adjunto',
      'WhatsApp Enviado'
    ];

    const rows = movimientosFiltrados.map(m => [
      m.id,
      m.fecha ? m.fecha.slice(0, 10) : '',
      `"${m.hora || ''}"`,
      `"${normalizarCedulaRif(m.cedula_paciente || '')}"`,
      `"${m.nombre_paciente || ''}"`,
      `"${(m.estudio || '').replace(/"/g, '""')}"`,
      `"${(m.medico || '').replace(/"/g, '""')}"`,
      m.estado || '',
      m.precio_usd || 0,
      m.pago_divisas || 0,
      m.pago_movil || 0,
      m.pago_punto || 0,
      m.pago_efectivo_bs || 0,
      m.tasa_bcv || 0,
      `"${(m.adjunto_nombre || 'Sin Adjunto').replace(/"/g, '""')}"`,
      m.whatsapp_enviado ? 'SÍ' : 'NO'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nombreArchivo = pacienteSeleccionado 
      ? `Historial_Paciente_${normalizarCedulaRif(pacienteSeleccionado.cedula)}.csv`
      : 'Auditoria_General_Movimientos_Clinica.csv';
    link.setAttribute('download', nombreArchivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Imprimir ficha de movimientos
  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* 1. HEADER CLÍNICO DE ALTO NIVEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-clinica-selection rounded-2xl text-clinica-primary">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Historial Clínico y Movimientos por Pacientes
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Auditoría centralizada de atenciones, estudios realizados, pagos multimoneda y trazabilidad de entrega de resultados.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              cargarDirectorioPacientes();
              if (pacienteSeleccionado) {
                cargarMovimientosPaciente(pacienteSeleccionado);
              } else {
                cargarMovimientosGlobales();
              }
            }}
            disabled={buscando || cargandoMovimientos}
            className="rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            title="Actualizar directorio y movimientos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(buscando || cargandoMovimientos) ? 'animate-spin text-clinica-primary' : ''}`} />
            <span>Actualizar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarCSV}
            disabled={movimientosFiltrados.length === 0}
            className="rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            title="Exportar movimientos visibles a archivo CSV/Excel"
          >
            <Download className="w-3.5 h-3.5 text-clinica-primary" />
            <span>Exportar CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={handleImprimir}
            className="rounded-xl bg-clinica-primary hover:bg-clinica-primary-dark text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-clinica-primary/20"
            title="Imprimir resumen de movimientos"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Ficha</span>
          </Button>
        </div>
      </div>

      {/* 2. PANEL DE BÚSQUEDA Y SELECTOR DE PACIENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: BUSCADOR Y LISTA DE PACIENTES (4 Cols) */}
        <ListaPacientesPanel pacientesFiltrados={pacientesFiltrados} searchTerm={searchTerm} setSearchTerm={setSearchTerm} cargarMovimientosGlobales={cargarMovimientosGlobales} pacienteSeleccionado={pacienteSeleccionado} cargarMovimientosPaciente={cargarMovimientosPaciente} />

        {/* COLUMNA DERECHA: FICHA / BANNER, KPIS Y TABLA DE MOVIMIENTOS CON FILTROS (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* 3. BANNER PRINCIPAL (PACIENTE INDIVIDUAL O AUDITORÍA GLOBAL) */}
          {pacienteSeleccionado ? (
            <BannerHistorial pacienteSeleccionado={pacienteSeleccionado} cargarMovimientosGlobales={cargarMovimientosGlobales} />
          ) : (
            <Card className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 bg-clinica-selection text-clinica-primary rounded-2xl flex items-center justify-center font-black shadow-inner">
                    <Globe className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900">
                        Auditoría General de la Clínica
                      </h3>
                      <Badge className="bg-clinica-selection text-clinica-dark text-[10px] font-bold border border-clinica-primary/30">
                        Modo Consolidado (Todos los Pacientes)
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Visualizando el historial global consolidado de todas las atenciones, recaudaciones y resultados clínicos.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs font-mono font-bold bg-slate-50 px-3 py-1 border-slate-300">
                    {pacientesDirectorio.length} Pacientes en Directorio
                  </Badge>
                </div>
              </div>
            </Card>
          )}

          {/* 4. TARJETAS DE KPIS FINANCIEROS Y CLÍNICOS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  {pacienteSeleccionado ? 'Atenciones Paciente' : 'Total Atenciones'}
                </span>
                <Activity className="w-4 h-4 text-clinica-primary" />
              </div>
              <p className="text-xl font-black text-slate-900 font-mono">{kpis.totalVisitas}</p>
              <p className="text-[10px] text-slate-500">Última: {kpis.ultimaVisita}</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total Facturado</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-black text-emerald-600 font-mono">{formatUSD(kpis.totalUSD)}</p>
              <p className="text-[10px] text-slate-500">{formatBs(kpis.totalBs)}</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Con Imágenes</span>
                <Paperclip className="w-4 h-4 text-cyan-600" />
              </div>
              <p className="text-xl font-black text-slate-900 font-mono">
                {kpis.conAdjunto} <span className="text-xs font-normal text-slate-500">/ {kpis.totalVisitas}</span>
              </p>
              <p className="text-[10px] text-cyan-600 font-medium">
                {kpis.totalVisitas > 0 ? Math.round((kpis.conAdjunto / kpis.totalVisitas) * 100) : 0}% con informe
              </p>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">WhatsApp Entregados</span>
                <MessageCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-black text-slate-900 font-mono">
                {kpis.conWhatsApp} <span className="text-xs font-normal text-slate-500">/ {kpis.conAdjunto}</span>
              </p>
              <p className="text-[10px] text-emerald-600 font-medium">
                {kpis.conAdjunto > 0 ? Math.round((kpis.conWhatsApp / kpis.conAdjunto) * 100) : 0}% notificados
              </p>
            </Card>
          </div>

          {/* 5. TABLA DE HISTORIAL DE MOVIMIENTOS CON TOOLBAR DE FILTROS AVANZADOS Y AGRUPACIONES (SIEMPRE VISIBLE) */}
          <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50 space-y-3">
              <ToolbarFiltrosHistorial movimientosFiltrados={movimientosFiltrados} movimientos={movimientos} formatUSD={formatUSD} totalUSDFiltrado={totalUSDFiltrado} agrupacion={agrupacion} setAgrupacion={setAgrupacion} pacienteSeleccionado={pacienteSeleccionado} setMostrarFiltrosAvanzados={setMostrarFiltrosAvanzados} mostrarFiltrosAvanzados={mostrarFiltrosAvanzados} hayFiltrosActivos={hayFiltrosActivos} limpiarTodosLosFiltros={limpiarTodosLosFiltros} />

              {/* Barra de Filtros Primarios (Buscador y Estado) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                {/* Búsqueda dentro de movimientos (estudio, médico, informe, paciente, CI) */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="Filtrar por paciente, cédula, estudio, médico, informe o N°..."
                    value={filtroTextoEstudio}
                    onChange={(e) => setFiltroTextoEstudio(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-xl border-slate-200 bg-white"
                  />
                  {filtroTextoEstudio && (
                    <button
                      onClick={() => setFiltroTextoEstudio('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Selector Rápido de Estado */}
                <div className="flex bg-slate-200/70 p-0.5 rounded-xl text-[10px] font-bold shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => setFiltroEstado('TODOS')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      filtroEstado === 'TODOS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFiltroEstado('CULMINADOS')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      filtroEstado === 'CULMINADOS' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Culminados
                  </button>
                  <button
                    onClick={() => setFiltroEstado('EN_PROCESO')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      filtroEstado === 'EN_PROCESO' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    En Sala
                  </button>
                  <button
                    onClick={() => setFiltroEstado('ANULADOS')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      filtroEstado === 'ANULADOS' ? 'bg-white text-rose-800 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Anulados
                  </button>
                </div>
              </div>

              {/* Panel Desplegable de Filtros Avanzados (Fechas, Especialidad, WhatsApp) */}
              {mostrarFiltrosAvanzados && (
                <PanelFiltrosAvanzados fechaDesde={fechaDesde} setFechaDesde={setFechaDesde} fechaHasta={fechaHasta} setFechaHasta={setFechaHasta} aplicarRangoRapido={aplicarRangoRapido} filtroTipoEstudio={filtroTipoEstudio} setFiltroTipoEstudio={setFiltroTipoEstudio} categoriasDisponibles={categoriasDisponibles} filtroWhatsApp={filtroWhatsApp} setFiltroWhatsApp={setFiltroWhatsApp} />
              )}
            </CardHeader>

            <TablaMovimientosHistorial cargandoMovimientos={cargandoMovimientos} movimientosFiltrados={movimientosFiltrados} hayFiltrosActivos={hayFiltrosActivos} limpiarTodosLosFiltros={limpiarTodosLosFiltros} pacienteSeleccionado={pacienteSeleccionado} agrupacion={agrupacion} movimientosAgrupados={movimientosAgrupados} formatUSD={formatUSD} pacientesDirectorio={pacientesDirectorio} cargarMovimientosPaciente={cargarMovimientosPaciente} setFacturaDetalle={setFacturaDetalle} />
          </Card>
        </div>
      </div>

      {/* 6. MODAL DE DETALLE DE FACTURA / MOVIMIENTO */}
      <DetalleFacturaDialog facturaDetalle={facturaDetalle} setFacturaDetalle={setFacturaDetalle} formatUSD={formatUSD} formatBs={formatBs} />
    </div>
  );
};

export default ModuloHistorialPacientes;
