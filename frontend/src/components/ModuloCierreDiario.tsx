'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertCircle, 
  Printer, 
  Lock, 
  CheckCircle2, 
  DollarSign, 
  Calendar,
  Building2,
  FileCheck,
  RefreshCw,
  Wallet,
  Send,
  MessageCircle
} from 'lucide-react';
import { UserRole, PacientePendiente, ResumenCierre } from '@/types';
import { BloqueoCierrePendiente } from './BloqueoCierrePendiente';
import { PinCierreDialog } from './PinCierreDialog';
import { hoyLocal } from '@/lib/date';
import { diferir } from '@/lib/diferir';

const METODOS = [
  { clave: 'divisas_usd', etiqueta: 'Efectivo divisas', simbolo: '$' },
  { clave: 'efectivo_bs', etiqueta: 'Efectivo bolívares', simbolo: 'Bs.' },
  { clave: 'punto_bs', etiqueta: 'Punto de venta', simbolo: 'Bs.' },
  { clave: 'pago_movil_bs', etiqueta: 'Pago móvil', simbolo: 'Bs.' },
] as const;

interface ModuloCierreDiarioProps {
  currentRole: UserRole;
}

export const ModuloCierreDiario: React.FC<ModuloCierreDiarioProps> = ({ currentRole }) => {
  const isAdmin = currentRole === 'admin';
  const [fechaCierre, setFechaCierre] = useState(() => hoyLocal());
  const [estadoDiario, setEstadoDiario] = useState<{
    puedeCerrar: boolean;
    pacientesPendientes: PacientePendiente[];
    pacientesWhatsAppPendientes?: PacientePendiente[];
    totalWhatsAppPendientes?: number;
    cierreExistente?: boolean;
    cierreData?: ResumenCierre;
    resumen: ResumenCierre;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [ejecutandoCierre, setEjecutandoCierre] = useState(false);
  const [mostrarCertificado, setMostrarCertificado] = useState(false);
  const [cierreRealizado, setCierreRealizado] = useState<ResumenCierre | null>(null);
  const [mostrarModalBloqueo, setMostrarModalBloqueo] = useState(false);

  // Arqueo físico input para cuadre
  const [conteo, setConteo] = useState<Record<string, string>>({ divisas_usd: '', efectivo_bs: '', punto_bs: '', pago_movil_bs: '' });
  const [arqueoResultado, setArqueoResultado] = useState<{ metodo: string; esperado: string; contado: string; diferencia: string }[]>([]);
  const esperado = (clave: string): number => {
    const r = estadoDiario?.resumen ?? {};
    const v = clave === 'divisas_usd' ? r.totalDivisasUSD : clave === 'efectivo_bs' ? r.totalEfectivoBs : clave === 'punto_bs' ? r.totalPuntoBs : r.totalPagoMovilBs;
    return Math.round(Number(v || 0) * 100);
  };
  const contadoCents = (clave: string): number | null => (/^\d+(\.\d{1,2})?$/.test(conteo[clave].trim()) ? Math.round(Number(conteo[clave]) * 100) : null);
  const conteoCompleto = METODOS.every((m) => contadoCents(m.clave) !== null);
  const hayDif = conteoCompleto && METODOS.some((m) => (contadoCents(m.clave) ?? 0) !== esperado(m.clave));
  const [observacionesCierre, setObservacionesCierre] = useState('');

  const verificarEstado = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cierres/verificar-estado-diario?fecha=${fechaCierre}`);
      if (res.ok) {
        const data = await res.json();
        setEstadoDiario(data);
      }
    } catch (err) {
      console.error('Error verificando estado:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => diferir(verificarEstado), [fechaCierre]);

  const [pidiendoPin, setPidiendoPin] = useState(false);
  const [errorPin, setErrorPin] = useState<string | null>(null);

  const handleEjecutarCierre = () => {
    if (!estadoDiario?.puedeCerrar) {
      setMostrarModalBloqueo(true);
      return;
    }
    setErrorPin(null);
    setPidiendoPin(true);
  };

  const confirmarCierre = async (pin: string) => {
    setEjecutandoCierre(true);
    try {
      const res = await fetch('/api/cierres/ejecutar-cierre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: fechaCierre,
          usuario_responsable: isAdmin ? 'Dr. Administrador' : 'Cajero de Turno',
          arqueo: conteo,
          observaciones: observacionesCierre,
          pin
        })
      });

      const data = await res.json();
      if (res.ok) {
        setPidiendoPin(false);
        setCierreRealizado(data.cierre);
        setArqueoResultado(data.arqueo ?? []);
        setMostrarCertificado(true);
        verificarEstado();
      } else {
        setErrorPin(data.error || 'Error al ejecutar cierre');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    } finally {
      setEjecutandoCierre(false);
    }
  };

  const hayPacientesSala = (estadoDiario?.pacientesPendientes?.length || 0) > 0;
  const hayWhatsAppPendientes = (estadoDiario?.pacientesWhatsAppPendientes?.length || 0) > 0;

  return (
    <div className="space-y-6">
      <PinCierreDialog open={pidiendoPin} cargando={ejecutandoCierre} error={errorPin} onCancelar={() => setPidiendoPin(false)} onConfirmar={confirmarCierre} />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Cierre Diario de Caja & Auditoría Contable
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Consolidación de cuentas, validación estricta de sala y bloqueo crítico por resultados pendientes de WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500 ml-2" />
              <Input 
                type="date"
                value={fechaCierre}
                onChange={(e) => setFechaCierre(e.target.value)}
                className="h-8 text-xs border-0 bg-transparent"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-slate-50 px-3 h-10 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-slate-500" />
              Hoy
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={verificarEstado}
            disabled={loading}
            className="rounded-xl text-xs flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Verificar</span>
          </Button>
        </div>
      </div>

      {/* Alerta de Estado del Día: Bloqueo Crítico si hay pendientes en sala o WhatsApp */}
      {estadoDiario && !estadoDiario.puedeCerrar && (
        <Card className="bg-rose-50 border-2 border-rose-300 shadow-md">
          <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-7 h-7 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-rose-950 text-sm">
                  BLOQUEO CRÍTICO DE CIERRE DIARIO ACTIVO
                </h4>
                <div className="text-xs text-rose-800 mt-1 space-y-0.5">
                  {hayPacientesSala && (
                    <p>• <strong>{estadoDiario.pacientesPendientes.length} paciente(s)</strong> activos en sala de espera o atención.</p>
                  )}
                  {hayWhatsAppPendientes && (
                    <p>• <strong>{estadoDiario.pacientesWhatsAppPendientes?.length} resultado(s)</strong> culminados con informe pendiente de envío por WhatsApp.</p>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={() => setMostrarModalBloqueo(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl h-9 px-4 shrink-0 shadow-sm"
            >
              Resolver y Despachar Pendientes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal de Resolución de Bloqueo */}
      {mostrarModalBloqueo && estadoDiario && (
        <BloqueoCierrePendiente 
          open={mostrarModalBloqueo}
          onOpenChange={setMostrarModalBloqueo}
          fechaPendiente={fechaCierre}
          pacientesPendientes={estadoDiario.pacientesPendientes || []}
          pacientesWhatsAppPendientes={estadoDiario.pacientesWhatsAppPendientes || []}
          onCierreCompletado={() => {
            verificarEstado();
            setMostrarModalBloqueo(false);
          }}
        />
      )}

      {/* Cuadre de Cuentas y Saldos Teóricos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Efectivo Divisas ($)</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              ${estadoDiario?.resumen?.totalDivisasUSD ? Number(estadoDiario.resumen.totalDivisasUSD).toFixed(2) : '0.00'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Ingresos directos en caja</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Efectivo Bolívares</p>
            <p className="text-2xl font-black text-blue-600 mt-1">
              Bs. {estadoDiario?.resumen?.totalEfectivoBs ? Number(estadoDiario.resumen.totalEfectivoBs).toFixed(2) : '0.00'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Billetes moneda nacional</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Punto de Venta</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">
              Bs. {estadoDiario?.resumen?.totalPuntoBs ? Number(estadoDiario.resumen.totalPuntoBs).toFixed(2) : '0.00'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Lote bancario POS</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pago Móvil</p>
            <p className="text-2xl font-black text-cyan-600 mt-1">
              Bs. {estadoDiario?.resumen?.totalPagoMovilBs ? Number(estadoDiario.resumen.totalPagoMovilBs).toFixed(2) : '0.00'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Transferencias acreditadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Formulario de Arqueo Físico y Ejecución de Cierre */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>Auditoría de Arqueo Físico vs Saldo del Sistema</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {METODOS.map((m) => {
              const c = contadoCents(m.clave);
              const dif = c === null ? null : c - esperado(m.clave);
              return (
                <div key={m.clave} className="rounded-xl border border-slate-200 p-3 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Contado: {m.etiqueta} ({m.simbolo})</label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00 (obligatorio)" value={conteo[m.clave]}
                    onChange={(e) => setConteo((p) => ({ ...p, [m.clave]: e.target.value }))} className="rounded-xl text-sm font-mono" />
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Sistema: <span className="font-mono font-bold">{m.simbolo} {(esperado(m.clave) / 100).toFixed(2)}</span></span>
                    {dif !== null && (
                      <span className={`font-bold ${dif === 0 ? 'text-emerald-600' : dif > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {dif === 0 ? 'Cuadra' : dif > 0 ? `Sobrante ${m.simbolo} ${(dif / 100).toFixed(2)}` : `Faltante ${m.simbolo} ${(Math.abs(dif) / 100).toFixed(2)}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {hayDif && <p className="text-[11px] font-bold text-amber-700">Hay sobrante o faltante: explíquelo en observaciones para poder cerrar.</p>}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observaciones de Auditoría / Notas del Cierre
            </label>
            <Input 
              placeholder="Ej. Cuadre perfecto sin discrepancias; turno entregado conforme..."
              value={observacionesCierre}
              onChange={(e) => setObservacionesCierre(e.target.value)}
              className="rounded-xl text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 font-medium">
              Responsable: <span className="font-bold text-slate-800">{isAdmin ? 'Dr. Administrador (Master)' : 'Cajero de Turno'}</span>
            </p>

            <Button 
              disabled={!estadoDiario?.puedeCerrar || ejecutandoCierre || !conteoCompleto || (hayDif && !observacionesCierre.trim())}
              onClick={handleEjecutarCierre}
              className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md ${
                estadoDiario?.puedeCerrar 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' 
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>
                {ejecutandoCierre 
                  ? 'Consolidando Cierre...' 
                  : !estadoDiario?.puedeCerrar 
                    ? 'Cierre Bloqueado (Hay Pendientes)' 
                    : 'Ejecutar Cierre Diario Definitivo'}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal / Acta de Cierre Diario Certificada */}
      {mostrarCertificado && cierreRealizado && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <div className="text-center border-b border-slate-200 pb-4 mb-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Acta Oficial de Cierre de Caja</h3>
              <p className="text-xs text-slate-500">Centro Clínico Imagen Salud C.A.</p>
              <p className="text-[11px] font-mono text-emerald-700 font-bold mt-1">Folio Certificado #{cierreRealizado.id || 'CIE-001'}</p>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Fecha de Cierre:</span>
                <span className="font-bold">{fechaCierre}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Responsable:</span>
                <span className="font-bold">{cierreRealizado.usuario_responsable || 'Administrador'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Efectivo Divisas ($) Sistema:</span>
                <span className="font-bold text-emerald-600 font-mono">${Number(cierreRealizado.total_divisas_usd || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Efectivo Bolívares Sistema:</span>
                <span className="font-bold text-blue-600 font-mono">Bs. {Number(cierreRealizado.total_efectivo_bs || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Punto de Venta:</span>
                <span className="font-bold text-indigo-600 font-mono">Bs. {Number(cierreRealizado.total_punto_bs || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Pago Móvil:</span>
                <span className="font-bold text-cyan-600 font-mono">Bs. {Number(cierreRealizado.total_pago_movil_bs || 0).toFixed(2)}</span>
              </div>
            </div>

            {arqueoResultado.length > 0 && (
              <div className="mt-3 text-xs">
                <p className="font-bold text-slate-700 mb-1">Arqueo (contado vs sistema)</p>
                {arqueoResultado.map((l) => {
                  const m = METODOS.find((x) => x.clave === l.metodo);
                  const d = Number(l.diferencia);
                  return (
                    <div key={l.metodo} className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">{m?.etiqueta}: {l.contado} / {l.esperado}</span>
                      <span className={`font-bold font-mono ${d === 0 ? 'text-emerald-600' : d > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {d === 0 ? 'Cuadra' : d > 0 ? `Sobrante +${l.diferencia}` : `Faltante ${l.diferencia}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-center">
              <div className="border-t border-slate-400 pt-1">
                <p className="text-[10px] font-bold text-slate-700">Firma Cajero Entregante</p>
              </div>
              <div className="border-t border-slate-400 pt-1">
                <p className="text-[10px] font-bold text-slate-700">Firma Administrador Receptor</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setMostrarCertificado(false)} 
                className="flex-1 rounded-xl text-xs"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
