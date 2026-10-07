'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, ShieldAlert } from 'lucide-react';
import { BloqueoCierrePendiente } from '@/components/BloqueoCierrePendiente';
import { PinCierreDialog } from '@/components/PinCierreDialog';
import { getErrorMessage } from '@/lib/utils';
import type { PacientePendiente, ResumenCierre, UserRole } from '@/types';

interface EstadoJornada {
  requiereCierre: boolean;
  fecha?: string;
  hoy?: string;
  puedeCerrar?: boolean;
  pacientesPendientes?: PacientePendiente[];
  pacientesWhatsAppPendientes?: PacientePendiente[];
  resumen?: ResumenCierre;
}

interface Props {
  role: UserRole;
  /** Se llama tras cerrar la caja para refrescar los datos de la pantalla. */
  onResuelto: () => void;
}

const num = (v: unknown) => Number(v ?? 0);

/** Medios que se cuentan al cerrar (mismas claves que el servidor). */
const METODOS = [
  { clave: 'divisas_usd', etiqueta: 'Efectivo divisas', simbolo: '$', campo: 'totalDivisasUSD' },
  { clave: 'efectivo_bs', etiqueta: 'Efectivo bolívares', simbolo: 'Bs.', campo: 'totalEfectivoBs' },
  { clave: 'punto_bs', etiqueta: 'Punto de venta', simbolo: 'Bs.', campo: 'totalPuntoBs' },
  { clave: 'pago_movil_bs', etiqueta: 'Pago móvil', simbolo: 'Bs.', campo: 'totalPagoMovilBs' },
] as const;

/**
 * Bloqueo obligatorio: si pasó un día sin cerrar caja, nadie opera hasta cerrarla.
 * Primero se resuelven los pacientes en espera/atención y los resultados sin enviar; luego se cierra la caja.
 */
export const CierreObligatorio: React.FC<Props> = ({ role, onResuelto }) => {
  const [estado, setEstado] = useState<EstadoJornada | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Admin y asistente cierran la caja (también días anteriores); el cajero espera.
  const esAdmin = role === 'admin' || role === 'asistente';
  const [abierto, setAbierto] = useState(false);
  const [pidiendoPin, setPidiendoPin] = useState(false);
  const [conteo, setConteo] = useState<Record<string, string>>({ divisas_usd: '', efectivo_bs: '', punto_bs: '', pago_movil_bs: '' });
  const [observaciones, setObservaciones] = useState('');

  const refrescar = useCallback(async () => {
    try {
      const res = await fetch('/api/cierres/estado-jornada');
      if (res.ok) setEstado(await res.json());
    } catch {
      /* sin red: se reintenta en el próximo ciclo */
    }
  }, []);

  useEffect(() => {
    const inicial = setTimeout(refrescar, 0);
    const id = setInterval(refrescar, 60 * 1000);
    window.addEventListener('focus', refrescar);
    return () => { clearTimeout(inicial); clearInterval(id); window.removeEventListener('focus', refrescar); };
  }, [refrescar]);

  const cerrarCaja = async (pin: string) => {
    if (!estado?.fecha) return;
    setCerrando(true);
    setError(null);
    try {
      const res = await fetch('/api/cierres/ejecutar-cierre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: estado.fecha, observaciones: observaciones.trim() || 'Cierre obligatorio de jornada anterior', arqueo: conteo, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo cerrar la caja.');
      setPidiendoPin(false);
      await refrescar();
      onResuelto();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCerrando(false);
    }
  };

  if (!estado?.requiereCierre || !estado.fecha) return null;

  // El administrador no se bloquea: puede operar y cerrar la caja pendiente cuando decida.
  if (esAdmin && !abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-2xl bg-clinica-coral px-4 py-3 text-xs font-black text-white shadow-xl hover:opacity-90"
      >
        <ShieldAlert className="w-4 h-4" />
        Caja del {estado.fecha} sin cerrar · Cerrar ahora
      </button>
    );
  }

  const sala = estado.pacientesPendientes ?? [];
  const wa = estado.pacientesWhatsAppPendientes ?? [];

  // Paso 1 (admin): dar continuidad a pacientes en espera/atención y resultados sin enviar.
  if (esAdmin && (sala.length > 0 || wa.length > 0)) {
    return (
      <BloqueoCierrePendiente
        key={[...sala, ...wa].map((p) => p.id).join(',')}
        open
        onOpenChange={(o) => { if (!o) setAbierto(false); }}
        fechaPendiente={estado.fecha}
        pacientesPendientes={sala}
        pacientesWhatsAppPendientes={wa}
        onCierreCompletado={refrescar}
        esJornadaAnterior
      />
    );
  }

  // Paso 2: cerrar la caja (admin) o esperar al administrador (resto de roles).
  const r = estado.resumen ?? {};
  const esperado = (campo: (typeof METODOS)[number]['campo']) => Math.round(num(r[campo]) * 100);
  const contadoCents = (clave: string): number | null => (/^\d+(\.\d{1,2})?$/.test(conteo[clave].trim()) ? Math.round(Number(conteo[clave]) * 100) : null);
  const conteoCompleto = METODOS.every((m) => contadoCents(m.clave) !== null);
  const hayDif = conteoCompleto && METODOS.some((m) => contadoCents(m.clave) !== esperado(m.campo));
  const pendientesParaOtros = sala.length + wa.length;
  return (
    <Dialog open onOpenChange={(o) => { if (esAdmin && !o) setAbierto(false); }}>
      <DialogContent
        showCloseButton={esAdmin}
        onInteractOutside={(e) => { if (!esAdmin) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!esAdmin) e.preventDefault(); }}
        className="sm:max-w-lg rounded-3xl p-6 bg-white shadow-2xl border-2 border-clinica-coral/40"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-clinica-coral font-black text-lg">
            <div className="p-2 bg-clinica-coral-soft rounded-xl"><ShieldAlert className="w-6 h-6" /></div>
            <span>Cierre de caja pendiente</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-slate-700">
          <p>
            La caja del día <strong className="font-mono">{estado.fecha}</strong> no fue cerrada. Para llevar el orden de los pacientes y la
            contabilidad, el personal no puede operar hasta cerrarla.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">Facturas: <strong>{num(r.total_facturas)}</strong></div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">Total: <strong>${num(r.total_usd).toFixed(2)}</strong></div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">Divisas: <strong>${num(r.totalDivisasUSD).toFixed(2)}</strong></div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">Bs (efectivo + punto + móvil): <strong>{(num(r.totalEfectivoBs) + num(r.totalPuntoBs) + num(r.totalPagoMovilBs)).toFixed(2)}</strong></div>
          </div>

          {esAdmin ? (
            <>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Cuente la caja e indique el monto por medio de pago (0 si no hubo):</p>
                {METODOS.map((m) => {
                  const c = contadoCents(m.clave);
                  const dif = c === null ? null : c - esperado(m.campo);
                  return (
                    <div key={m.clave} className="grid grid-cols-[1fr_7rem] items-center gap-2">
                      <label htmlFor={`conteo-${m.clave}`} className="text-xs text-slate-700">
                        {m.etiqueta} ({m.simbolo})
                        <span className="block text-[11px] text-slate-500">
                          Sistema: {m.simbolo} {(esperado(m.campo) / 100).toFixed(2)}
                          {dif !== null && (
                            <span className={`ml-1 font-bold ${dif === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {dif === 0 ? '· Cuadra' : dif > 0 ? `· Sobrante ${(dif / 100).toFixed(2)}` : `· Faltante ${(Math.abs(dif) / 100).toFixed(2)}`}
                            </span>
                          )}
                        </span>
                      </label>
                      <Input id={`conteo-${m.clave}`} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={conteo[m.clave]}
                        onChange={(e) => setConteo((p) => ({ ...p, [m.clave]: e.target.value }))} className="rounded-xl text-sm font-mono text-right" />
                    </div>
                  );
                })}
                {hayDif && (
                  <div>
                    <p className="text-[11px] font-bold text-amber-700 mb-1">Hay sobrante o faltante: explíquelo para poder cerrar.</p>
                    <Input aria-label="Explicación del sobrante o faltante" placeholder="Explicación" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="rounded-xl text-xs" />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">Al cerrar, la sala de espera queda vacía en sus tres columnas y comienza la nueva jornada.</p>
              {error && <p className="text-xs font-bold text-clinica-coral">{error}</p>}
              <Button onClick={() => { setError(null); setPidiendoPin(true); }} disabled={cerrando || estado.puedeCerrar === false || !conteoCompleto || (hayDif && !observaciones.trim())} className="w-full rounded-xl font-bold bg-clinica-primary hover:bg-clinica-primary-dark text-white">
                <Lock className="w-4 h-4 mr-2" />
                {cerrando ? 'Cerrando caja…' : `Cerrar caja del ${estado.fecha}`}
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-clinica-coral">
                Solo el administrador o el asistente pueden cerrar la caja. Avíseles para continuar{pendientesParaOtros > 0 ? ` (hay ${pendientesParaOtros} paciente(s) por resolver)` : ''}.
              </p>
              <Button variant="outline" onClick={refrescar} className="w-full rounded-xl font-bold">Verificar de nuevo</Button>
            </>
          )}
        </div>
      </DialogContent>
      <PinCierreDialog open={pidiendoPin} cargando={cerrando} error={error} onCancelar={() => setPidiendoPin(false)} onConfirmar={cerrarCaja} />
    </Dialog>
  );
};
