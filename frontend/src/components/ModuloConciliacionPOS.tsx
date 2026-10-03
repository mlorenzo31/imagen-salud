'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';import { exportarAExcel, exportarAPDF } from '@/lib/exportUtils';
import { ConciliacionPOS, UserRole, ModoOperacion, CuentaBancaria } from '@/types';
import { hoyLocal } from '@/lib/date';
import { ConciliarDialog } from '@/components/conciliacion/ConciliarDialog';
import { RegistrarPagoDialog } from '@/components/conciliacion/RegistrarPagoDialog';
import { SeccionPagosRecibidos } from '@/components/conciliacion/SeccionPagosRecibidos';
import { SeccionLotesPOS } from '@/components/conciliacion/SeccionLotesPOS';
import { EncabezadoConciliacion } from '@/components/conciliacion/EncabezadoConciliacion';

interface ModuloConciliacionPOSProps {
  currentRole: UserRole;
  modoOperacion: ModoOperacion;
  cuentas: CuentaBancaria[];
  onConciliacionCompletada?: () => void;
}

export interface PagoRecibidoCaja {
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
      <EncabezadoConciliacion setSubTab={setSubTab} subTab={subTab} lotes={lotes} pagosCaja={pagosCaja} handleExportExcel={handleExportExcel} handleExportPDF={handleExportPDF} isReadOnly={isReadOnly} setOpenModalRegistro={setOpenModalRegistro} />

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
        <SeccionLotesPOS searchQuery={searchQuery} setSearchQuery={setSearchQuery} setFiltroEstado={setFiltroEstado} filtroEstado={filtroEstado} filtroTipoTarjeta={filtroTipoTarjeta} setFiltroTipoTarjeta={setFiltroTipoTarjeta} lotesFiltrados={lotesFiltrados} isReadOnly={isReadOnly} handleReabrirLote={handleReabrirLote} handleAbrirModalConciliar={handleAbrirModalConciliar} handleConciliarRapido={handleConciliarRapido} />
      )}

      {/* 2. SECCIÓN: CONCILIACIÓN DE PAGOS RECIBIDOS EN CAJA (INDIVIDUAL) */}
      {subTab === 'pagos_caja' && (
        <SeccionPagosRecibidos busquedaPagos={busquedaPagos} setBusquedaPagos={setBusquedaPagos} filtroMetodoPago={filtroMetodoPago} setFiltroMetodoPago={setFiltroMetodoPago} isReadOnly={isReadOnly} handleConciliarTodosLosPagos={handleConciliarTodosLosPagos} pagosFiltrados={pagosFiltrados} handleConciliarPagoIndividual={handleConciliarPagoIndividual} />
      )}

      {/* MODAL 1: REGISTRAR NUEVO CIERRE DE LOTE */}
      <RegistrarPagoDialog openModalRegistro={openModalRegistro} setOpenModalRegistro={setOpenModalRegistro} handleSubmitNuevoLote={handleSubmitNuevoLote} formLote={formLote} setFormLote={setFormLote} formTipo={formTipo} handleTipoChange={handleTipoChange} formBanco={formBanco} setFormBanco={setFormBanco} formFechaOperacion={formFechaOperacion} setFormFechaOperacion={setFormFechaOperacion} formMontoBruto={formMontoBruto} handleBrutoChange={handleBrutoChange} formComisionPct={formComisionPct} formComisionBs={formComisionBs} setFormComisionBs={setFormComisionBs} formNotas={formNotas} setFormNotas={setFormNotas} />

      {/* MODAL 2: CONCILIAR ABONO BANCARIO DEL LOTE (AUDITORÍA) */}
      <ConciliarDialog openModalConciliar={openModalConciliar} setOpenModalConciliar={setOpenModalConciliar} loteAConciliar={loteAConciliar} cuentaConciliacion={cuentaConciliacion} setCuentaConciliacion={setCuentaConciliacion} cuentas={cuentas} refBancaria={refBancaria} setRefBancaria={setRefBancaria} fechaAbono={fechaAbono} setFechaAbono={setFechaAbono} montoRealAcreditado={montoRealAcreditado} setMontoRealAcreditado={setMontoRealAcreditado} notasConciliacion={notasConciliacion} setNotasConciliacion={setNotasConciliacion} handleConfirmarConciliacion={handleConfirmarConciliacion} />
    </div>
  );
};
