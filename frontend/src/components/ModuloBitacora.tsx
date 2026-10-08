'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ScrollText } from 'lucide-react';
import { diferir } from '@/lib/diferir';

interface Registro {
  id: number; creado_en: string; tipo: string; fecha_afectada: string | null; a_destiempo: boolean;
  usuario: string | null; rol: string | null; descripcion: string;
}

const TIPOS: Record<string, string> = {
  CIERRE_DIARIO: 'Cierre de caja',
  RESOLUCION_CIERRE: 'Resolución en cierre',
  ANULACION_FACTURA: 'Anulación de factura',
  USUARIO: 'Gestión de usuarios',
  RECUPERACION_CLAVE: 'Recuperación de clave',
  REAPERTURA_CIERRE: 'Reapertura de caja',
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', dateStyle: 'short', timeStyle: 'short' });

/** Bitácora de hechos administrativos, con foco en los que ocurren a destiempo. Solo administrador. */
export const ModuloBitacora: React.FC = () => {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [soloDestiempo, setSoloDestiempo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/bitacora?destiempo=${soloDestiempo ? 1 : 0}`);
      if (!res.ok) throw new Error('No se pudo cargar la bitácora.');
      setRegistros((await res.json()) as Registro[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, [soloDestiempo]);

  useEffect(() => diferir(cargar), [cargar]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-slate-700" /> Bitácora
          </h2>
          <p className="text-xs text-slate-500 mt-1">Hechos de jornadas anteriores: cierres tardíos, resoluciones y anulaciones. Solo administrador.</p>
        </div>
        <div className="flex items-center gap-2">
          {([[true, 'A destiempo'], [false, 'Todo']] as const).map(([v, t]) => (
            <button
              key={t}
              type="button"
              onClick={() => setSoloDestiempo(v)}
              className={`px-3 h-8 rounded-xl text-xs font-bold border ${soloDestiempo === v ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {t}
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={cargar} disabled={cargando} className="rounded-xl text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </div>
      </div>

      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="p-3">Registrado</th>
                <th className="p-3">Hecho</th>
                <th className="p-3">Jornada</th>
                <th className="p-3">Usuario</th>
                <th className="p-3">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500">{cargando ? 'Cargando…' : 'Sin registros.'}</td></tr>
              )}
              {registros.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 whitespace-nowrap font-mono">{fechaHora(r.creado_en)}</td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="font-bold">{TIPOS[r.tipo] ?? r.tipo}</span>
                    {r.a_destiempo && <Badge className="ml-2 bg-amber-500 text-white">A destiempo</Badge>}
                  </td>
                  <td className="p-3 whitespace-nowrap font-mono">{r.fecha_afectada ?? '-'}</td>
                  <td className="p-3 whitespace-nowrap">{r.usuario ?? '-'} <span className="text-slate-500">({r.rol ?? '-'})</span></td>
                  <td className="p-3">{r.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
