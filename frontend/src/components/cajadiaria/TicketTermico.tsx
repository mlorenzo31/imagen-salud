'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Receipt } from 'lucide-react';
import { FacturaCaja } from '@/types';

interface TicketTermicoProps {
  facturaSeleccionada: FacturaCaja;
  tasaBcv: number;
  setMostrarModalTicket: React.Dispatch<React.SetStateAction<boolean>>;
}

export const TicketTermico: React.FC<TicketTermicoProps> = ({ facturaSeleccionada, tasaBcv, setMostrarModalTicket }) => (
  <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
      {/* Ticket Térmico Design */}
      <div id="ticket-termico" className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 font-mono text-xs text-slate-800">
        <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
          <h3 className="font-black text-sm tracking-wider text-slate-900">IMAGEN SALUD C.A.</h3>
          <p className="text-[10px] text-slate-500">RIF: J-50123456-7</p>
          <p className="text-[10px] text-slate-500">Av. Principal, Edif. Clínico, Piso 1</p>
          <div className="mt-2 py-1 bg-slate-900 text-white rounded text-center">
            <p className="font-black text-sm">TURNO #{facturaSeleccionada.turno_num ? String(facturaSeleccionada.turno_num).padStart(3, '0') : facturaSeleccionada.id}</p>
          </div>
        </div>

        <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2 mb-2">
          <p><span className="text-slate-400">Folio:</span> #{facturaSeleccionada.id}</p>
          <p><span className="text-slate-400">Fecha/Hora:</span> {facturaSeleccionada.fecha} {facturaSeleccionada.hora}</p>
          <p><span className="text-slate-400">Paciente:</span> {facturaSeleccionada.nombre_paciente}</p>
          <p><span className="text-slate-400">Cédula:</span> {facturaSeleccionada.cedula_paciente}</p>
          <p><span className="text-slate-400">Médico:</span> {facturaSeleccionada.medico || 'De Guardia'}</p>
        </div>

        <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Servicios:</p>
          <p className="font-bold text-slate-900">{facturaSeleccionada.estudio}</p>
        </div>

        <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2 mb-2">
          <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
            <span>TOTAL FACTURADO:</span>
            <span>${Number(facturaSeleccionada.precio_usd || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-cyan-800">
            <span>EQUIVALENTE EN BS:</span>
            <span>Bs. {(Number(facturaSeleccionada.precio_usd || 0) * Number(facturaSeleccionada.tasa_bcv || tasaBcv)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Tasa Oficial BCV:</span>
            <span>Bs. {Number(facturaSeleccionada.tasa_bcv || tasaBcv).toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-1 text-[10px] text-slate-600">
          <p className="font-bold text-slate-700">Formas de Pago Aplicadas:</p>
          {Number(facturaSeleccionada.pago_divisas || 0) > 0 && (
            <div className="flex justify-between">
              <span>Efectivo Divisas ($):</span>
              <span className="font-bold">${Number(facturaSeleccionada.pago_divisas).toFixed(2)}</span>
            </div>
          )}
          {Number(facturaSeleccionada.pago_efectivo_bs || 0) > 0 && (
            <div className="flex justify-between">
              <span>Efectivo Bolívares:</span>
              <span className="font-bold">Bs. {Number(facturaSeleccionada.pago_efectivo_bs).toFixed(2)}</span>
            </div>
          )}
          {Number(facturaSeleccionada.pago_punto || 0) > 0 && (
            <div className="flex justify-between">
              <span>Punto de Venta:</span>
              <span className="font-bold">Bs. {Number(facturaSeleccionada.pago_punto).toFixed(2)}</span>
            </div>
          )}
          {Number(facturaSeleccionada.pago_movil || 0) > 0 && (
            <div className="flex justify-between">
              <span>Pago Móvil:</span>
              <span className="font-bold">Bs. {Number(facturaSeleccionada.pago_movil).toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-slate-400 mt-4 pt-3 border-t border-dashed border-slate-300">
          <p>¡Gracias por su confianza!</p>
          <p>Favor esperar su llamado en sala por pantalla.</p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button 
          variant="outline" 
          onClick={() => setMostrarModalTicket(false)} 
          className="flex-1 rounded-xl text-xs"
        >
          Cerrar
        </Button>
        <Button 
          onClick={() => {
            const texto = 'IMAGEN SALUD - COMPROBANTE DIGITAL\n' +
              'Turno #' + (facturaSeleccionada.turno_num || facturaSeleccionada.id) + '\n' +
              'Paciente: ' + facturaSeleccionada.nombre_paciente + '\n' +
              'Estudio: ' + facturaSeleccionada.estudio + '\n' +
              'Total: $' + Number(facturaSeleccionada.precio_usd || 0).toFixed(2);
            navigator.clipboard.writeText(texto);
            alert('Comprobante copiado al portapapeles. Impresión en papel desactivada.');
          }} 
          className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs flex items-center justify-center gap-1.5"
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Copiar Digital</span>
        </Button>
      </div>
    </div>
  </div>
);
