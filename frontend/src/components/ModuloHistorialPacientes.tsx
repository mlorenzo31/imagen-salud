'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Search,
  History,
  User,
  Users,
  Globe,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Download,
  Printer,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Eye,
  Activity,
  Layers,
  ShieldCheck,
  Stethoscope,
  Filter,
  SlidersHorizontal,
  FolderTree,
  CalendarRange,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { UserRole, FacturaCaja } from '@/types';
import { normalizarCedulaRif, extraerDigitos, sonMismoDocumento } from '@/lib/cedulaRif';
import { calcularEdadReal, formatearFechaNacimiento } from '@/lib/date';

interface ModuloHistorialPacientesProps {
  currentRole?: UserRole;
  cedulaInicial?: string;
}

interface PacienteData {
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

    const noAnuladas = movimientos.filter(m => m.estado !== 'ANULADO');
    const totalUSD = noAnuladas.reduce((acc, m) => acc + (parseFloat(String(m.precio_usd)) || 0), 0);
    const totalDivisasUSD = noAnuladas.reduce((acc, m) => acc + (parseFloat(String(m.pago_divisas)) || 0), 0);
    const totalPagoMovilBs = noAnuladas.reduce((acc, m) => acc + (parseFloat(String(m.pago_movil)) || 0), 0);
    const totalPuntoBs = noAnuladas.reduce((acc, m) => acc + (parseFloat(String(m.pago_punto)) || 0), 0);
    const totalEfectivoBs = noAnuladas.reduce((acc, m) => acc + (parseFloat(String(m.pago_efectivo_bs)) || 0), 0);
    const conAdjunto = noAnuladas.filter(m => Boolean(m.adjunto_nombre)).length;
    const conWhatsApp = noAnuladas.filter(m => Boolean(m.whatsapp_enviado)).length;
    const anuladas = movimientos.filter(m => m.estado === 'ANULADO').length;

    // Última fecha
    const fechaObj = movimientos[0]?.fecha ? new Date(movimientos[0].fecha) : null;
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
      if (filtroEstado === 'ANULADOS' && m.estado !== 'ANULADO') return false;

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
          const d = new Date(m.fecha);
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
      .filter(m => m.estado !== 'ANULADO')
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
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    if (tipo === 'HOY') {
      setFechaDesde(hoyStr);
      setFechaHasta(hoyStr);
    } else if (tipo === '7DIAS') {
      const hace7 = new Date();
      hace7.setDate(hoy.getDate() - 7);
      setFechaDesde(hace7.toISOString().split('T')[0]);
      setFechaHasta(hoyStr);
    } else if (tipo === 'ESTE_MES') {
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      setFechaDesde(primerDia.toISOString().split('T')[0]);
      setFechaHasta(hoyStr);
    } else if (tipo === 'ANO') {
      const primerDiaAno = new Date(hoy.getFullYear(), 0, 1);
      setFechaDesde(primerDiaAno.toISOString().split('T')[0]);
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
      m.fecha ? new Date(m.fecha).toISOString().slice(0, 10) : '',
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
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-clinica-primary" />
                  Directorio de Pacientes
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-slate-300">
                  {pacientesFiltrados.length} encontrados
                </Badge>
              </CardTitle>

              {/* Input de Búsqueda de Pacientes */}
              <div className="relative mt-2.5">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar por Cédula o Nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 text-xs h-9 rounded-xl border-slate-200 bg-white focus-visible:ring-clinica-primary"
                />
              </div>
            </CardHeader>

            <CardContent className="p-2 space-y-1.5 max-h-[560px] overflow-y-auto">
              {/* OPCIÓN SUPERIOR: AUDITORÍA GENERAL / TODOS LOS PACIENTES */}
              <div
                onClick={cargarMovimientosGlobales}
                className={`p-3 rounded-2xl cursor-pointer transition-all border flex items-center justify-between gap-3 ${
                  !pacienteSeleccionado
                    ? 'bg-clinica-selection border-clinica-primary/40 shadow-sm'
                    : 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/70'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    !pacienteSeleccionado ? 'bg-clinica-primary text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                  }`}>
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                      <span>Auditoría General</span>
                      <span className="text-[10px] font-semibold text-clinica-primary">(Todos)</span>
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      Historial consolidado de toda la clínica
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[9px] font-mono shrink-0 ${
                    !pacienteSeleccionado ? 'bg-white text-clinica-primary border-clinica-primary/30 font-bold' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  Global
                </Badge>
              </div>

              {/* LISTA DE PACIENTES INDIVIDUALES */}
              {pacientesFiltrados.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No se encontraron pacientes con el criterio ingresado.
                </div>
              ) : (
                pacientesFiltrados.map((p) => {
                  const isSelected = pacienteSeleccionado && sonMismoDocumento(pacienteSeleccionado.cedula, p.cedula);
                  const cedulaCanonica = normalizarCedulaRif(p.cedula);

                  return (
                    <div
                      key={extraerDigitos(p.cedula)}
                      onClick={() => cargarMovimientosPaciente(p)}
                      className={`p-3 rounded-2xl cursor-pointer transition-all border flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-clinica-selection border-clinica-primary/40 shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-transparent hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-clinica-primary text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {p.nombre ? p.nombre.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {p.nombre || 'Sin Nombre'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-mono font-bold text-slate-600">
                              {cedulaCanonica}
                            </span>
                            {p.fecha_nacimiento && (
                              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1 rounded border border-teal-200">
                                {calcularEdadReal(p.fecha_nacimiento)} años
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-clinica-primary translate-x-0.5' : 'text-slate-300'}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA: FICHA / BANNER, KPIS Y TABLA DE MOVIMIENTOS CON FILTROS (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* 3. BANNER PRINCIPAL (PACIENTE INDIVIDUAL O AUDITORÍA GLOBAL) */}
          {pacienteSeleccionado ? (
            <Card className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 bg-clinica-primary text-white rounded-2xl flex items-center justify-center font-black text-base shadow-md shadow-clinica-primary/20">
                    {pacienteSeleccionado.nombre ? pacienteSeleccionado.nombre.charAt(0).toUpperCase() : 'P'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900">
                        {pacienteSeleccionado.nombre}
                      </h3>
                      <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                        Paciente Seleccionado
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                        CI: {normalizarCedulaRif(pacienteSeleccionado.cedula)}
                      </span>
                      {(pacienteSeleccionado.fecha_nacimiento || pacienteSeleccionado.edad) && (
                        <span className="flex items-center gap-1.5 font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg">
                          <Calendar className="w-3.5 h-3.5 text-teal-600" />
                          {pacienteSeleccionado.fecha_nacimiento
                            ? `${calcularEdadReal(pacienteSeleccionado.fecha_nacimiento)} años (${formatearFechaNacimiento(pacienteSeleccionado.fecha_nacimiento)})`
                            : `${pacienteSeleccionado.edad} años`}
                        </span>
                      )}
                      {pacienteSeleccionado.telefono && (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          {pacienteSeleccionado.telefono}
                        </span>
                      )}
                      {pacienteSeleccionado.direccion && (
                        <span className="flex items-center gap-1 truncate max-w-xs">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{pacienteSeleccionado.direccion}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  {pacienteSeleccionado.telefono && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const tel = pacienteSeleccionado.telefono?.replace(/\D/g, '') || '';
                        let telInt = tel.startsWith('0') ? '58' + tel.slice(1) : tel;
                        window.open(`https://api.whatsapp.com/send?phone=${telInt}`, '_blank');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Contactar WhatsApp</span>
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cargarMovimientosGlobales}
                    className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center gap-1"
                    title="Regresar a la auditoría general de todos los pacientes"
                  >
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ver Todos</span>
                  </Button>
                </div>
              </div>
            </Card>
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
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  {pacienteSeleccionado ? 'Atenciones Paciente' : 'Total Atenciones'}
                </span>
                <Activity className="w-4 h-4 text-clinica-primary" />
              </div>
              <p className="text-xl font-black text-slate-900 font-mono">{kpis.totalVisitas}</p>
              <p className="text-[10px] text-slate-500">Última: {kpis.ultimaVisita}</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Facturado</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-black text-emerald-600 font-mono">{formatUSD(kpis.totalUSD)}</p>
              <p className="text-[10px] text-slate-500">{formatBs(kpis.totalBs)}</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Con Imágenes</span>
                <Paperclip className="w-4 h-4 text-cyan-600" />
              </div>
              <p className="text-xl font-black text-slate-900 font-mono">
                {kpis.conAdjunto} <span className="text-xs font-normal text-slate-400">/ {kpis.totalVisitas}</span>
              </p>
              <p className="text-[10px] text-cyan-600 font-medium">
                {kpis.totalVisitas > 0 ? Math.round((kpis.conAdjunto / kpis.totalVisitas) * 100) : 0}% con informe
              </p>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">WhatsApp Entregados</span>
                <MessageCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-black text-slate-900 font-mono">
                {kpis.conWhatsApp} <span className="text-xs font-normal text-slate-400">/ {kpis.conAdjunto}</span>
              </p>
              <p className="text-[10px] text-emerald-600 font-medium">
                {kpis.conAdjunto > 0 ? Math.round((kpis.conWhatsApp / kpis.conAdjunto) * 100) : 0}% notificados
              </p>
            </Card>
          </div>

          {/* 5. TABLA DE HISTORIAL DE MOVIMIENTOS CON TOOLBAR DE FILTROS AVANZADOS Y AGRUPACIONES (SIEMPRE VISIBLE) */}
          <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-clinica-primary" />
                      Historial Detallado de Movimientos y Estudios
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-mono border-slate-300 bg-white">
                      {movimientosFiltrados.length} de {movimientos.length} atenciones
                    </Badge>
                    <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                      Subtotal: {formatUSD(totalUSDFiltrado)}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Trazabilidad cronológica de servicios clínicos, cobros y estado de entrega de resultados
                  </p>
                </div>

                {/* Botones de Control Rápido */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Selector de Agrupación */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs">
                    <FolderTree className="w-3.5 h-3.5 text-clinica-primary" />
                    <span className="text-[10px] font-black text-slate-500 uppercase">Agrupar:</span>
                    <select
                      value={agrupacion}
                      onChange={(e) => setAgrupacion(e.target.value as any)}
                      className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-hidden cursor-pointer"
                    >
                      <option value="NINGUNA">Sin Agrupar (Lista)</option>
                      <option value="FECHA">Por Fecha / Mes</option>
                      <option value="TIPO_ESTUDIO">Por Tipo de Estudio</option>
                      <option value="MEDICO">Por Médico Tratante</option>
                      {!pacienteSeleccionado && <option value="PACIENTE">Por Paciente</option>}
                    </select>
                  </div>

                  {/* Botón de Filtros Avanzados */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)}
                    className={`h-8 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      mostrarFiltrosAvanzados || hayFiltrosActivos 
                        ? 'bg-clinica-selection border-clinica-primary/50 text-clinica-dark font-black' 
                        : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-clinica-primary" />
                    <span>Filtros Avanzados</span>
                    {hayFiltrosActivos && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    )}
                    {mostrarFiltrosAvanzados ? (
                      <ChevronUp className="w-3 h-3 text-slate-400 ml-0.5" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                    )}
                  </Button>

                  {/* Limpiar Filtros */}
                  {hayFiltrosActivos && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={limpiarTodosLosFiltros}
                      className="h-8 px-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1"
                      title="Restablecer todos los filtros"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Limpiar</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Barra de Filtros Primarios (Buscador y Estado) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                {/* Búsqueda dentro de movimientos (estudio, médico, informe, paciente, CI) */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 animate-in fade-in-50 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                    {/* 1. Rango de Fechas */}
                    <div className="md:col-span-6 space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                        <CalendarRange className="w-3.5 h-3.5 text-clinica-primary" />
                        Rango de Fechas
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[9px] text-slate-400 block mb-0.5">Desde:</span>
                          <Input
                            type="date"
                            value={fechaDesde}
                            onChange={(e) => setFechaDesde(e.target.value)}
                            className="h-8 text-xs font-mono rounded-xl"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block mb-0.5">Hasta:</span>
                          <Input
                            type="date"
                            value={fechaHasta}
                            onChange={(e) => setFechaHasta(e.target.value)}
                            className="h-8 text-xs font-mono rounded-xl"
                          />
                        </div>
                      </div>
                      {/* Accesos rápidos de fecha */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <button
                          onClick={() => aplicarRangoRapido('HOY')}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          Hoy
                        </button>
                        <button
                          onClick={() => aplicarRangoRapido('7DIAS')}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          7 Días
                        </button>
                        <button
                          onClick={() => aplicarRangoRapido('ESTE_MES')}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          Este Mes
                        </button>
                        <button
                          onClick={() => aplicarRangoRapido('ANO')}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          Este Año
                        </button>
                        <button
                          onClick={() => aplicarRangoRapido('TODO')}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          Todo
                        </button>
                      </div>
                    </div>

                    {/* 2. Tipo / Área de Estudio */}
                    <div className="md:col-span-3 space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-clinica-primary" />
                        Área / Especialidad
                      </label>
                      <select
                        value={filtroTipoEstudio}
                        onChange={(e) => setFiltroTipoEstudio(e.target.value)}
                        className="w-full h-8 px-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="TODOS">Todas las Especialidades</option>
                        <option value="Ecografía">Ecografía y Doppler</option>
                        <option value="Ginecología">Ginecología y Obstetricia</option>
                        <option value="Mamografía">Mamografía</option>
                        <option value="Rayos X">Rayos X</option>
                        <option value="Consulta Médica">Consulta Médica</option>
                        <option value="Laboratorio">Laboratorio</option>
                        {categoriasDisponibles
                          .filter(c => !['Ecografía', 'Ginecología', 'Mamografía', 'Rayos X', 'Consulta Médica', 'Laboratorio'].includes(c))
                          .map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                      </select>
                    </div>

                    {/* 3. Entrega de Resultados & WhatsApp */}
                    <div className="md:col-span-3 space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Entrega y WhatsApp
                      </label>
                      <select
                        value={filtroWhatsApp}
                        onChange={(e) => setFiltroWhatsApp(e.target.value)}
                        className="w-full h-8 px-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="TODOS">Todos los Resultados</option>
                        <option value="CON_WHATSAPP">✓ WhatsApp Enviado</option>
                        <option value="SIN_WHATSAPP">Pendiente de Envío WA</option>
                        <option value="CON_ADJUNTO">Con Informe Adjunto</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>

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
                            .filter(x => x.estado !== 'ANULADO')
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
                                const fechaFormateada = m.fecha ? new Date(m.fecha).toLocaleDateString('es-VE') : 'N/A';
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
                                      ) : m.estado === 'ANULADO' ? (
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
                          const fechaFormateada = m.fecha ? new Date(m.fecha).toLocaleDateString('es-VE') : 'N/A';
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
                                ) : m.estado === 'ANULADO' ? (
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
          </Card>
        </div>
      </div>

      {/* 6. MODAL DE DETALLE DE FACTURA / MOVIMIENTO */}
      <Dialog open={Boolean(facturaDetalle)} onOpenChange={(open) => !open && setFacturaDetalle(null)}>
        <DialogContent className="sm:max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-black text-base">
              <div className="p-2 bg-clinica-selection rounded-xl text-clinica-primary">
                <FileText className="w-5 h-5" />
              </div>
              <span>Detalle de Movimiento Clínico #{facturaDetalle?.id}</span>
            </DialogTitle>
          </DialogHeader>

          {facturaDetalle && (
            <div className="space-y-4 py-2 text-xs">
              {/* Encabezado Paciente */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <h4 className="font-black text-slate-900 text-sm">{facturaDetalle.nombre_paciente}</h4>
                  <p className="text-[11px] font-mono text-slate-500">
                    Cédula: <strong>{normalizarCedulaRif(facturaDetalle.cedula_paciente || '')}</strong> • Tel: {facturaDetalle.telefono_paciente || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className="bg-slate-800 text-white font-mono text-xs">
                    {facturaDetalle.fecha ? new Date(facturaDetalle.fecha).toLocaleDateString('es-VE') : ''}
                  </Badge>
                  <p className="text-[10px] text-slate-400 mt-0.5">{facturaDetalle.hora || ''}</p>
                </div>
              </div>

              {/* Estudio y Servicios */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Estudios y Procedimientos Facturados
                </h5>
                <div className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{facturaDetalle.estudio}</span>
                    <span className="font-mono text-emerald-700">{formatUSD(facturaDetalle.precio_usd)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
                    <span>Médico Asignado: <strong>{facturaDetalle.medico || 'De Guardia'}</strong></span>
                    <span>Tasa BCV: <strong>{formatBs(facturaDetalle.tasa_bcv || 0)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Desglose Multimoneda */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Desglose de Formas de Pago
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold">Divisas USD</p>
                    <p className="font-bold font-mono text-emerald-700">{formatUSD(facturaDetalle.pago_divisas)}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold">Pago Móvil</p>
                    <p className="font-bold font-mono text-blue-700">{formatBs(facturaDetalle.pago_movil)}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold">Punto POS</p>
                    <p className="font-bold font-mono text-blue-700">{formatBs(facturaDetalle.pago_punto)}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold">Efectivo Bs</p>
                    <p className="font-bold font-mono text-slate-700">{formatBs(facturaDetalle.pago_efectivo_bs)}</p>
                  </div>
                </div>
              </div>

              {/* Documentación Digital y WhatsApp */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                    Documento de Resultados / Imágenes
                  </span>
                  <Badge className={facturaDetalle.adjunto_nombre ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}>
                    {facturaDetalle.adjunto_nombre ? 'Adjuntado' : 'Sin Adjunto'}
                  </Badge>
                </div>
                <p className="text-[11px] font-mono text-slate-700 truncate">
                  {facturaDetalle.adjunto_nombre || 'No se han cargado imágenes digitales para este movimiento.'}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-emerald-200/40 text-[11px]">
                  <span className="text-slate-600">Notificación por WhatsApp:</span>
                  <span className="font-bold text-emerald-800">
                    {facturaDetalle.whatsapp_enviado 
                      ? `Enviado (${facturaDetalle.whatsapp_fecha_envio ? new Date(facturaDetalle.whatsapp_fecha_envio).toLocaleString('es-VE') : 'Sí'})` 
                      : 'No enviado'}
                  </span>
                </div>
              </div>

              {/* Motivo de Anulación si aplica */}
              {facturaDetalle.estado === 'ANULADO' && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
                  <p className="font-bold">Factura Anulada</p>
                  <p className="text-[11px] mt-0.5">{facturaDetalle.motivo_anulacion || 'Sin motivo especificado.'}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setFacturaDetalle(null)}
              className="rounded-xl text-xs font-bold"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModuloHistorialPacientes;
