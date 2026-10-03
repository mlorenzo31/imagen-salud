'use client';

import { useEffect, useState } from 'react';

export type PeriodoResumen = 'HOY' | '7DIAS' | 'MES' | 'TODO';

export interface PuntoTendencia {
  dia: string;
  IngresosUSD: number;
  EgresosUSD: number;
  MargenUSD: number;
  IngresosBs: number;
  EgresosBs: number;
}

export interface ResumenFinanciero {
  periodo: PeriodoResumen;
  tasa: number;
  ingresosUsd: number;
  ingresosBs: number;
  egresosBs: number;
  comisionesBs: number;
  transacciones: number;
  tendencia: PuntoTendencia[];
  distribucion: { name: string; value: number }[];
}

const VACIO: ResumenFinanciero = {
  periodo: 'MES', tasa: 0, ingresosUsd: 0, ingresosBs: 0, egresosBs: 0, comisionesBs: 0, transacciones: 0, tendencia: [], distribucion: [],
};

/** Métricas reales del período; se refrescan cada 2 min sin intervención. */
export function useResumenFinanciero(periodo: PeriodoResumen) {
  const [data, setData] = useState<ResumenFinanciero>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const res = await fetch(`/api/analytics/resumen?periodo=${periodo}`);
        if (!res.ok) throw new Error('No se pudieron cargar las métricas');
        const json: ResumenFinanciero = await res.json();
        if (vivo) { setData(json); setError(null); }
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (vivo) setCargando(false);
      }
    };
    cargar();
    const id = setInterval(cargar, 2 * 60 * 1000);
    return () => { vivo = false; clearInterval(id); };
  }, [periodo]);

  return { data, cargando, error };
}
