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
  ArrowUpRight,
  TrendingUp,
  Building2,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Calendar,
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Wallet,
  AlertCircle
} from 'lucide-react';
import { exportarAExcel, exportarAPDF } from '@/lib/exportUtils';
import { CuentaBancaria } from '@/types';
import { getErrorMessage } from '@/lib/utils';
import { hoyLocal, sumarDias } from '@/lib/date';

export interface IngresoExtraordinario {
  id: number;
  cuenta_id: number;
  cuenta_nombre?: string;
  cuenta_codigo?: string;
  categoria: string;
  concepto_libre: string;
  monto: number | string;
  moneda: string;
  referencia?: string | null;
  descripcion?: string | null;
  fecha: string;
  hora?: string;
  usuario?: string;
  creado_en?: string;
}

interface ModuloIngresosExtraordinariosProps {
  currentRole: 'admin' | 'cajero';
  cuentas: CuentaBancaria[];
  onIngresoRegistrado?: () => void;
}

const CATEGORIAS_INGRESOS = [
  'Alquiler de Consultorio / Espacio Clínico',
  'Aporte de Capital / Socios',
  'Venta de Material e Insumos Médicos',
  'Reintegro de Aseguradora / Convenio',
  'Rendimiento Bancario / Financiero',
  'Anticipo de Procedimientos Especiales',
  'Otros Ingresos Extraordinarios'
];

export const ModuloIngresosExtraordinarios: React.FC<ModuloIngresosExtraordinariosProps> = ({
  currentRole,
  cuentas,
  onIngresoRegistrado
}) => {
  const [ingresos, setIngresos] = useState<IngresoExtraordinario[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [cuentaId, setCuentaId] = useState<number>(cuentas[0]?.id || 1);
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_INGRESOS[0]);
  const [conceptoLibre, setConceptoLibre] = useState<string>('');
  const [monto, setMonto] = useState<string>('');
  const [referencia, setReferencia] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [comisionBancariaManual, setComisionBancariaManual] = useState<string>('0.00');
  const [tasaBcv, setTasaBcv] = useState<number>(0);

  // Filtros Clínicos Avanzados State
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODOS');
  const [filtroCuenta, setFiltroCuenta] = useState('TODAS');
  const [filtroPeriodo, setFiltroPeriodo] = useState<'HOY' | '7DIAS' | 'MES' | 'TODO'>('TODO');
  const [agruparPor, setAgruparPor] = useState<'NINGUNO' | 'CATEGORIA' | 'CUENTA' | 'FECHA'>('NINGUNO');
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({});

  // Cargar Tasa BCV
  useEffect(() => {
    fetch('/api/bcv')
      .then(res => res.json())
      .then(d => { if (d.tasa) setTasaBcv(d.tasa); })
      .catch(() => {});
  }, []);

  // Cargar Ingresos Extraordinarios
  const cargarIngresos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tesoreria/ingresos-extraordinarios');
      if (res.ok) {
        const data = await res.json();
        setIngresos(data);
      }
    } catch (err) {
      console.error('Error cargando ingresos extraordinarios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarIngresos();
  }, []);

  const cuentaSeleccionada = useMemo(() => {
    return cuentas.find(c => c.id === Number(cuentaId)) || cuentas[0];
  }, [cuentas, cuentaId]);

  // Manejar Registro de Nuevo Ingreso
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      alert('Por favor ingrese un monto válido mayor a 0.');
      return;
    }
    if (!conceptoLibre.trim()) {
      alert('El concepto libre es obligatorio para fines de auditoría contable.');
      return;
    }

    setSubmitting(true);
    try {
      const comisionNum = parseFloat(comisionBancariaManual) || 0;
      const montoNeto = Math.max(0, montoNum - comisionNum);
      const payload = {
        cuenta_id: Number(cuentaId),
        categoria,
        concepto_libre: conceptoLibre.trim(),
        monto: montoNum,
        comision_bancaria_manual: comisionNum,
        monto_neto: montoNeto,
        referencia: referencia.trim() || null,
        descripcion: descripcion.trim() || null,
        usuario: currentRole === 'admin' ? 'Director Médico (Admin)' : 'Cajero de Turno'
      };

      const res = await fetch('/api/tesoreria/ingresos-extraordinarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error registrando el ingreso extraordinario.');
      }

      // Limpiar y refrescar
      setOpenModal(false);
      setConceptoLibre('');
      setMonto('');
      setReferencia('');
      setDescripcion('');
      setComisionBancariaManual('0.00');
      await cargarIngresos();
      if (onIngresoRegistrado) onIngresoRegistrado();
      alert('✓ Ingreso extraordinario registrado exitosamente con asiento contable.');
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrado de lista
  const ingresosFiltrados = useMemo(() => {
    const hoyStr = hoyLocal();
    const hace7DiasStr = sumarDias(hoyStr, -7);
    const inicioMesStr = hoyStr.slice(0, 7) + '-01';

    return ingresos.filter(item => {
      const fechaItem = String(item.fecha || '').slice(0, 10);

      // Periodo
      if (filtroPeriodo === 'HOY' && fechaItem !== hoyStr) return false;
      if (filtroPeriodo === '7DIAS' && fechaItem < hace7DiasStr) return false;
      if (filtroPeriodo === 'MES' && fechaItem < inicioMesStr) return false;

      // Categoria
      if (filtroCategoria !== 'TODOS' && item.categoria !== filtroCategoria) return false;

      // Cuenta
      if (filtroCuenta !== 'TODAS' && String(item.cuenta_id) !== filtroCuenta) return false;

      // Busqueda libre
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const coincideConcepto = (item.concepto_libre || '').toLowerCase().includes(q);
        const coincideCat = (item.categoria || '').toLowerCase().includes(q);
        const coincideRef = (item.referencia || '').toLowerCase().includes(q);
        const coincideCuenta = (item.cuenta_nombre || '').toLowerCase().includes(q);
        if (!coincideConcepto && !coincideCat && !coincideRef && !coincideCuenta) return false;
      }

      return true;
    });
  }, [ingresos, filtroPeriodo, filtroCategoria, filtroCuenta, searchQuery]);

  // Totales KPI
  const { totalBs, totalUsd } = useMemo(() => {
    let bs = 0;
    let usd = 0;
    ingresosFiltrados.forEach(i => {
      const val = parseFloat(String(i.monto || '0'));
      if (i.moneda === 'BS') bs += val;
      else usd += val;
    });
    return { totalBs: bs, totalUsd: usd };
  }, [ingresosFiltrados]);

  // Agrupación Dinámica Clinico
  const grupos = useMemo(() => {
    if (agruparPor === 'NINGUNO') return null;
    const map: Record<string, IngresoExtraordinario[]> = {};

    ingresosFiltrados.forEach(item => {
      let clave = 'Sin clasificar';
      if (agruparPor === 'CATEGORIA') clave = item.categoria || 'Sin Categoría';
      if (agruparPor === 'CUENTA') clave = item.cuenta_nombre || `Cuenta #${item.cuenta_id}`;
      if (agruparPor === 'FECHA') clave = String(item.fecha || '').slice(0, 10);

      if (!map[clave]) map[clave] = [];
      map[clave].push(item);
    });
    return map;
  }, [ingresosFiltrados, agruparPor]);

  const toggleGrupo = (clave: string) => {
    setGruposExpandidos(prev => ({ ...prev, [clave]: !prev[clave] }));
  };

  // Exportar Excel
  const handleExportarExcel = () => {
    if (ingresosFiltrados.length === 0) return alert('No hay registros para exportar.');
    const data = ingresosFiltrados.map(i => ({
      'ID Asiento': `#${i.id}`,
      'Fecha': String(i.fecha || '').slice(0, 10),
      'Hora': i.hora || '--:--',
      'Cuenta Receptora': i.cuenta_nombre || `Cuenta #${i.cuenta_id}`,
      'Categoría': i.categoria,
      'Concepto Libre': i.concepto_libre,
      'Monto': parseFloat(String(i.monto)) || 0,
      'Moneda': i.moneda,
      'Equiv. USD (Tasa BCV)': i.moneda === 'BS' ? (parseFloat(String(i.monto)) / tasaBcv).toFixed(2) : (parseFloat(String(i.monto))).toFixed(2),
      'Referencia Bancaria': i.referencia || 'S/R',
      'Usuario': i.usuario || 'Sistema'
    }));

    exportarAExcel('Ingresos_Extraordinarios', [
      { nombreHoja: 'Ingresos Extraordinarios', data }
    ]);
  };

  // Exportar PDF
  const handleExportarPDF = () => {
    if (ingresosFiltrados.length === 0) return alert('No hay registros para exportar.');

    const filas = ingresosFiltrados.map(i => [
      `#${i.id}`,
      String(i.fecha || '').slice(0, 10),
      (i.cuenta_nombre || '').slice(0, 18),
      (i.categoria || '').slice(0, 20),
      (i.concepto_libre || '').slice(0, 25),
      `${parseFloat(String(i.monto)).toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${i.moneda}`,
      i.referencia || 'S/R'
    ]);

    exportarAPDF({
      titulo: 'LIBRO DE INGRESOS EXTRAORDINARIOS DE TESORERÍA',
      subtitulo: 'Centro Clínico Radiológico Imagen Salud, C.A. — Fondos y Depósitos No Asistenciales',
      nombreArchivo: 'Ingresos_Extraordinarios_Clinica',
      kpis: [
        { label: 'Total Registros', valor: `${ingresosFiltrados.length}` },
        { label: 'Total en Bolívares', valor: `Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` },
        { label: 'Total en Divisas', valor: `$ ${totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` }
      ],
      columnas: ['ID', 'Fecha', 'Cuenta Receptora', 'Categoría', 'Concepto', 'Monto', 'Referencia'],
      filas
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Corporativo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Ingresos Extraordinarios</h2>
              <p className="text-xs text-slate-500">
                Registro y auditoría de entradas no asistenciales (alquiler de consultorios, aportes de capital, venta de insumos)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={cargarIngresos}
            disabled={loading}
            className="rounded-xl text-xs flex items-center gap-1 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportarExcel}
            disabled={ingresosFiltrados.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 h-9"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportarPDF}
            disabled={ingresosFiltrados.length === 0}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm shadow-slate-800/20 flex items-center gap-1.5 h-9"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF (.pdf)</span>
          </Button>

          {currentRole === 'admin' && (
            <Button
              onClick={() => setOpenModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 h-9"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Ingreso Extraordinario</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total en Bolívares</p>
          <h3 className="text-2xl font-black text-emerald-600 mt-1">
            Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            ≈ ${(totalBs / (tasaBcv || 1)).toFixed(2)} USD a tasa BCV
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total en Divisas Cash</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">
            $ {totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            ≈ Bs. {(totalUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Asientos Filtrados</p>
          <h3 className="text-2xl font-black text-cyan-600 mt-1">
            {ingresosFiltrados.length}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Registros de tesorería</p>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tasa Oficial BCV</p>
          <h3 className="text-2xl font-black text-indigo-600 mt-1">
            Bs. {tasaBcv.toFixed(2)}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Sincronización en vivo</p>
        </Card>
      </div>

      {/* Barra de Filtros Clínicos Avanzados */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <Input
              placeholder="Buscar por concepto, categoría, cuenta o referencia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs rounded-xl bg-slate-50 border-slate-200 h-10 w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filtro Período */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'HOY', label: 'Hoy' },
                { id: '7DIAS', label: '7 Días' },
                { id: 'MES', label: 'Este Mes' },
                { id: 'TODO', label: 'Todo' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setFiltroPeriodo(p.id as Parameters<typeof setFiltroPeriodo>[0])}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    filtroPeriodo === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Agrupador Clinico */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl text-xs">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-600 text-[11px]">Agrupar:</span>
              <select
                value={agruparPor}
                onChange={(e) => setAgruparPor(e.target.value as Parameters<typeof setAgruparPor>[0])}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer text-xs"
              >
                <option value="NINGUNO">Sin agrupar</option>
                <option value="CATEGORIA">Por Categoría</option>
                <option value="CUENTA">Por Cuenta</option>
                <option value="FECHA">Por Fecha</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chips de Categoría */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 font-bold text-[10px] uppercase">Categorías:</span>
          <button
            onClick={() => setFiltroCategoria('TODOS')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
              filtroCategoria === 'TODOS' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas
          </button>
          {CATEGORIAS_INGRESOS.map(cat => (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                filtroCategoria === cat ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </Card>

      {/* Tabla de Resultados / Agrupación */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-3">Ref/ID</th>
                <th className="p-3">Fecha / Hora</th>
                <th className="p-3">Cuenta Receptora</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Concepto Libre</th>
                <th className="p-3 text-right">Monto</th>
                <th className="p-3 text-center">Referencia</th>
                <th className="p-3 text-center">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Cargando libro de ingresos extraordinarios...
                  </td>
                </tr>
              ) : ingresosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No se encontraron ingresos extraordinarios para los filtros seleccionados.
                  </td>
                </tr>
              ) : agruparPor === 'NINGUNO' ? (
                ingresosFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-700">#{item.id}</td>
                    <td className="p-3 text-slate-600 font-medium">
                      {String(item.fecha || '').slice(0, 10)} {item.hora && `• ${item.hora}`}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                        {item.cuenta_nombre || `Cuenta #${item.cuenta_id}`}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {item.categoria}
                      </Badge>
                    </td>
                    <td className="p-3 font-medium text-slate-800 max-w-xs truncate">
                      {item.concepto_libre}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-emerald-600 text-sm">
                      +{parseFloat(String(item.monto)).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {item.moneda}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600">
                      {item.referencia ? (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {item.referencia}
                        </Badge>
                      ) : (
                        <span className="text-slate-500">S/R</span>
                      )}
                    </td>
                    <td className="p-3 text-center text-slate-500 text-[11px]">
                      {item.usuario || 'Sistema'}
                    </td>
                  </tr>
                ))
              ) : (
                grupos && Object.entries(grupos).map(([clave, items]) => {
                  const subtotalBs = items.filter(i => i.moneda === 'BS').reduce((acc, i) => acc + parseFloat(String(i.monto)), 0);
                  const subtotalUsd = items.filter(i => i.moneda === 'USD').reduce((acc, i) => acc + parseFloat(String(i.monto)), 0);
                  const estaExpandido = gruposExpandidos[clave] !== false; // Abierto por defecto

                  return (
                    <React.Fragment key={clave}>
                      <tr 
                        onClick={() => toggleGrupo(clave)}
                        className="bg-slate-100/90 hover:bg-slate-200/80 cursor-pointer font-bold select-none border-t border-slate-200"
                      >
                        <td colSpan={5} className="p-3 text-slate-900">
                          <span className="inline-flex items-center gap-2">
                            {estaExpandido ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                            <span>{clave}</span>
                            <Badge variant="secondary" className="text-[10px] ml-2">
                              {items.length} {items.length === 1 ? 'asiento' : 'asientos'}
                            </Badge>
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-700">
                          {subtotalBs > 0 && <span>Bs. {subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} </span>}
                          {subtotalUsd > 0 && <span>$ {subtotalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>}
                        </td>
                        <td colSpan={2} className="p-3"></td>
                      </tr>
                      {estaExpandido && items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/80 bg-white transition-colors">
                          <td className="p-3 pl-8 font-mono font-bold text-slate-600">#{item.id}</td>
                          <td className="p-3 text-slate-600 font-medium">
                            {String(item.fecha || '').slice(0, 10)} {item.hora && `• ${item.hora}`}
                          </td>
                          <td className="p-3 font-semibold text-slate-800">{item.cuenta_nombre}</td>
                          <td className="p-3">
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                              {item.categoria}
                            </Badge>
                          </td>
                          <td className="p-3 font-medium text-slate-800">{item.concepto_libre}</td>
                          <td className="p-3 text-right font-mono font-black text-emerald-600">
                            +{parseFloat(String(item.monto)).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {item.moneda}
                          </td>
                          <td className="p-3 text-center font-mono text-slate-600">
                            {item.referencia || <span className="text-slate-500">S/R</span>}
                          </td>
                          <td className="p-3 text-center text-slate-500 text-[11px]">{item.usuario}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de Registro de Ingreso Extraordinario */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span>Registrar Ingreso Extraordinario</span>
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Registro de entrada no operativa con impacto inmediato en el saldo de bóvedas
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* 1. Cuenta Receptora */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Cuenta Bancaria o Bóveda Receptora</label>
              <select
                value={cuentaId}
                onChange={(e) => setCuentaId(Number(e.target.value))}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {cuentas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda}) — Saldo: {parseFloat(String(c.saldo_actual || '0')).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {c.moneda}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Categoría */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Categoría del Ingreso</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {CATEGORIAS_INGRESOS.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* 3. Concepto Libre Obligatorio */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Concepto Libre Detallado</span>
                <span className="text-[10px] text-rose-500 font-bold">* Obligatorio</span>
              </label>
              <Input
                placeholder="Ej. Alquiler Consultorio 3 Dr. Augusto Soto (Mes Septiembre)"
                value={conceptoLibre}
                onChange={(e) => setConceptoLibre(e.target.value)}
                required
                className="text-xs rounded-xl h-10"
              />
            </div>

            {/* 4. Monto */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Monto a Ingresar ({cuentaSeleccionada?.moneda || 'BS'})</span>
                <span className="text-[10px] text-slate-500">
                  {cuentaSeleccionada?.moneda === 'BS' 
                    ? `≈ $${(parseFloat(monto || '0') / tasaBcv).toFixed(2)} USD` 
                    : `≈ Bs. ${(parseFloat(monto || '0') * tasaBcv).toFixed(2)}`}
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">
                  {cuentaSeleccionada?.moneda === 'USD' ? '$' : 'Bs.'}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                  className="pl-9 text-sm font-bold font-mono rounded-xl h-10"
                />
              </div>
            </div>

            {/* 5. Referencia Bancaria / Comprobante */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">N° de Referencia / Depósito</label>
                <Input
                  placeholder="Ej. 984512 o S/R"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="text-xs rounded-xl h-10 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Responsable / Usuario</label>
                <Input
                  value={currentRole === 'admin' ? 'Director Médico (Admin)' : 'Cajero de Turno'}
                  readOnly
                  className="text-xs rounded-xl h-10 bg-slate-100 text-slate-600 font-medium"
                />
              </div>
            </div>

            {/* 6. Descripción Opcional */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Notas / Observaciones Adicionales</label>
              <Input
                placeholder="Detalles complementarios (opcional)"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="text-xs rounded-xl h-10"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenModal(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Guardar Asiento de Ingreso</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
