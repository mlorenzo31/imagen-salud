'use client';

import React from 'react';

export interface RetencionRecibidaFila {
  id: number; agente_rif: string; agente_razon_social: string; numero_comprobante: string; fecha_comprobante: string; periodo: string;
  iva_retenido: string; islr_retenido: string; observacion: string | null; usuario: string | null; anulada: boolean; motivo_anulacion: string | null;
  serie: string; factura_numero: string; numero_control: string | null; factura_fecha: string; total_bs: string; total_iva_bs: string;
}

export const bsTexto = (v: string | number) => `Bs. ${Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props { filas: RetencionRecibidaFila[]; onAnular?: (f: RetencionRecibidaFila) => void }

export const TablaRetencionesRecibidas: React.FC<Props> = ({ filas, onAnular }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
    <table className="w-full text-xs">
      <thead className="bg-slate-50 text-left text-slate-600">
        <tr><th className="p-2">Comprobante</th><th className="p-2">Fecha</th><th className="p-2">Agente de retención</th><th className="p-2">Factura · control</th>
          <th className="p-2 text-right">Total factura</th><th className="p-2 text-right">IVA ret.</th><th className="p-2 text-right">ISLR ret.</th><th className="p-2"></th></tr>
      </thead>
      <tbody>
        {filas.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500">No hay retenciones registradas en el período.</td></tr>}
        {filas.map((f) => (
          <tr key={f.id} className={`border-t border-slate-100 ${f.anulada ? 'text-slate-400' : ''}`}>
            <td className="p-2 font-mono font-bold">{f.numero_comprobante}{f.anulada && <span className="block font-sans font-normal">Anulada: {f.motivo_anulacion}</span>}</td>
            <td className="p-2">{f.fecha_comprobante}</td>
            <td className="p-2">{f.agente_razon_social}<span className="block text-slate-400">{f.agente_rif}</span></td>
            <td className="p-2 font-mono">{f.serie ? `${f.serie}-` : ''}{f.factura_numero} · {f.numero_control ?? '—'}</td>
            <td className="p-2 text-right font-mono">{bsTexto(f.total_bs)}</td>
            <td className="p-2 text-right font-mono">{bsTexto(f.iva_retenido)}</td>
            <td className="p-2 text-right font-mono">{bsTexto(f.islr_retenido)}</td>
            <td className="p-2">{onAnular && !f.anulada && (
              <button onClick={() => onAnular(f)} className="rounded-lg border border-slate-300 px-2 py-0.5 font-bold text-slate-700 hover:bg-slate-50">Anular</button>
            )}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
