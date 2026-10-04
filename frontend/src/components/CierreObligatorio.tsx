'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

/**
 * Bloqueo obligatorio: si pasó un día sin cerrar caja, nadie opera hasta cerrarla.
 * Primero se resuelven los pacientes en espera/atención y los resultados sin enviar; luego se cierra la caja.
 */
export const CierreObligatorio: React.FC<Props> = ({ role, onResuelto }) => {
  const [estado, setEstado] = useState<EstadoJornada | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esAdmin = role === 'admin';
  const [abierto, setAbierto] = useState(false);
  const [pidiendoPin, setPidiendoPin] = useState(false);

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
        body: JSON.stringify({ fecha: estado.fecha, observaciones: 'Cierre obligatorio de jornada anterior', pin }),
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
              <p className="text-xs text-slate-500">Al cerrar, la sala de espera queda vacía en sus tres columnas y comienza la nueva jornada.</p>
              {error && <p className="text-xs font-bold text-clinica-coral">{error}</p>}
              <Button onClick={() => { setError(null); setPidiendoPin(true); }} disabled={cerrando || estado.puedeCerrar === false} className="w-full rounded-xl font-bold bg-clinica-primary hover:bg-clinica-primary-dark text-white">
                <Lock className="w-4 h-4 mr-2" />
                {cerrando ? 'Cerrando caja…' : `Cerrar caja del ${estado.fecha}`}
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-clinica-coral">
                Solo el administrador puede cerrar la caja. Avísele para continuar{pendientesParaOtros > 0 ? ` (hay ${pendientesParaOtros} paciente(s) por resolver)` : ''}.
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
