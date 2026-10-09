'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TreasuryCards } from '@/components/TreasuryCards';
import { ModalEgreso } from '@/components/ModalEgreso';
import { ModalCambioDivisa } from '@/components/ModalCambioDivisa';
import { BloqueoCierrePendiente } from '@/components/BloqueoCierrePendiente';
import { CierreObligatorio } from '@/components/CierreObligatorio';
import { TopBar } from '@/components/TopBar';
import { TablaHonorarios } from '@/components/TablaHonorarios';
import { MatrizHonorarios } from '@/components/MatrizHonorarios';
import { DashboardFinanciero } from '@/components/DashboardFinanciero';
import { TremorDashboard } from '@/components/TremorDashboard';
import { ModalCargaMasivaExcel } from '@/components/ModalCargaMasivaExcel';

// Módulos Clínicos y Financieros Migrados
import { ModuloFacturacion } from '@/components/ModuloFacturacion';
import { ModuloKanbanSalaEspera } from '@/components/ModuloKanbanSalaEspera';
import { ModuloCajaDiaria } from '@/components/ModuloCajaDiaria';
import { ModuloCierreDiario } from '@/components/ModuloCierreDiario';
import { ModuloBitacora } from '@/components/ModuloBitacora';
import { ModuloUsuarios } from '@/components/ModuloUsuarios';
import { ModuloAdminCatalogos } from '@/components/ModuloAdminCatalogos';
import { ModuloAnaliticas } from '@/components/ModuloAnaliticas';
import { ModuloEgresosOperativos } from '@/components/ModuloEgresosOperativos';
import { ModuloIngresosExtraordinarios } from '@/components/ModuloIngresosExtraordinarios';
import { ModuloConciliacionPOS } from '@/components/ModuloConciliacionPOS';
import { ModuloRetencionesSeniat } from '@/components/ModuloRetencionesSeniat';
import { ModuloHistorialPacientes } from '@/components/ModuloHistorialPacientes';
import { ModuloCampanas } from '@/components/ModuloCampanas';
import { LoginScreen } from '@/components/LoginScreen';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  RefreshCw, 
  ArrowDownRight, 
  ArrowLeftRight, 
  FileUp,
  ShieldAlert, 
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Lock,
  Wallet,
  TrendingUp,
  CreditCard,
  FileCheck2,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { exportarAExcel, exportarAPDF } from '@/lib/exportUtils';
import { CuentaBancaria, TransaccionBancaria, HonorarioMedico, PacientePendiente, UserRole, ModoOperacion } from '@/types';
import { hoyLocal } from '@/lib/date';
import { diferir } from '@/lib/diferir';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [nombreUsuario, setNombreUsuario] = useState<string>('Dr. Director Médico');
  const [role, setRole] = useState<UserRole>('admin');
  const [modoOperacion, setModoOperacion] = useState<ModoOperacion>('operador');
  const [activeSection, setActiveSection] = useState<string>('facturacion');
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Estados de datos
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [transacciones, setTransacciones] = useState<TransaccionBancaria[]>([]);
  const [honorarios, setHonorarios] = useState<HonorarioMedico[]>([]);
  const [tasaBcv, setTasaBcv] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Modales
  const [openEgreso, setOpenEgreso] = useState(false);
  const [openDivisas, setOpenDivisas] = useState(false);
  const [openExcel, setOpenExcel] = useState(false);
  const [openBloqueo, setOpenBloqueo] = useState(false);
  const [pacientesPendientes, setPacientesPendientes] = useState<PacientePendiente[]>([]);
  const [fechaPendiente, setFechaPendiente] = useState('');

  // Recuperar sesión y tasa BCV
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => (res.ok ? res.json() : null))
      .then(session => {
        if (session && session.role) {
          setRole(session.role);
          setNombreUsuario(session.nombre || 'Usuario Clínico');
          if (session.modo) setModoOperacion(session.modo);
          setIsAuthenticated(true);
        }
      })
      .catch(() => {});

    // Tasa BCV
    const refrescarTasa = () => fetch('/api/bcv')
      .then(res => res.json())
      .then(d => { if (d.tasa > 0) setTasaBcv(d.tasa); })
      .catch(() => {});
    refrescarTasa();
    const idTasa = setInterval(refrescarTasa, 5 * 60 * 1000);
    return () => clearInterval(idTasa);
  }, []);

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setIsAuthenticated(false);
    setActiveSection('facturacion');
  };

  // Guard Estricto de RBAC para navegacin segura
  useEffect(() => diferir(() => {
    if (role === 'cajero') {
      const cajeroAllowed = ['facturacion', 'caja', 'kanban', 'historial-pacientes', 'cierre'];
      if (!cajeroAllowed.includes(activeSection)) {
        setActiveSection('facturacion');
      }
    } else if (role === 'asistente') {
      const asistenteForbidden = ['tesoreria', 'ingresos-extra', 'egresos', 'divisas', 'honorarios', 'bitacora', 'usuarios', 'admin', 'campanas'];
      if (asistenteForbidden.includes(activeSection)) {
        setActiveSection('facturacion');
      }
    }
  }), [role, activeSection]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Cuentas bancarias
      const resCuentas = await fetch('/api/tesoreria/cuentas');
      if (resCuentas.ok) {
        const dataCuentas = await resCuentas.json();
        setCuentas(dataCuentas);
      }

      // 2. Transacciones
      const resTx = await fetch('/api/tesoreria/transacciones-bancarias');
      if (resTx.ok) {
        const dataTx = await resTx.json();
        setTransacciones(dataTx);
      }

      // 3. Auditoría de cierre: solo cuentan días anteriores (los pacientes de hoy son operación normal)
      const resCierre = await fetch('/api/cierres/estado-jornada');
      if (resCierre.ok) {
        const dataCierre = await resCierre.json();
        const pendientes: PacientePendiente[] = dataCierre.pacientesPendientes ?? [];
        setPacientesPendientes(dataCierre.requiereCierre ? pendientes : []);
        setFechaPendiente(dataCierre.fecha || hoyLocal());
      }

      // 4. Honorarios pendientes por médico (datos reales con trazabilidad por forma de cobro)
      const resHon = await fetch('/api/tesoreria/honorarios/resumen');
      if (resHon.ok) setHonorarios(await resHon.json());
    } catch (err) {
      console.error('Error cargando datos del sistema:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      return diferir(loadInitialData);
    }
  }, [isAuthenticated]);


  const exportarLibroMayorExcel = () => {
    if (transacciones.length === 0) {
      alert('No hay movimientos registrados para exportar.');
      return;
    }
    const data = transacciones.map((tx) => ({
      'ID Asiento': `#${tx.id}`,
      'Referencia': tx.referencia || 'S/R',
      'Cuenta': tx.cuenta_nombre,
      'Concepto': tx.concepto,
      'Débito (-)': Number(tx.monto_debito) || 0,
      'Crédito (+)': Number(tx.monto_credito) || 0,
      'Saldo Posterior': Number(tx.saldo_posterior) || 0,
      'Moneda': tx.moneda,
      'Tipo': tx.es_comision ? 'Comisión Manual' : tx.tipo_transaccion
    }));
    exportarAExcel('Libro_Mayor_Bancario', [
      { nombreHoja: 'Extracto de Movimientos', data }
    ]);
  };

  const exportarLibroMayorPDF = () => {
    if (transacciones.length === 0) {
      alert('No hay movimientos registrados para exportar.');
      return;
    }
    const totalDebitos = transacciones.reduce((acc: number, tx) => acc + (Number(tx.monto_debito) || 0), 0);
    const totalCreditos = transacciones.reduce((acc: number, tx) => acc + (Number(tx.monto_credito) || 0), 0);

    const filas = transacciones.map((tx) => [
      `#${tx.id}`,
      (tx.cuenta_nombre || '').slice(0, 18),
      (tx.concepto || '').slice(0, 26),
      Number(tx.monto_debito) > 0 ? `-${Number(tx.monto_debito).toFixed(2)}` : '-',
      Number(tx.monto_credito) > 0 ? `+${Number(tx.monto_credito).toFixed(2)}` : '-',
      `${Number(tx.saldo_posterior).toFixed(2)} ${tx.moneda}`,
      tx.es_comision ? 'Comisión' : (tx.tipo_transaccion || 'General')
    ]);

    exportarAPDF({
      titulo: 'EXTRACTO DE MOVIMIENTOS Y LIBRO MAYOR DE TESORERÍA',
      subtitulo: 'Centro Clínico Radiológico Imagen Salud, C.A. — Bóvedas y Cuentas Operativas',
      nombreArchivo: 'Libro_Mayor_Tesoreria',
      kpis: [
        { label: 'Total Asientos', valor: `${transacciones.length}` },
        { label: 'Total Débitos (-)', valor: `${totalDebitos.toFixed(2)}` },
        { label: 'Total Créditos (+)', valor: `${totalCreditos.toFixed(2)}` }
      ],
      columnas: ['ID / Ref', 'Cuenta', 'Concepto', 'Débito (-)', 'Crédito (+)', 'Saldo Posterior', 'Tipo'],
      filas
    });
  };

  // Si no está autenticado, renderizar Login
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLoginSuccess={(nuevoRol, nombre, modo) => {
          setRole(nuevoRol);
          setNombreUsuario(nombre);
          setModoOperacion(modo);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="flex bg-slate-50 min-h-screen text-slate-800 antialiased">
      {/* Sidebar con control estricto RBAC */}
      <Sidebar
        currentRole={role}
        onRoleChange={setRole}
        activeSection={activeSection}
        onSelectSection={(s) => { setActiveSection(s); setMenuAbierto(false); }}
        abierto={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
        onLogout={handleLogout}
        modoOperacion={modoOperacion}
        onToggleModoOperacion={() => setModoOperacion((prev: ModoOperacion) => prev === 'operador' ? 'vista' : 'operador')}
      />

      {/* Contenedor Principal Pulcro (85-90% Blanco Clínico) */}
      <div className="flex-1 min-w-0 flex flex-col">
      <TopBar seccion={activeSection} tasaBcv={tasaBcv} nombreUsuario={nombreUsuario} role={role} onMenu={() => setMenuAbierto(true)} />
      <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

        {/* Banner Crítico de Atenciones Abiertas de Fecha Anterior (Pillar 4) */}
        {pacientesPendientes.length > 0 && (role === 'admin' || role === 'asistente') && (
          <div className="bg-clinica-coral-soft border-2 border-clinica-coral/40 p-4 rounded-3xl flex items-start justify-between gap-4 shadow-sm animate-in fade-in-50">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-clinica-coral text-white rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <h3 className="font-black text-clinica-coral text-sm">
                  Alerta de Auditoría: Se detectaron {pacientesPendientes.length} atención(es) pendientes del día {fechaPendiente}
                </h3>
                <p className="text-slate-700 mt-1">
                  Existen pacientes que no fueron culminados ni anulados en la jornada previa. El protocolo de auditoría exige sanear estos casos antes de continuar para evitar pacientes fantasmas en facturación.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenBloqueo(true)}
              className="bg-clinica-coral hover:bg-clinica-coral/90 text-white font-bold text-xs rounded-xl shadow-sm shrink-0"
            >
              Sanear Casos Pendientes
            </Button>
          </div>
        )}

        {/* 1. RECEPCIÓN Y TRIAJE (ADMISIÓN Y FACTURACIÓN) */}
        {activeSection === 'facturacion' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloFacturacion 
              rol={role}
              onFacturaEmitida={() => {
                loadInitialData();
              }}
            />
          </div>
        )}

        {/* 2. CAJA Y FACTURACIÓN (ARQUEO DE CAJA DIARIA) */}
        {activeSection === 'caja' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloCajaDiaria currentRole={role} />
          </div>
        )}

        {/* 3. SALA DE ESPERA Y TURNERO TV */}
        {activeSection === 'kanban' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloKanbanSalaEspera currentRole={role} modoOperacion={modoOperacion} />
          </div>
        )}

        {/* 3.1 HISTORIAL CLÍNICO Y MOVIMIENTOS POR PACIENTES */}
        {activeSection === 'historial-pacientes' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloHistorialPacientes currentRole={role} />
          </div>
        )}

        {activeSection === 'campanas' && role === 'admin' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloCampanas />
          </div>
        )}

        {/* 4. CONCILIACIÓN DE PUNTOS DE VENTA (Pillar 7) */}
        {activeSection === 'conciliacion-pos' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloConciliacionPOS
              currentRole={role}
              modoOperacion={modoOperacion}
              cuentas={cuentas}
              onConciliacionCompletada={loadInitialData}
            />
          </div>
        )}

        {/* 5. RETENCIONES FISCALES SENIAT (Pillar 6) */}
        {activeSection === 'retenciones' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloRetencionesSeniat
              currentRole={role}
              modoOperacion={modoOperacion}
              tasaBcv={tasaBcv}
            />
          </div>
        )}

        {/* 6. FLUJO DE TESORERÍA Y BÓVEDAS (Exclusivo Admin) */}
        {activeSection === 'tesoreria' && role === 'admin' && (
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Wallet className="w-6 h-6 text-clinica-primary" />
                  Tesorería y Bancos (4 Cuentas Fijas Operativas)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Efectivo Divisas ($), Efectivo Bolívares, Punto de Venta (Bs) y Pago Móvil (Bs). Cobranza entra 100% en cuentas clínicas antes de dispersión.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadInitialData}
                  disabled={loading}
                  className="rounded-xl text-xs flex items-center gap-1 h-9"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </Button>
                {modoOperacion === 'operador' && (
                  <>
                    <Button 
                      size="sm" 
                      onClick={() => setActiveSection('ingresos-extra')}
                      className="rounded-xl bg-clinica-primary hover:bg-clinica-primary-dark text-white text-xs font-bold shadow-sm flex items-center gap-1 h-9"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Ingreso Extraordinario</span>
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => setOpenEgreso(true)}
                      className="rounded-xl bg-clinica-coral hover:bg-clinica-coral/90 text-white text-xs font-bold shadow-sm flex items-center gap-1 h-9"
                    >
                      <ArrowDownRight className="w-3.5 h-3.5 mr-1" />
                      <span>Nuevo Egreso Rápido</span>
                    </Button>
                  </>
                )}
              </div>
            </div>

            <TreasuryCards cuentas={cuentas} loading={loading} onRefresh={loadInitialData} />

            {/* Extracto de Movimientos Bancarios */}
            <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black text-slate-800">
                    Extracto de Movimientos y Libro Mayor
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">Auditoría contable y conciliación de transacciones</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {transacciones.length} Asientos
                  </Badge>
                  <Button
                    size="sm"
                    onClick={exportarLibroMayorExcel}
                    disabled={transacciones.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 h-8"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel (.xlsx)</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={exportarLibroMayorPDF}
                    disabled={transacciones.length === 0}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 h-8"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF (.pdf)</span>
                  </Button>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black">
                    <tr>
                      <th className="p-3">Ref/ID</th>
                      <th className="p-3">Cuenta Afectada</th>
                      <th className="p-3">Concepto</th>
                      <th className="p-3 text-right">Débito (-)</th>
                      <th className="p-3 text-right">Crédito (+)</th>
                      <th className="p-3 text-right">Saldo Posterior</th>
                      <th className="p-3 text-center">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transacciones.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                          No hay transacciones registradas aún.
                        </td>
                      </tr>
                    ) : (
                      transacciones.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-mono font-bold text-slate-700">
                            #{tx.id} • {tx.referencia || 'S/R'}
                          </td>
                          <td className="p-3 font-bold text-slate-900">{tx.cuenta_nombre}</td>
                          <td className="p-3 text-slate-700 font-medium">{tx.concepto}</td>
                          <td className="p-3 text-right font-mono font-bold text-rose-600">
                            {Number(tx.monto_debito) > 0 ? `-${Number(tx.monto_debito).toFixed(2)}` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600">
                            {Number(tx.monto_credito) > 0 ? `+${Number(tx.monto_credito).toFixed(2)}` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-slate-900">
                            {Number(tx.saldo_posterior).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {tx.moneda}
                          </td>
                          <td className="p-3 text-center">
                            {tx.es_comision ? (
                              <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Comisión Manual
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-slate-600">
                                {tx.tipo_transaccion}
                              </Badge>
                            )}
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

        {/* 7. INGRESOS EXTRAORDINARIOS DE TESORERÍA (Exclusivo Admin) */}
        {activeSection === 'ingresos-extra' && role === 'admin' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloIngresosExtraordinarios
              currentRole={role}
              cuentas={cuentas}
              onIngresoRegistrado={loadInitialData}
            />
          </div>
        )}

        {/* 8. GASTOS OPERATIVOS (EGRESOS CON COMISIÓN MANUAL) (Exclusivo Admin) */}
        {activeSection === 'egresos' && role === 'admin' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloEgresosOperativos 
              currentRole={role} 
              cuentas={cuentas} 
              onEgresoRegistrado={loadInitialData} 
            />
          </div>
        )}

        {/* 9. COBERTURA CAMBIARIA (Exclusivo Admin) */}
        {activeSection === 'divisas' && role === 'admin' && (
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-xl font-black text-slate-900">Cobertura Cambiaria (Compra de Divisas)</h2>
                <p className="text-xs text-slate-500">
                  Conversión de excedentes en Bolívares a Dólares en Bóveda a tasa pactada con registro doble
                </p>
              </div>
              {modoOperacion === 'operador' && (
                <Button
                  onClick={() => setOpenDivisas(true)}
                  className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />
                  <span>Nueva Operación Cambiaria</span>
                </Button>
              )}
            </div>
            <TreasuryCards cuentas={cuentas} loading={loading} onRefresh={loadInitialData} />
          </div>
        )}

        {/* 10. HONORARIOS MÉDICOS (Exclusivo Admin) */}
        {activeSection === 'honorarios' && role === 'admin' && (
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            <TablaHonorarios
              items={honorarios}
              onLiquidarSuccess={loadInitialData}
              modoOperacion={modoOperacion}
              currentRole={role}
            />
            <MatrizHonorarios />
          </div>
        )}

        {/* 11. CIERRE DIARIO (admin y asistente: cualquier fecha; cajero: solo el día de hoy) */}
        {activeSection === 'cierre' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloCierreDiario currentRole={role} />
          </div>
        )}

        {/* USUARIOS (Exclusivo Admin) */}
        {activeSection === 'usuarios' && role === 'admin' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloUsuarios />
          </div>
        )}

        {/* BITÁCORA (Exclusivo Admin) */}
        {activeSection === 'bitacora' && role === 'admin' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloBitacora />
          </div>
        )}

        {/* 12. BALANCE FINANCIERO OPERATIVO (Pillar 10: Barras, Líneas, Donut, Tabla) */}
        {activeSection === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            <TremorDashboard />
            <DashboardFinanciero tasaBcv={tasaBcv} />
          </div>
        )}

        {/* 13. CONSOLIDADO EJECUTIVO CLÍNICO (ANALÍTICAS) */}
        {activeSection === 'analiticas' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloAnaliticas />
          </div>
        )}

        {/* 14. CATÁLOGO MAESTRO DE SERVICIOS (Exclusivo Admin) */}
        {activeSection === 'admin' && role === 'admin' && (
          <div className="animate-in fade-in-50 duration-300">
            <ModuloAdminCatalogos currentRole={role} />
          </div>
        )}

        {/* 15. CARGA MASIVA DE PACIENTES */}
        {activeSection === 'excel' && (
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            <Card className="rounded-2xl border border-slate-200 p-6 bg-white shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Importación Inteligente desde Excel (Dry-Run)</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cargue archivos .xlsx con validación estricta de estructura y simulación previa antes de escribir en base de datos
                  </p>
                </div>
                {modoOperacion === 'operador' && (
                  <Button
                    onClick={() => setOpenExcel(true)}
                    className="rounded-xl text-xs font-bold bg-clinica-primary hover:bg-clinica-primary-dark text-white shadow-md"
                  >
                    <FileUp className="w-4 h-4 mr-1.5" />
                    <span>Abrir Simulador Dry-Run</span>
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>
      </div>

      {/* Modales Globales */}
      <ModalEgreso
        open={openEgreso}
        onOpenChange={setOpenEgreso}
        cuentas={cuentas}
        onSuccess={loadInitialData}
      />

      <ModalCambioDivisa
        open={openDivisas}
        onOpenChange={setOpenDivisas}
        cuentas={cuentas}
        onSuccess={loadInitialData}
      />

      <ModalCargaMasivaExcel
        open={openExcel}
        onOpenChange={setOpenExcel}
        onSuccess={loadInitialData}
      />

      <CierreObligatorio role={role} onResuelto={loadInitialData} />

      {openBloqueo && (
        <BloqueoCierrePendiente
          open={openBloqueo}
          onOpenChange={setOpenBloqueo}
          fechaPendiente={fechaPendiente}
          pacientesPendientes={pacientesPendientes}
          onCierreCompletado={loadInitialData}
          esJornadaAnterior={true}
        />
      )}
    </div>
  );
}
