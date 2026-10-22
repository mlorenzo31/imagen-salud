'use client';

import React from 'react';
import { ETIQUETA_ESTADO, facturable, type FilaTablero } from '@/lib/fiscal/tablero';
import { MOTIVOS_DIFERIDO, type MotivoDiferido } from '@/lib/fiscal/diferido';
import { COLOR_ESTADO, bs, usd } from './TarjetasResumen';

interface Props {
  filas: FilaTablero[];
  seleccion: Set<number>;
  onToggle: (id: number) => void;
  soloPendientes: boolean;
}

/** Cobros del período con su estado fiscal; los que aún no tienen factura se pueden seleccionar para emitirla. */
export const TablaCobrosFiscales: React.FC<Props> = ({ filas, seleccion, onToggle, soloPendientes }) => {
  const visibles = soloPendientes ? filas.filter((f) => f.estado !== 'EMITIDA') : filas;
  if (visibles.length === 0) return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No hay cobros para mostrar.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="p-2"></th><th className="p-2">Fecha</th><th className="p-2">Cobro</th><th className="p-2">Paciente</th>
            <th className="p-2">Facturar a</th><th className="p-2 text-right">USD</th><th className="p-2 text-right">Bs</th>
            <th className="p-2">Estado</th><th className="p-2">Factura / N° control</th><th className="p-2">Motivo · límite</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((f) => (
            <tr key={f.id} className="border-t border-slate-100">
              <td className="p-2">{facturable(f.estado) && <input type="checkbox" checked={seleccion.has(f.id)} onChange={() => onToggle(f.id)} aria-label={`Seleccionar cobro ${f.id}`} />}</td>
              <td className="p-2 whitespace-nowrap">{f.fecha}</td>
              <td className="p-2 font-mono">#{f.id}</td>
              <td className="p-2">{f.paciente}<span className="block text-slate-400">{f.cedula}</span></td>
              <td className="p-2">{f.facturarA ?? '—'}</td>
              <td className="p-2 text-right font-mono">{usd(f.totalUsd)}</td>
              <td className="p-2 text-right font-mono">{bs(f.totalBs)}</td>
              <td className="p-2"><span className={`rounded-full border px-2 py-0.5 font-bold ${COLOR_ESTADO[f.estado]}`}>{ETIQUETA_ESTADO[f.estado]}</span></td>
              <td className="p-2 font-mono">{f.docNumero ? `${f.docNumero}${f.docControl ? ` · ${f.docControl}` : ''}` : '—'}</td>
              <td className="p-2">{f.motivoDiferido ? `${MOTIVOS_DIFERIDO[f.motivoDiferido as MotivoDiferido]?.etiqueta.split(':')[0] ?? f.motivoDiferido} · ${f.facturarAntesDe}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
