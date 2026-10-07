'use client';

import { useFechaOperacion } from './FechaOperacion';
import { DevolucionesPendientes } from './DevolucionesPendientes';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Wallet, 
  DollarSign, 
  Smartphone, 
  Landmark, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  FileSpreadsheet, 
  FileText, 
  Search, 
  Filter, 
  RefreshCw,
  X,
  FileText as FileIcon
} from 'lucide-react';
import { exportarAExcel, exportarAPDF } from '@/lib/exportUtils';
import { CuentaBancaria } from '@/types';
import { getErrorMessage } from '@/lib/utils';

interface ModuloEgresosOperativosProps {
  currentRole: 'admin' | 'cajero';
  cuentas: CuentaBancaria[];
  onEgresoRegistrado?: () => void;
}

interface RegistroFinanciero {
  id: number;
  tipo: 'EGRESO' | 'INGRESO_EXTRA';
  cuenta_id: number;
  cuenta_nombre: string;
  categoria: string;
  concepto_libre: string;
  monto: number;
  moneda: string;
  comision_pago_movil_bs?: number;
  total_debitado?: number;
  referencia: string;
  fecha: string;
  beneficiario?: string;
}

/** Fila cruda devuelta por /api/tesoreria/egresos-operativos e ingresos-extraordinarios. */
interface RegistroApi {
  id: number;
  cuenta_id: number;
  cuenta_nombre?: string;
  categoria?: string;
  concepto_libre?: string;
  descripcion?: string;
  concepto?: string;
  monto_neto?: number | string;
  monto?: number | string;
  moneda?: string;
  comision_pago_movil_bs?: number | string;
  monto_total_debitado?: number | string;
  total_debitado?: number | string;
  referencia?: string;
  created_at?: string;
  beneficiario?: string;
  origen?: string;
}

export const ModuloEgresosOperativos: React.FC<ModuloEgresosOperativosProps> = ({
  currentRole,
  cuentas,
  onEgresoRegistrado
}) => {
  const isAdmin = currentRole === 'admin';
  const [tabActiva, setTabActiva] = useState<'egreso' | 'ingreso' | 'historial'>('egreso');
  const [loading, setLoading] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  // Formulario Egreso Operativo
  const [egresoCuentaId, setEgresoCuentaId] = useState<string>('');
  const [egresoCategoria, setEgresoCategoria] = useState<string>('Insumos Médicos');
  const [egresoConceptoLibre, setEgresoConceptoLibre] = useState<string>('');
  const [egresoMonto, setEgresoMonto] = useState<string>('');
  const [egresoComisionPM, setEgresoComisionPM] = useState<string>('');
  const [egresoReferencia, setEgresoReferencia] = useState<string>('');
  const fechaOp = useFechaOperacion();
  const [egresoBeneficiario, setEgresoBeneficiario] = useState<string>('');

  // Formulario Ingreso Extraordinario
  const [ingresoCuentaId, setIngresoCuentaId] = useState<string>('');
  const [ingresoCategoria, setIngresoCategoria] = useState<string>('Aporte de Capital');
  const [ingresoConceptoLibre, setIngresoConceptoLibre] = useState<string>('');
  const [ingresoMonto, setIngresoMonto] = useState<string>('');
  const [ingresoReferencia, setIngresoReferencia] = useState<string>('');
  const [ingresoOrigen, setIngresoOrigen] = useState<string>('');

  // Historial y Filtros
  const [historial, setHistorial] = useState<RegistroFinanciero[]>([]);
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'EGRESO' | 'INGRESO_EXTRA'>('TODOS');
  const [filtroCuenta, setFiltroCuenta] = useState<string>('TODAS');

  // Cuenta por defecto: se ajusta durante el render (patrón recomendado por React) en vez de en un efecto
  if (cuentas.length > 0 && !egresoCuentaId) {
    setEgresoCuentaId(cuentas[0].id.toString());
    setIngresoCuentaId(cuentas[0].id.toString());
  }

  // Obtiene el historial de egresos e ingresos extraordinarios (sin tocar el estado)
  const obtenerHistorial = async (): Promise<RegistroFinanciero[]> => {
    try {
      // Consultar transacciones de egresos e ingresos
      const resEgresos = await fetch('/api/tesoreria/egresos-operativos').catch(() => null);
      const resIngresos = await fetch('/api/tesoreria/ingresos-extraordinarios').catch(() => null);
      
      let list: RegistroFinanciero[] = [];

      if (resEgresos && resEgresos.ok) {
        const data = await resEgresos.json();
        if (Array.isArray(data)) {
          list = [...list, ...data.map((item: RegistroApi) => ({
            id: item.id,
            tipo: 'EGRESO' as const,
            cuenta_id: item.cuenta_id,
            cuenta_nombre: item.cuenta_nombre || `Cuenta #${item.cuenta_id}`,
            categoria: item.categoria || 'Gasto Operativo',
            concepto_libre: item.concepto_libre || item.descripcion || item.concepto || 'Sin concepto',
            monto: Number(item.monto_neto || item.monto || 0),
            moneda: item.moneda || 'BS',
            comision_pago_movil_bs: Number(item.comision_pago_movil_bs || 0),
            total_debitado: Number(item.monto_total_debitado || item.total_debitado || item.monto || 0),
            referencia: item.referencia || 'S/R',
            fecha: item.created_at ? new Date(item.created_at).toLocaleString('es-VE') : new Date().toLocaleDateString('es-VE'),
            beneficiario: item.beneficiario || 'N/A'
          }))];
        }
      }

      if (resIngresos && resIngresos.ok) {
        const data = await resIngresos.json();
        if (Array.isArray(data)) {
          list = [...list, ...data.map((item: RegistroApi) => ({
            id: item.id,
            tipo: 'INGRESO_EXTRA' as const,
            cuenta_id: item.cuenta_id,
            cuenta_nombre: item.cuenta_nombre || `Cuenta #${item.cuenta_id}`,
            categoria: item.categoria || 'Ingreso Extraordinario',
            concepto_libre: item.concepto_libre || item.descripcion || 'Sin concepto',
            monto: Number(item.monto || 0),
            moneda: item.moneda || 'BS',
            referencia: item.referencia || 'S/R',
            fecha: item.created_at ? new Date(item.created_at).toLocaleString('es-VE') : new Date().toLocaleDateString('es-VE'),
            beneficiario: item.origen || 'N/A'
          }))];
        }
      }

      return list.sort((a, b) => b.id - a.id);
    } catch (err) {
      console.error('Error cargando historial de egresos/ingresos:', err);
      return [];
    }
  };

  const cargarHistorial = async () => {
    setHistorial(await obtenerHistorial());
  };

  useEffect(() => {
    let vivo = true;
    obtenerHistorial().then((lista) => { if (vivo) setHistorial(lista); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determinar cuenta seleccionada en Egreso
  const cuentaEgresoSeleccionada = useMemo(() => {
    return cuentas.find(c => c.id.toString() === egresoCuentaId);
  }, [cuentas, egresoCuentaId]);

  const esPagoMovilEgreso = useMemo(() => {
    if (!cuentaEgresoSeleccionada) return false;
    const nombre = cuentaEgresoSeleccionada.nombre.toUpperCase();
    const tipo = (cuentaEgresoSeleccionada.tipo || '').toUpperCase();
    return nombre.includes('MOVIL') || tipo.includes('PAGO_MOVIL');
  }, [cuentaEgresoSeleccionada]);

  // Cálculo estricto de débito total en Pago Móvil
  const montoEgresoNum = parseFloat(egresoMonto) || 0;
  const comisionPMNum = parseFloat(egresoComisionPM) || 0;
  const totalDebitadoEgreso = montoEgresoNum + comisionPMNum;

  // Manejar Registro de Egreso Operativo
  const handleRegistrarEgreso = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    if (!egresoCuentaId) {
      setMensajeError('Debe seleccionar la cuenta bancaria de origen.');
      return;
    }
    if (!egresoConceptoLibre.trim()) {
      setMensajeError('El campo "Concepto Libre" es obligatorio para justificar el gasto contable.');
      return;
    }
    if (montoEgresoNum <= 0) {
      setMensajeError('Ingrese un monto válido mayor a 0.');
      return;
    }

    if (egresoComisionPM && (isNaN(parseFloat(egresoComisionPM)) || parseFloat(egresoComisionPM) < 0)) {
      setMensajeError('La comisión manual debe ser un número válido mayor o igual a 0.');
      return;
    }
    if (esPagoMovilEgreso && !egresoReferencia.trim()) {
      setMensajeError('Debe ingresar la referencia bancaria del Pago Móvil.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        cuenta_id: parseInt(egresoCuentaId),
        categoria: egresoCategoria,
        concepto_libre: egresoConceptoLibre.trim(),
        monto_neto: montoEgresoNum,
        comision_pago_movil_bs: comisionPMNum,
        comision_bancaria: comisionPMNum,
        monto_total_debitado: totalDebitadoEgreso,
        referencia: egresoReferencia.trim() || 'EGRESO_OPERATIVO',
        beneficiario: egresoBeneficiario.trim() || 'Proveedor General',
        ...fechaOp.payload,
        usuario: 'Administrador'
      };

      const res = await fetch('/api/tesoreria/egresos-operativos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al procesar el egreso operativo.');
      }

      setMensajeExito(`Egreso registrado exitosamente. Total debitado: ${totalDebitadoEgreso.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${cuentaEgresoSeleccionada?.moneda || 'BS'}.`);
      setEgresoConceptoLibre('');
      setEgresoMonto('');
      setEgresoComisionPM('');
      setEgresoReferencia('');
      setEgresoBeneficiario('');
      cargarHistorial();
      if (onEgresoRegistrado) onEgresoRegistrado();
    } catch (err) {
      setMensajeError(getErrorMessage(err) || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  // Manejar Registro de Ingreso Extraordinario
  const handleRegistrarIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    const montoNum = parseFloat(ingresoMonto) || 0;
    if (!ingresoCuentaId) {
      setMensajeError('Seleccione la cuenta bancaria de destino.');
      return;
    }
    if (!ingresoConceptoLibre.trim()) {
      setMensajeError('El campo "Concepto Libre" es obligatorio para detallar el origen de los fondos.');
      return;
    }
    if (montoNum <= 0) {
      setMensajeError('Ingrese un monto válido mayor a 0.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        cuenta_id: parseInt(ingresoCuentaId),
        categoria: ingresoCategoria,
        concepto_libre: ingresoConceptoLibre.trim(),
        monto: montoNum,
        referencia: ingresoReferencia.trim() || 'INGRESO_EXTRA',
        origen: ingresoOrigen.trim() || 'Aporte Extraordinario',
        ...fechaOp.payload,
        usuario: 'Administrador'
      };

      const res = await fetch('/api/tesoreria/ingresos-extraordinarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al procesar el ingreso extraordinario.');
      }

      setMensajeExito(`Ingreso extraordinario asentado con éxito en la cuenta seleccionada.`);
      setIngresoConceptoLibre('');
      setIngresoMonto('');
      setIngresoReferencia('');
      setIngresoOrigen('');
      cargarHistorial();
      if (onEgresoRegistrado) onEgresoRegistrado();
    } catch (err) {
      setMensajeError(getErrorMessage(err) || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  // Filtrado de Historial
  const historialFiltrado = useMemo(() => {
    return historial.filter(item => {
      if (filtroTipo !== 'TODOS' && item.tipo !== filtroTipo) return false;
      if (filtroCuenta !== 'TODAS' && item.cuenta_nombre !== filtroCuenta) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const coincideConcepto = item.concepto_libre.toLowerCase().includes(q);
        const coincideRef = item.referencia.toLowerCase().includes(q);
        const coincideCat = item.categoria.toLowerCase().includes(q);
        if (!coincideConcepto && !coincideRef && !coincideCat) return false;
      }
      return true;
    });
  }, [historial, filtroTipo, filtroCuenta, busqueda]);

  // Exportaciones
  const handleExportarExcel = () => {
    if (historialFiltrado.length === 0) return alert('No hay registros filtrados para exportar.');

    const data = historialFiltrado.map(h => ({
      'ID Registro': `#${h.id}`,
      'Tipo Operación': h.tipo === 'EGRESO' ? 'Gasto Operativo' : 'Ingreso Extraordinario',
      'Cuenta Afectada': h.cuenta_nombre,
      'Categoría': h.categoria,
      'Concepto Libre (Detallado)': h.concepto_libre,
      'Monto Neto': h.monto,
      'Comisión Manual PM': h.comision_pago_movil_bs || 0,
      'Total Debitado / Acreditado': h.total_debitado || h.monto,
      'Moneda': h.moneda,
      'Referencia': h.referencia,
      'Beneficiario / Origen': h.beneficiario || 'N/A',
      'Fecha': h.fecha
    }));

    exportarAExcel('Flujo_Egresos_E_Ingresos_Imagen_Salud', [
      { nombreHoja: 'Egresos e Ingresos Extra', data }
    ]);
  };

  const handleExportarPDF = () => {
    if (historialFiltrado.length === 0) return alert('No hay registros filtrados para exportar.');

    const totalEgresos = historialFiltrado
      .filter(h => h.tipo === 'EGRESO')
      .reduce((acc, h) => acc + (h.total_debitado || h.monto), 0);

    const totalIngresos = historialFiltrado
      .filter(h => h.tipo === 'INGRESO_EXTRA')
      .reduce((acc, h) => acc + h.monto, 0);

    const totalComisiones = historialFiltrado
      .reduce((acc, h) => acc + (h.comision_pago_movil_bs || 0), 0);

    const filas = historialFiltrado.map(h => [
      `#${h.id}`,
      h.tipo === 'EGRESO' ? 'EGRESO' : 'INGRESO',
      h.cuenta_nombre.slice(0, 16),
      h.categoria.slice(0, 18),
      h.concepto_libre.slice(0, 28),
      h.tipo === 'EGRESO' ? `-${(h.total_debitado || h.monto).toFixed(2)}` : `+${h.monto.toFixed(2)}`,
      h.comision_pago_movil_bs ? `${h.comision_pago_movil_bs.toFixed(2)} Bs` : '-',
      h.referencia
    ]);

    exportarAPDF({
      titulo: 'CONTROL DE GASTOS OPERATIVOS E INGRESOS EXTRAORDINARIOS',
      subtitulo: 'Centro Clínico Radiológico Imagen Salud, C.A. — Auditoría de Comisiones y Egresos',
      nombreArchivo: 'Reporte_Egresos_Operativos',
      kpis: [
        { label: 'Egresos Totales', valor: `${totalEgresos.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs` },
        { label: 'Ingresos Extra', valor: `${totalIngresos.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs` },
        { label: 'Comisiones Manuales', valor: `${totalComisiones.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs` },
        { label: 'Registros', valor: `${historialFiltrado.length}` }
      ],
      columnas: ['ID', 'Tipo', 'Cuenta', 'Categoría', 'Concepto Libre', 'Monto Total', 'Comisión PM', 'Referencia'],
      filas
    });
  };

  const categoriasEgreso = [
    'Insumos Médicos (Gel, Rollos, Agujas)',
    'Servicios Públicos (Electricidad, Agua, Internet)',
    'Mantenimiento y Reparaciones',
    'Alquiler de Sede',
    'Material de Oficina y Papelería',
    'Honorarios Extraordinarios de Personal',
    'Gastos Administrativos Generales',
    'Otros Egresos'
  ];

  const categoriasIngreso = [
    'Aporte de Capital de Socios',
    'Reintegro de Fondos / Devolución',
    'Venta de Activo Fijo / Equipos',
    'Ingreso Financiero Extraordinario',
    'Otros Ingresos'
  ];

  return (
    <div className="space-y-6">
      <DevolucionesPendientes onPagada={onEgresoRegistrado} />
      {/* Header Corporativo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-rose-600" />
            Flujo de Egresos Operativos y Entradas Extraordinarias
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Asiento de gastos de insumos, servicios y aportes con regla obligatoria de comisión de Pago Móvil 100% manual
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'egreso', label: 'Nuevo Gasto Operativo', icon: ArrowDownRight, color: 'bg-rose-600' },
            { id: 'ingreso', label: 'Ingreso Extraordinario', icon: ArrowUpRight, color: 'bg-emerald-600' },
            { id: 'historial', label: 'Historial y Auditoría', icon: FileIcon, color: 'bg-slate-900' }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = tabActiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTabActiva(tab.id as Parameters<typeof setTabActiva>[0])}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  isSelected 
                    ? `${tab.color} text-white shadow-md` 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alertas de Éxito / Error */}
      {mensajeExito && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 font-bold animate-in fade-in-50">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}
      {mensajeError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-800 font-bold animate-in fade-in-50">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{mensajeError}</span>
        </div>
      )}

      {/* PESTAÑA 1: NUEVO GASTO OPERATIVO (EGRESO) */}
      {tabActiva === 'egreso' && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-4 px-6">
            <CardTitle className="text-sm font-black text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
                Formulario de Salida de Dinero (Gasto Operativo)
              </span>
              <Badge className="bg-rose-100 text-rose-800 font-mono text-[10px] font-bold">
                Débito en Bóveda
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleRegistrarEgreso} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cuenta de Origen */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Cuenta Bancaria de Origen *
                  </label>
                  <select
                    value={egresoCuentaId}
                    onChange={e => setEgresoCuentaId(e.target.value)}
                    className="w-full text-xs py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-rose-500"
                  >
                    {cuentas.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} (Saldo: {c.moneda === 'USD' ? `$${Number(c.saldo_actual || 0).toFixed(2)}` : `Bs. ${Number(c.saldo_actual || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categoría Predefinida */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Categoría del Gasto *
                  </label>
                  <select
                    value={egresoCategoria}
                    onChange={e => setEgresoCategoria(e.target.value)}
                    className="w-full text-xs py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-rose-500"
                  >
                    {categoriasEgreso.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Concepto Libre (Obligatorio y Detallado) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Concepto Libre / Justificación del Gasto *</span>
                  <span className="text-[10px] text-slate-500 font-normal">Texto descriptivo obligatorio para auditoría</span>
                </label>
                <Input
                  value={egresoConceptoLibre}
                  onChange={e => setEgresoConceptoLibre(e.target.value)}
                  placeholder="Ej: Compra de 5 galones de gel ultrasonido y 2 resmas de papel térmico Sony según Factura #892"
                  className="text-xs bg-slate-50 border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Monto Neto */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Monto Neto del Egreso *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-500">
                      {cuentaEgresoSeleccionada?.moneda === 'USD' ? '$' : 'Bs.'}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={egresoMonto}
                      onChange={e => setEgresoMonto(e.target.value)}
                      placeholder="0.00"
                      className="pl-9 font-mono font-bold text-xs bg-slate-50 border-slate-200 rounded-xl"
                      required
                    />
                  </div>
                </div>

                {/* Proveedor / Beneficiario */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Beneficiario / Proveedor
                  </label>
                  <Input
                    value={egresoBeneficiario}
                    onChange={e => setEgresoBeneficiario(e.target.value)}
                    placeholder="Ej: Inversiones Médicas Caracas C.A."
                    className="text-xs bg-slate-50 border-slate-200 rounded-xl"
                  />
                </div>

                {fechaOp.campo}

                {/* Referencia Bancaria */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    N° de Referencia / Comprobante
                  </label>
                  <Input
                    value={egresoReferencia}
                    onChange={e => setEgresoReferencia(e.target.value)}
                    placeholder="Ej: 049281"
                    className="text-xs bg-slate-50 border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* VALIDACIÓN MANUAL DE COMISIÓN BANCARIA EN EGRESOS */}
              <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-2xl space-y-3 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-amber-950 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-amber-600" />
                    Validación Manual de Comisión Bancaria (Comprobante Real)
                  </span>
                  <Badge className="bg-amber-200 text-amber-900 text-[10px] font-bold border border-amber-300">
                    Manual 100%
                  </Badge>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Ingrese manualmente el monto exacto de la comisión o tarifa bancaria cobrada en el comprobante (0 si no aplica comisión).
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      Comisión Bancaria Manual ({cuentaEgresoSeleccionada?.moneda || 'Bs'})
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={egresoComisionPM}
                      onChange={e => setEgresoComisionPM(e.target.value)}
                      placeholder="0.00 (ej. 3.50)"
                      className="bg-white border-amber-300 font-mono font-bold text-xs rounded-xl"
                    />
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200 flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Total Real a Debitar en Cuenta:
                    </p>
                    <p className="text-base font-black font-mono text-rose-700 mt-0.5">
                      {totalDebitadoEgreso.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {cuentaEgresoSeleccionada?.moneda || 'Bs'}
                    </p>
                    <p className="text-[9px] text-slate-500">
                      ({montoEgresoNum.toFixed(2)} Neto + {comisionPMNum.toFixed(2)} Comisión Manual)
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-3 rounded-xl shadow-md shadow-rose-600/20"
              >
                {loading ? 'Procesando débito contable...' : 'Registrar Egreso Operativo'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* PESTAÑA 2: NUEVO INGRESO EXTRAORDINARIO */}
      {tabActiva === 'ingreso' && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-4 px-6">
            <CardTitle className="text-sm font-black text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                Formulario de Entrada Extraordinaria de Fondos
              </span>
              <Badge className="bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                Crédito en Bóveda
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleRegistrarIngreso} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cuenta de Destino */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Cuenta Bancaria de Destino *
                  </label>
                  <select
                    value={ingresoCuentaId}
                    onChange={e => setIngresoCuentaId(e.target.value)}
                    className="w-full text-xs py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-500"
                  >
                    {cuentas.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.moneda})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categoría de Ingreso */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Categoría del Ingreso *
                  </label>
                  <select
                    value={ingresoCategoria}
                    onChange={e => setIngresoCategoria(e.target.value)}
                    className="w-full text-xs py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-500"
                  >
                    {categoriasIngreso.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Concepto Libre (Obligatorio) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Concepto Libre / Detalle de Entrada *</span>
                  <span className="text-[10px] text-slate-500 font-normal">Justificación contable de la entrada</span>
                </label>
                <Input
                  value={ingresoConceptoLibre}
                  onChange={e => setIngresoConceptoLibre(e.target.value)}
                  placeholder="Ej: Aporte extraordinario de socios para renovación de transductor de ecografía"
                  className="text-xs bg-slate-50 border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Monto */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Monto a Acreditar *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={ingresoMonto}
                    onChange={e => setIngresoMonto(e.target.value)}
                    placeholder="0.00"
                    className="font-mono font-bold text-xs bg-slate-50 border-slate-200 rounded-xl"
                    required
                  />
                </div>

                {/* Origen de Fondos */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Origen / Depositante
                  </label>
                  <Input
                    value={ingresoOrigen}
                    onChange={e => setIngresoOrigen(e.target.value)}
                    placeholder="Ej: Socio Principal / Inversor"
                    className="text-xs bg-slate-50 border-slate-200 rounded-xl"
                  />
                </div>

                {fechaOp.campo}

                {/* Referencia */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    N° de Referencia Bancaria
                  </label>
                  <Input
                    value={ingresoReferencia}
                    onChange={e => setIngresoReferencia(e.target.value)}
                    placeholder="Ej: 994821"
                    className="text-xs bg-slate-50 border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl shadow-md shadow-emerald-600/20"
              >
                {loading ? 'Acreditando fondos...' : 'Registrar Ingreso Extraordinario'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* PESTAÑA 3: HISTORIAL Y AUDITORÍA DE MOVIMIENTOS */}
      {tabActiva === 'historial' && (
        <div className="space-y-4">
          {/* Barra de Filtros y Exportación */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por concepto libre, referencia o categoría..."
                className="pl-9 pr-8 text-xs bg-slate-50 border-slate-200 rounded-xl"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value as Parameters<typeof setFiltroTipo>[0])}
                className="text-xs py-1.5 px-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700"
              >
                <option value="TODOS">Todos los Tipos</option>
                <option value="EGRESO">Solo Egresos</option>
                <option value="INGRESO_EXTRA">Solo Ingresos Extra</option>
              </select>

              <Button
                size="sm"
                onClick={handleExportarExcel}
                disabled={historialFiltrado.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </Button>
              <Button
                size="sm"
                onClick={handleExportarPDF}
                disabled={historialFiltrado.length === 0}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm shadow-slate-800/20 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF (.pdf)</span>
              </Button>
            </div>
          </div>

          {/* Tabla de Registros */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black">
                  <tr>
                    <th className="p-3">Ref/ID</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Cuenta</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Concepto Libre</th>
                    <th className="p-3 text-right">Monto</th>
                    <th className="p-3 text-right">Comisión PM</th>
                    <th className="p-3 text-right">Total Débito</th>
                    <th className="p-3 text-center">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {historialFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-medium">
                        No hay movimientos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    historialFiltrado.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-mono font-bold text-slate-700">
                          #{item.id} • {item.referencia}
                        </td>
                        <td className="p-3">
                          <Badge className={item.tipo === 'EGRESO' ? 'bg-rose-100 text-rose-800 font-bold text-[10px]' : 'bg-emerald-100 text-emerald-800 font-bold text-[10px]'}>
                            {item.tipo === 'EGRESO' ? 'Egreso' : 'Ingreso Extra'}
                          </Badge>
                        </td>
                        <td className="p-3 font-bold text-slate-900">{item.cuenta_nombre}</td>
                        <td className="p-3 text-slate-600">{item.categoria}</td>
                        <td className="p-3 text-slate-800 font-medium max-w-xs truncate" title={item.concepto_libre}>
                          {item.concepto_libre}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-slate-900">
                          {item.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {item.moneda}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-700">
                          {item.comision_pago_movil_bs ? `${item.comision_pago_movil_bs.toFixed(2)} Bs` : '-'}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-rose-600">
                          {item.tipo === 'EGRESO' ? `-${(item.total_debitado || item.monto).toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : `+${item.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`} {item.moneda}
                        </td>
                        <td className="p-3 text-center text-slate-500 font-mono text-[10px]">
                          {item.fecha}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
