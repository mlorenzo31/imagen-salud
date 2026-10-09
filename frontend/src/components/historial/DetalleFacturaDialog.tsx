'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Paperclip } from 'lucide-react';
import { normalizarCedulaRif } from '@/lib/cedulaRif';
import { esAnulada } from '@/lib/estados';
import { FacturaCaja } from '@/types';
import React from 'react';
import { parseFechaLocal } from '@/lib/date';
import { precioListaCents } from '@/lib/descuento';

interface DetalleFacturaDialogProps {
  facturaDetalle: FacturaCaja | null;
  setFacturaDetalle: React.Dispatch<React.SetStateAction<FacturaCaja | null>>;
  formatUSD: (val?: number | string | null) => string;
  formatBs: (val?: number | string | null) => string;
}

export const DetalleFacturaDialog: React.FC<DetalleFacturaDialogProps> = ({ facturaDetalle, setFacturaDetalle, formatUSD, formatBs }) => (
  <Dialog open={Boolean(facturaDetalle)} onOpenChange={(open) => !open && setFacturaDetalle(null)}>
    <DialogContent className="sm:max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-slate-900 font-black text-base">
          <div className="p-2 bg-clinica-selection rounded-xl text-clinica-primary">
            <FileText className="w-5 h-5" />
          </div>
          <span>Detalle de Movimiento Clínico #{facturaDetalle?.id}</span>
        </DialogTitle>
      </DialogHeader>

      {facturaDetalle && (
        <div className="space-y-4 py-2 text-xs">
          {/* Encabezado Paciente */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <h4 className="font-black text-slate-900 text-sm">{facturaDetalle.nombre_paciente}</h4>
              <p className="text-[11px] font-mono text-slate-500">
                Cédula: <strong>{normalizarCedulaRif(facturaDetalle.cedula_paciente || '')}</strong> • Tel: {facturaDetalle.telefono_paciente || 'N/A'}
              </p>
            </div>
            <div className="text-right">
              <Badge className="bg-slate-800 text-white font-mono text-xs">
                {facturaDetalle.fecha ? parseFechaLocal(facturaDetalle.fecha).toLocaleDateString('es-VE') : ''}
              </Badge>
              <p className="text-[10px] text-slate-500 mt-0.5">{facturaDetalle.hora || ''}</p>
            </div>
          </div>

          {/* Estudio y Servicios */}
          <div className="space-y-2">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
              Estudios y Procedimientos Facturados
            </h5>
            <div className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>{facturaDetalle.estudio}</span>
                <span className="font-mono text-emerald-700">{formatUSD(facturaDetalle.precio_usd)}</span>
              </div>
              {Number(facturaDetalle.descuento_usd ?? 0) > 0 && (
                <div className="text-[11px] text-slate-700 border-t border-slate-100 pt-1.5">
                  Precio de lista <strong>{formatUSD(precioListaCents(facturaDetalle) / 100)}</strong> − descuento <strong>{formatUSD(facturaDetalle.descuento_usd)}</strong>
                  {facturaDetalle.descuento_origen === 'PROMO' ? ' (promoción)' : ' (manual)'}
                  {facturaDetalle.descuento_motivo ? ` · ${facturaDetalle.descuento_motivo}` : ''}
                </div>
              )}
              <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
                <span>Médico Asignado: <strong>{facturaDetalle.medico || 'De Guardia'}</strong></span>
                <span>Tasa BCV: <strong>{formatBs(facturaDetalle.tasa_bcv || 0)}</strong></span>
              </div>
            </div>
          </div>

          {/* Desglose Multimoneda */}
          <div className="space-y-2">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
              Desglose de Formas de Pago
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-500 font-bold">Divisas USD</p>
                <p className="font-bold font-mono text-emerald-700">{formatUSD(facturaDetalle.pago_divisas)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-500 font-bold">Pago Móvil</p>
                <p className="font-bold font-mono text-blue-700">{formatBs(facturaDetalle.pago_movil)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-500 font-bold">Punto POS</p>
                <p className="font-bold font-mono text-blue-700">{formatBs(facturaDetalle.pago_punto)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-500 font-bold">Efectivo Bs</p>
                <p className="font-bold font-mono text-slate-700">{formatBs(facturaDetalle.pago_efectivo_bs)}</p>
              </div>
            </div>
          </div>

          {/* Documentación Digital y WhatsApp */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                Documento de Resultados / Imágenes
              </span>
              <Badge className={facturaDetalle.adjunto_nombre ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}>
                {facturaDetalle.adjunto_nombre ? 'Adjuntado' : 'Sin Adjunto'}
              </Badge>
            </div>
            <p className="text-[11px] font-mono text-slate-700 truncate">
              {facturaDetalle.adjunto_nombre || 'No se han cargado imágenes digitales para este movimiento.'}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-emerald-200/40 text-[11px]">
              <span className="text-slate-600">Notificación por WhatsApp:</span>
              <span className="font-bold text-emerald-800">
                {facturaDetalle.whatsapp_enviado 
                  ? `Enviado (${facturaDetalle.whatsapp_fecha_envio ? new Date(facturaDetalle.whatsapp_fecha_envio).toLocaleString('es-VE') : 'Sí'})` 
                  : 'No enviado'}
              </span>
            </div>
          </div>

          {/* Motivo de Anulación si aplica */}
          {esAnulada(facturaDetalle.estado) && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
              <p className="font-bold">Factura Anulada</p>
              <p className="text-[11px] mt-0.5">{facturaDetalle.motivo_anulacion || 'Sin motivo especificado.'}</p>
            </div>
          )}
        </div>
      )}

      <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
        <Button
          variant="outline"
          onClick={() => setFacturaDetalle(null)}
          className="rounded-xl text-xs font-bold"
        >
          Cerrar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
