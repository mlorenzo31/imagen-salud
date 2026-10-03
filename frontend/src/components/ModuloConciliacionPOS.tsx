'use client';

import React, { useState, useMemo } from 'react';
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
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Search,
  Plus,
  RefreshCw,
  TrendingDown,
  Layers,
  ArrowRightLeft,
  Building2,
  Lock,
  Smartphone,
  CheckCheck,
  Calendar,
  DollarSign,
  Receipt,
  Sparkles
} from 'lucide-react';
import { exportarAExcel, exportarAPDF } from '@/lib/exportUtils';
import { ConciliacionPOS, UserRole, ModoOperacion, CuentaBancaria } from '@/types';
import { hoyLocal } from '@/lib/date';

interface ModuloConciliacionPOSProps {
  currentRole: UserRole;
  modoOperacion: ModoOperacion;
  cuentas: CuentaBancaria[];
  onConciliacionCompletada?: () => void;
}

interface PagoRecibidoCaja {
  id: number;
  fecha: string;
  hora: string;
  paciente: string;
  cedula: string;
  factura_id: string;
  metodo: 'PUNTO_POS' | 'PAGO_MOVIL' | 'TRANSFERENCIA';
  banco: string;
  referencia: string;
  monto_bs: number;
  monto_usd: number;
  estado: 'CONCILIADO' | 'PENDIENTE';
  fecha_conciliado?: string;
  referencia_extracto?: string;
}

const LOTES_INICIALES: ConciliacionPOS[] = [
  {
    id: 1,
    fecha_operacion: '2026-09-12',
    fecha_cierre_lote: '2026-09-12',
    lote_numero: '000412',
    tipo_tarjeta: 'TDD',
    banco: 'Banco Banesco (Punto 01 - Admisión)',
    monto_bruto_pos_bs: 45200.00,
    comision_bancaria_bs: 678.00,
    comision_porcentaje: 1.5,
    monto_neto_liquidado_bs: 44522.00,
    diferencia_cuadre_bs: 0.00,
    estado: 'CONCILIADO',
    notas: 'Liquidación nocturna automática 100% cuadrada',
    usuario: 'Asistente Administrativo'
  },
  {
    id: 2,
    fecha_operacion: '2026-09-11',
    fecha_cierre_lote: '2026-09-11',
    lote_numero: '000409',
    tipo_tarjeta: 'TDC',
    banco: 'Banco Mercantil (Punto 02 - Triaje)',
    monto_bruto_pos_bs: 18500.00,
    comision_bancaria_bs: 555.00,
    comision_porcentaje: 3.0,
    monto_neto_liquidado_bs: 17945.00,
    diferencia_cuadre_bs: 0.00,
    estado: 'CONCILIADO',
    notas: 'Cierre de lote verificado en estado de cuenta mercantil',
    usuario: 'Director Médico (Admin)'
  },
  {
    id: 3,
    fecha_operacion: '2026-09-10',
    fecha_cierre_lote: '2026-09-10',
    lote_numero: '000398',
    tipo_tarjeta: 'TDD',
    banco: 'Banco de Venezuela (Punto 03 - Caja)',
    monto_bruto_pos_bs: 12400.00,
    comision_bancaria_bs: 186.00,
    comision_porcentaje: 1.5,
    monto_neto_liquidado_bs: 12214.00,
    diferencia_cuadre_bs: 0.00,
    estado: 'PENDIENTE',
    notas: 'Pendiente validar abono en cuenta bancaria BDV',
    usuario: 'Asistente Administrativo'
  }
];

const PAGOS_CAJA_INICIALES: PagoRecibidoCaja[] = [
  {
    id: 101,
    fecha: '2026-09-14',
    hora: '09:15',
    paciente: 'Mariana Silva',
    cedula: 'V-19845210',
    factura_id: 'FAC-0981',
    metodo: 'PUNTO_POS',
    banco: 'Banesco (Punto 01)',
    referencia: 'POS-7821',
    monto_bs: 3450.00,
    monto_usd: 4.14,
    estado: 'PENDIENTE'
  },
  {
    id: 102,
    fecha: '2026-09-14',
    hora: '10:30',
    paciente: 'Carlos Mendoza',
    cedula: 'V-15420112',
    factura_id: 'FAC-0982',
    metodo: 'PAGO_MOVIL',
    banco: 'Banco de Venezuela',
    referencia: 'PM-99321',
    monto_bs: 5800.00,
    monto_usd: 6.96,
    estado: 'PENDIENTE'
  },
  {
    id: 103,
    fecha: '2026-09-14',
    hora: '11:45',
    paciente: 'Elena Rivas',
    cedula: 'V-22114589',
    factura_id: 'FAC-0983',
    metodo: 'PUNTO_POS',
    banco: 'Mercantil (Punto 02)',
    referencia: 'POS-8902',
    monto_bs: 8200.00,
    monto_usd: 9.85,
    estado: 'CONCILIADO',
    fecha_conciliado: '2026-09-14',
    referencia_extracto: 'EXT-55201'
  },
  {
    id: 104,
    fecha: '2026-09-14',
    hora: '12:20',
    paciente: 'Pedro Hernández',
    cedula: 'V-11895421',
    factura_id: 'FAC-0984',
    metodo: 'PAGO_MOVIL',
    banco: 'Banesco Pago Móvil',
    referencia: 'PM-44512',
    monto_bs: 4100.00,
    monto_usd: 4.92,
    estado: 'PENDIENTE'
  }
];

export const ModuloConciliacionPOS: React.FC<ModuloConciliacionPOSProps> = ({
  currentRole,
  modoOperacion,
  cuentas,
  onConciliacionCompletada
}) => {
  // Pestaña activa: Lotes POS vs Pagos Recibidos en Caja
  const [subTab, setSubTab] = useState<'lotes' | 'pagos_caja'>('lotes');

  // Estado de lotes
  const [lotes, setLotes] = useState<ConciliacionPOS[]>(LOTES_INICIALES);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'CONCILIADO' | 'PENDIENTE' | 'DESCUADRADO'>('TODOS');
  const [filtroTipoTarjeta, setFiltroTipoTarjeta] = useState<string>('TODAS');

  // Estado de pagos individuales recibidos en caja
  const [pagosCaja, setPagosCaja] = useState<PagoRecibidoCaja[]>(PAGOS_CAJA_INICIALES);
  const [filtroMetodoPago, setFiltroMetodoPago] = useState<string>('TODOS');
  const [busquedaPagos, setBusquedaPagos] = useState<string>('');

  // Modales
  const [openModalRegistro, setOpenModalRegistro] = useState(false);
  const [openModalConciliar, setOpenModalConciliar] = useState(false);
  const [loteAConciliar, setLoteAConciliar] = useState<ConciliacionPOS | null>(null);

  // Formulario de Conciliación Bancaria de Lote
  const [cuentaConciliacion, setCuentaConciliacion] = useState('Banco de Venezuela - Cta Cte Principal');
  const [refBancaria, setRefBancaria] = useState('');
  const [fechaAbono, setFechaAbono] = useState(hoyLocal());
  const [montoRealAcreditado, setMontoRealAcreditado] = useState<string>('');
  const [notasConciliacion, setNotasConciliacion] = useState('');

  // Formulario Registrar Nuevo Cierre de Lote
  const [formLote, setFormLote] = useState('');
  const [formTipo, setFormTipo] = useState<'TDD' | 'TDC'>('TDD');
  const [formBanco, setFormBanco] = useState('Banco Banesco (Punto 01 - Admisión)');
  const [formFechaOperacion, setFormFechaOperacion] = useState(hoyLocal());
  const [formMontoBruto, setFormMontoBruto] = useState<number | ''>('');
  const [formComisionBs, setFormComisionBs] = useState<number | ''>('');
  const [formComisionPct, setFormComisionPct] = useState<number>(1.5);
  const [formNotas, setFormNotas] = useState('');

  const isReadOnly = modoOperacion === 'vista';

  // Alerta de lotes pendientes de días anteriores
  const lotesPendientesDiasPrevios = useMemo(() => {
    const fechaHoy = hoyLocal();
    return lotes.filter(l => l.estado !== 'CONCILIADO' && l.fecha_operacion < fechaHoy);
  }, [lotes]);

  // Actualizar comisión sugerida al cambiar tipo
  const handleTipoChange = (tipo: 'TDD' | 'TDC') => {
    setFormTipo(tipo);
    const pct = tipo === 'TDD' ? 1.5 : 3.0;
    setFormComisionPct(pct);
    if (typeof formMontoBruto === 'number') {
      setFormComisionBs(Number(((formMontoBruto * pct) / 100).toFixed(2)));
    }
  };

  const handleBrutoChange = (val: string) => {
    const num = parseFloat(val);
    setFormMontoBruto(isNaN(num) ? '' : num);
    if (!isNaN(num)) {
      setFormComisionBs(Number(((num * formComisionPct) / 100).toFixed(2)));
    } else {
      setFormComisionBs('');
    }
  };

  // Abrir Modal de Conciliación de Lote
  const handleAbrirModalConciliar = (lote: ConciliacionPOS) => {
    setLoteAConciliar(lote);
    setMontoRealAcreditado(lote.monto_neto_liquidado_bs.toFixed(2));
    setRefBancaria(`ABONO-LOTE-${lote.lote_numero}`);
    setFechaAbono(hoyLocal());
    setNotasConciliacion(`Abono validado en cuenta ${lote.banco}`);
    setOpenModalConciliar(true);
  };

  // Confirmar Conciliación del Lote
  const handleConfirmarConciliacion = () => {
    if (!loteAConciliar) return;
    const realNum = parseFloat(montoRealAcreditado) || 0;
    const diferencia = realNum - loteAConciliar.monto_neto_liquidado_bs;
    const nuevoEstado = Math.abs(diferencia) > 0.01 ? 'DESCUADRADO' : 'CONCILIADO';

    setLotes(prev => prev.map(l => {
      if (l.id === loteAConciliar.id) {
        return {
          ...l,
          estado: nuevoEstado,
          diferencia_cuadre_bs: diferencia,
          notas: notasConciliacion || `Conciliado con ref: ${refBancaria}`,
          fecha_cierre_lote: fechaAbono
        };
      }
      return l;
    }));

    setOpenModalConciliar(false);
    setLoteAConciliar(null);
    if (onConciliacionCompletada) onConciliacionCompletada();
  };

  // Conciliar Rápido (1 Clic)
  const handleConciliarRapido = (lote: ConciliacionPOS) => {
    if (isReadOnly) return alert('Modo Vista activo.');
    const confirmar = confirm(`¿Confirmar conciliación directa del Lote #${lote.lote_numero} por Bs. ${lote.monto_neto_liquidado_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}?`);
    if (!confirmar) return;

    setLotes(prev => prev.map(l => l.id === lote.id ? { ...l, estado: 'CONCILIADO', notas: 'Conciliación rápida verificada en banco' } : l));
    if (onConciliacionCompletada) onConciliacionCompletada();
  };

  // Reabrir lote si se necesita rectificar
  const handleReabrirLote = (id: number) => {
    if (isReadOnly) return alert('Modo Vista activo.');
    setLotes(prev => prev.map(l => l.id === id ? { ...l, estado: 'PENDIENTE' } : l));
  };

  // Conciliar Pago Individual de Caja
  const handleConciliarPagoIndividual = (id: number) => {
    setPagosCaja(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          estado: 'CONCILIADO',
          fecha_conciliado: hoyLocal(),
          referencia_extracto: `EXT-${Math.floor(Math.random() * 89999 + 10000)}`
        };
      }
      return p;
    }));
  };

  // Conciliar Todos los Pagos Pendientes de Caja
  const handleConciliarTodosLosPagos = () => {
    const pendientesCount = pagosCaja.filter(p => p.estado === 'PENDIENTE').length;
    if (pendientesCount === 0) {
      alert('Todos los pagos ya están conciliados.');
      return;
    }
    const conf = confirm(`¿Desea marcar como CONCILIADOS en banco los ${pendientesCount} pagos pendientes de caja?`);
    if (!conf) return;

    setPagosCaja(prev => prev.map(p => ({
      ...p,
      estado: 'CONCILIADO',
      fecha_conciliado: hoyLocal(),
      referencia_extracto: p.referencia_extracto || `EXT-${Math.floor(Math.random() * 89999 + 10000)}`
    })));
  };

  // Registrar Nuevo Cierre de Lote
  const handleSubmitNuevoLote = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return alert('Modo solo lectura.');
    const bruto = typeof formMontoBruto === 'number' ? formMontoBruto : 0;
    const comision = typeof formComisionBs === 'number' ? formComisionBs : 0;
    const neto = bruto - comision;

    const nuevoLote: ConciliacionPOS = {
      id: Date.now(),
      fecha_operacion: formFechaOperacion,
      fecha_cierre_lote: formFechaOperacion,
      lote_numero: formLote.trim(),
      tipo_tarjeta: formTipo,
      banco: formBanco,
      monto_bruto_pos_bs: bruto,
      comision_bancaria_bs: comision,
      comision_porcentaje: formComisionPct,
      monto_neto_liquidado_bs: neto,
      diferencia_cuadre_bs: 0.00,
      estado: 'PENDIENTE',
      notas: formNotas.trim() || 'Cierre registrado, pendiente confirmación en extracto',
      usuario: currentRole === 'admin' ? 'Director Médico (Admin)' : 'Asistente Administrativo'
    };

    setLotes([nuevoLote, ...lotes]);
    setOpenModalRegistro(false);
    // Limpiar formulario
    setFormLote('');
    setFormMontoBruto('');
    setFormComisionBs('');
    setFormNotas('');
  };

  // Filtros de Lotes
  const lotesFiltrados = useMemo(() => {
    return lotes.filter((l) => {
      const matchSearch =
        l.lote_numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.banco.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.usuario.toLowerCase().includes(searchQuery.toLowerCase());

      const matchEstado = filtroEstado === 'TODOS' || l.estado === filtroEstado;
      const matchTipo = filtroTipoTarjeta === 'TODAS' || l.tipo_tarjeta === filtroTipoTarjeta;

      return matchSearch && matchEstado && matchTipo;
    });
  }, [lotes, searchQuery, filtroEstado, filtroTipoTarjeta]);

  // Totales
  const totalBrutoBs = lotesFiltrados.reduce((acc, l) => acc + l.monto_bruto_pos_bs, 0);
  const totalComisionesBs = lotesFiltrados.reduce((acc, l) => acc + l.comision_bancaria_bs, 0);
  const totalNetoLiquidadoBs = lotesFiltrados.reduce((acc, l) => acc + l.monto_neto_liquidado_bs, 0);
  const totalLotesPendientes = lotes.filter(l => l.estado === 'PENDIENTE').length;

  // Filtros de Pagos de Caja
  const pagosFiltrados = useMemo(() => {
    return pagosCaja.filter(p => {
      const matchSearch =
        p.paciente.toLowerCase().includes(busquedaPagos.toLowerCase()) ||
        p.cedula.toLowerCase().includes(busquedaPagos.toLowerCase()) ||
        p.referencia.toLowerCase().includes(busquedaPagos.toLowerCase()) ||
        p.factura_id.toLowerCase().includes(busquedaPagos.toLowerCase());

      const matchMetodo = filtroMetodoPago === 'TODOS' || p.metodo === filtroMetodoPago;
      return matchSearch && matchMetodo;
    });
  }, [pagosCaja, busquedaPagos, filtroMetodoPago]);

  const totalPagosPendientes = pagosCaja.filter(p => p.estado === 'PENDIENTE').length;
  const totalBsPagosRecibidos = pagosFiltrados.reduce((acc, p) => acc + p.monto_bs, 0);

  // Exportar Excel de Lotes
  const handleExportExcel = () => {
    const data = lotesFiltrados.map((l) => ({
      'N° Lote': l.lote_numero,
      'Fecha Operación': l.fecha_operacion,
      'Tipo Tarjeta': l.tipo_tarjeta,
      'Terminal / Banco': l.banco,
      'Bruto POS (Bs)': l.monto_bruto_pos_bs,
      'Comisión Banco (Bs)': l.comision_bancaria_bs,
      '% Comisión': l.comision_porcentaje,
      'Neto Liquidado (Bs)': l.monto_neto_liquidado_bs,
      'Diferencia (Bs)': l.diferencia_cuadre_bs,
      'Estado': l.estado,
      'Auditor': l.usuario,
      'Notas': l.notas || ''
    }));

    exportarAExcel('Auditoria_Conciliacion_POS', [
      { nombreHoja: 'Cierres de Lote POS', data }
    ]);
  };

  // Exportar PDF
  const handleExportPDF = () => {
    const filas = lotesFiltrados.map((l) => [
      `Lote #${l.lote_numero}`,
      l.fecha_operacion,
      l.tipo_tarjeta,
      l.banco,
      `Bs. ${l.monto_bruto_pos_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
      `-Bs. ${l.comision_bancaria_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
      `Bs. ${l.monto_neto_liquidado_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
      l.estado
    ]);

    exportarAPDF({
      titulo: 'AUDITORÍA Y CONCILIACIÓN DE PUNTOS DE VENTA (POS)',
      subtitulo: 'Centro Clínico Radiológico Imagen Salud, C.A. — Terminales TDD / TDC (Puntos de Venta)',
      nombreArchivo: 'Conciliacion_POS_Clinica',
      kpis: [
        { label: 'Total Lotes', valor: `${lotesFiltrados.length}` },
        { label: 'Total Bruto POS', valor: `Bs. ${totalBrutoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` },
        { label: 'Total Comisiones', valor: `Bs. ${totalComisionesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` },
        { label: 'Neto Liquidado', valor: `Bs. ${totalNetoLiquidadoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` }
      ],
      columnas: ['Lote', 'Fecha', 'Tipo', 'Terminal', 'Bruto POS', 'Comisión', 'Neto Banco', 'Estado'],
      filas
    });
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Auditoría Interactiva con Acción Directa */}
      {lotesPendientesDiasPrevios.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in-50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-rose-950 text-sm">
                Alerta de Auditoría: {lotesPendientesDiasPrevios.length} Lote(s) sin Conciliar de Días Anteriores
              </h4>
              <p className="text-xs text-rose-800 mt-0.5">
                Existen cierres de lote bancarios sin confirmar abono en cuenta bancaria. Es obligatorio conciliar antes del cierre final.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {lotesPendientesDiasPrevios.map(p => (
                  <Badge key={p.id} className="bg-white text-rose-900 border border-rose-300 font-mono text-[11px] py-1 px-2.5">
                    Lote #{p.lote_numero} • {p.banco} ({p.fecha_operacion}) — Bs. {p.monto_bruto_pos_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            <Button
              onClick={() => handleAbrirModalConciliar(lotesPendientesDiasPrevios[0])}
              className="w-full sm:w-auto rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 h-9 shadow-sm flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>⚡ Conciliar Este Lote Ahora</span>
            </Button>
          </div>
        </div>
      )}

      {/* Encabezado Corporativo y Conmutador de Pestañas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-clinica-selection rounded-xl text-clinica-primary">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">Conciliación Bancaria y Puntos de Venta</h2>
              <Badge className="bg-[#1D7A70] text-white text-[10px] font-mono">
                POS & Caja
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de lotes de tarjetas de débito y crédito POS, y conciliación de cobros recibidos contra extractos bancarios
            </p>
          </div>
        </div>

        {/* Conmutador de Pestañas: Lotes POS vs Pagos de Caja */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSubTab('lotes')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                subTab === 'lotes'
                  ? 'bg-white text-[#1D7A70] shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Cierres de Lote POS ({lotes.length})</span>
            </button>
            <button
              onClick={() => setSubTab('pagos_caja')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                subTab === 'pagos_caja'
                  ? 'bg-white text-[#1D7A70] shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Pagos Recibidos en Caja ({pagosCaja.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={handleExportExcel}
              className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold flex items-center gap-1 shadow-none"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              size="sm"
              onClick={handleExportPDF}
              className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold flex items-center gap-1 shadow-none"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            {subTab === 'lotes' && !isReadOnly && (
              <Button
                size="sm"
                onClick={() => setOpenModalRegistro(true)}
                className="h-8 px-3 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Registrar Lote</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {subTab === 'lotes' ? 'Bruto Facturado en POS' : 'Total Cobrado en Caja'}
          </p>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Bs. {(subTab === 'lotes' ? totalBrutoBs : totalBsPagosRecibidos).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            {subTab === 'lotes' ? 'Cobros totales en terminales' : 'Tarjetas POS y Pago Móvil'}
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Comisiones Retenidas</p>
          <h3 className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
            - Bs. {totalComisionesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Retención bancaria aplicada (1.5% - 3%)</p>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Neto Acreditado en Banco</p>
          <h3 className="text-xl sm:text-2xl font-black text-[#1D7A70] mt-1">
            Bs. {totalNetoLiquidadoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Fondos disponibles en cuentas de la clínica</p>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estado de Conciliación</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">
              {subTab === 'lotes' ? lotesFiltrados.length : pagosFiltrados.length}
            </h3>
            <span className="text-xs text-slate-400">registros</span>
          </div>
          <p className="text-[11px] font-bold text-rose-600 mt-1">
            {(subTab === 'lotes' ? totalLotesPendientes : totalPagosPendientes)} pendientes de conciliar
          </p>
        </Card>
      </div>

      {/* 1. SECCIÓN: CIERRES DE LOTE POS */}
      {subTab === 'lotes' && (
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
      )}

      {/* 2. SECCIÓN: CONCILIACIÓN DE PAGOS RECIBIDOS EN CAJA (INDIVIDUAL) */}
      {subTab === 'pagos_caja' && (
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
      )}

      {/* MODAL 1: REGISTRAR NUEVO CIERRE DE LOTE */}
      <Dialog open={openModalRegistro} onOpenChange={setOpenModalRegistro}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <div className="p-2 bg-clinica-selection rounded-xl text-clinica-primary">
                <CreditCard className="w-5 h-5" />
              </div>
              <span>Registrar Cierre de Lote POS</span>
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Captura del reporte de cierre de terminal emitido al final del turno
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmitNuevoLote} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">N° de Lote (Comprobante Terminal)</label>
                <Input
                  placeholder="Ej. 000415"
                  value={formLote}
                  onChange={(e) => setFormLote(e.target.value)}
                  required
                  className="text-xs rounded-xl h-10 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Tipo de Tarjeta</label>
                <select
                  value={formTipo}
                  onChange={(e) => handleTipoChange(e.target.value as Parameters<typeof handleTipoChange>[0])}
                  className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value="TDD">TDD (Tarjeta Débito - 1.5%)</option>
                  <option value="TDC">TDC (Tarjeta Crédito - 3.0%)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Terminal / Punto de Venta</label>
                <select
                  value={formBanco}
                  onChange={(e) => setFormBanco(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                >
                  <option value="Banco Banesco (Punto 01 - Admisión)">Banco Banesco (Punto 01 - Admisión)</option>
                  <option value="Banco Mercantil (Punto 02 - Triaje)">Banco Mercantil (Punto 02 - Triaje)</option>
                  <option value="Banco de Venezuela (Punto 03 - Caja)">Banco de Venezuela (Punto 03 - Caja)</option>
                  <option value="Bancamiga (Punto Inalámbrico)">Bancamiga (Punto Inalámbrico)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Fecha de Cierre Lote</label>
                <Input
                  type="date"
                  value={formFechaOperacion}
                  onChange={(e) => setFormFechaOperacion(e.target.value)}
                  required
                  className="text-xs rounded-xl h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Monto Bruto Total del Lote (Bs)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formMontoBruto}
                  onChange={(e) => handleBrutoChange(e.target.value)}
                  required
                  className="text-xs rounded-xl h-10 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Comisión Bancaria Debitada (Bs)
                  <span className="text-[10px] text-slate-400 ml-1">({formComisionPct}%)</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formComisionBs}
                  onChange={(e) => setFormComisionBs(parseFloat(e.target.value) || '')}
                  required
                  className="text-xs rounded-xl h-10 font-mono text-rose-600 font-bold"
                />
              </div>
            </div>

            {/* Cálculo Resumen de Neto */}
            {typeof formMontoBruto === 'number' && typeof formComisionBs === 'number' && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Neto Esperado en Cuenta:</span>
                  <span className="font-mono text-[#1D7A70]">
                    Bs. {(formMontoBruto - formComisionBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Notas u Observaciones de Auditoría</label>
              <Input
                placeholder="Ej. Cierre nocturno turno sábado..."
                value={formNotas}
                onChange={(e) => setFormNotas(e.target.value)}
                className="text-xs rounded-xl h-10"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenModalRegistro(false)}
                className="rounded-xl text-xs h-10"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white font-bold text-xs h-10 shadow-sm"
              >
                Guardar Cierre de Lote
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CONCILIAR ABONO BANCARIO DEL LOTE (AUDITORÍA) */}
      <Dialog open={openModalConciliar} onOpenChange={setOpenModalConciliar}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span>Conciliar Lote en Extracto Bancario</span>
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Validar y confirmar acreditación del Lote #{loteAConciliar?.lote_numero} ({loteAConciliar?.banco})
            </p>
          </DialogHeader>

          {loteAConciliar && (
            <div className="space-y-4 py-2 text-xs">
              {/* Resumen del Lote */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Monto Bruto Facturado en POS:</span>
                  <span className="font-mono font-bold text-slate-900">
                    Bs. {loteAConciliar.monto_bruto_pos_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Comisión Bancaria Retenida ({loteAConciliar.comision_porcentaje}%):</span>
                  <span className="font-mono font-bold">
                    -Bs. {loteAConciliar.comision_bancaria_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-sm text-[#1D7A70]">
                  <span>Neto Liquidado Esperado:</span>
                  <span className="font-mono">
                    Bs. {loteAConciliar.monto_neto_liquidado_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Formulario de Confirmación en Extracto */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Cuenta Bancaria Receptora</label>
                  <select
                    value={cuentaConciliacion}
                    onChange={e => setCuentaConciliacion(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                  >
                    {cuentas && cuentas.length > 0 ? (
                      cuentas.filter(c => c.moneda === 'BS').map(c => (
                        <option key={c.id} value={c.nombre}>{c.nombre} ({c.codigo})</option>
                      ))
                    ) : (
                      <>
                        <option value="Banco de Venezuela - Corriente">Banco de Venezuela - Cta Cte Principal</option>
                        <option value="Banco Banesco - Corriente">Banco Banesco - Recaudación POS</option>
                        <option value="Banco Mercantil - Corriente">Banco Mercantil - Operaciones</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">N° Referencia Extracto</label>
                    <Input
                      placeholder="Ej. REF-892341"
                      value={refBancaria}
                      onChange={e => setRefBancaria(e.target.value)}
                      className="text-xs rounded-xl h-9 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Fecha de Abono en Cuenta</label>
                    <Input
                      type="date"
                      value={fechaAbono}
                      onChange={e => setFechaAbono(e.target.value)}
                      className="text-xs rounded-xl h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Monto Real Acreditado en Cuenta (Bs)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={montoRealAcreditado}
                    onChange={e => setMontoRealAcreditado(e.target.value)}
                    className="text-xs rounded-xl h-9 font-mono font-black text-[#1D7A70]"
                  />
                  {parseFloat(montoRealAcreditado) - loteAConciliar.monto_neto_liquidado_bs !== 0 && (
                    <p className="text-[10px] font-bold text-amber-600 mt-1">
                      Diferencia de cuadre: Bs. {(parseFloat(montoRealAcreditado) - loteAConciliar.monto_neto_liquidado_bs).toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Notas de Auditoría</label>
                  <Input
                    placeholder="Ej. Abono verificado contra extracto online"
                    value={notasConciliacion}
                    onChange={e => setNotasConciliacion(e.target.value)}
                    className="text-xs rounded-xl h-9"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setOpenModalConciliar(false)}
                  className="flex-1 rounded-xl text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarConciliacion}
                  className="flex-1 rounded-xl bg-[#1D7A70] hover:bg-[#155A52] text-white text-xs font-bold h-9 shadow-sm"
                >
                  Confirmar y Conciliar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
