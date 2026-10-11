'use client';

import * as React from 'react';
import { CheckCircle2, AlertCircle, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Avisos y confirmaciones propios (sin dependencias): reemplazan alert() y confirm() del navegador.
 *   const { avisar, confirmar } = useAvisos();
 *   avisar({ tipo: 'exito', mensaje: 'Paciente registrado.' });
 *   if (await confirmar({ titulo: 'Anular factura', mensaje: '…', textoConfirmar: 'Anular', tono: 'peligro' })) { … }
 */
export type TipoAviso = 'exito' | 'error' | 'alerta' | 'info';

interface OpcionesAviso { tipo?: TipoAviso; titulo?: string; mensaje: string; duracionMs?: number }
interface OpcionesConfirmar { titulo: string; mensaje?: string; textoConfirmar?: string; textoCancelar?: string; tono?: 'normal' | 'peligro' }
interface AvisoActivo extends OpcionesAviso { id: number; tipo: TipoAviso }
interface ConfirmacionActiva extends OpcionesConfirmar { resolver: (v: boolean) => void }

interface Contexto {
  avisar: (o: OpcionesAviso | string) => void;
  confirmar: (o: OpcionesConfirmar) => Promise<boolean>;
}

const AvisosContext = React.createContext<Contexto | null>(null);

const DURACION: Record<TipoAviso, number> = { exito: 4000, info: 4000, alerta: 7000, error: 8000 };
const ESTILO: Record<TipoAviso, { icono: React.ElementType; clase: string; iconoClase: string }> = {
  exito: { icono: CheckCircle2, clase: 'border-emerald-200', iconoClase: 'text-emerald-600' },
  error: { icono: AlertCircle, clase: 'border-rose-200', iconoClase: 'text-rose-600' },
  alerta: { icono: TriangleAlert, clase: 'border-amber-200', iconoClase: 'text-amber-600' },
  info: { icono: Info, clase: 'border-slate-200', iconoClase: 'text-slate-500' },
};

export function AvisosProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = React.useState<AvisoActivo[]>([]);
  const [confirmacion, setConfirmacion] = React.useState<ConfirmacionActiva | null>(null);
  const siguienteId = React.useRef(0);

  const cerrar = React.useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);

  const avisar = React.useCallback((entrada: OpcionesAviso | string) => {
    const o = typeof entrada === 'string' ? { mensaje: entrada } : entrada;
    const tipo = o.tipo ?? 'info';
    const id = ++siguienteId.current;
    setAvisos((a) => [...a.slice(-3), { ...o, id, tipo }]);
    setTimeout(() => cerrar(id), o.duracionMs ?? DURACION[tipo]);
  }, [cerrar]);

  const confirmar = React.useCallback(
    (o: OpcionesConfirmar) => new Promise<boolean>((resolver) => setConfirmacion({ ...o, resolver })),
    []
  );

  const responder = (valor: boolean) => {
    confirmacion?.resolver(valor);
    setConfirmacion(null);
  };

  const valor = React.useMemo(() => ({ avisar, confirmar }), [avisar, confirmar]);

  return (
    <AvisosContext.Provider value={valor}>
      {children}

      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 top-[4.5rem] z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
        {avisos.map((a) => {
          const { icono: Icono, clase, iconoClase } = ESTILO[a.tipo];
          return (
            <div
              key={a.id}
              className={cn('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-3.5 shadow-lg animate-in fade-in-0 slide-in-from-top-2 duration-200', clase)}
            >
              <Icono className={cn('mt-0.5 size-4 shrink-0', iconoClase)} aria-hidden="true" />
              <div className="min-w-0 flex-1 text-sm">
                {a.titulo && <p className="font-semibold text-slate-900">{a.titulo}</p>}
                <p className="whitespace-pre-line text-slate-700">{a.mensaje}</p>
              </div>
              <button type="button" onClick={() => cerrar(a.id)} aria-label="Cerrar aviso" className="rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-700">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>

      <Dialog open={confirmacion !== null} onOpenChange={(abierto) => { if (!abierto) responder(false); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmacion?.titulo}</DialogTitle>
            {confirmacion?.mensaje && <DialogDescription className="whitespace-pre-line">{confirmacion.mensaje}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => responder(false)}>{confirmacion?.textoCancelar ?? 'Cancelar'}</Button>
            <Button
              type="button"
              variant={confirmacion?.tono === 'peligro' ? 'destructive' : 'default'}
              onClick={() => responder(true)}
              autoFocus
            >
              {confirmacion?.textoConfirmar ?? 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AvisosContext.Provider>
  );
}

export function useAvisos(): Contexto {
  const ctx = React.useContext(AvisosContext);
  if (!ctx) throw new Error('useAvisos debe usarse dentro de <AvisosProvider>.');
  return ctx;
}
