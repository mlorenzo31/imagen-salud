'use client';

import React, { useState, useEffect } from 'react';
import { CuentaBancaria, registrarCambioDivisa } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeftRight, AlertCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

interface ModalCambioDivisaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentas: CuentaBancaria[];
  onSuccess: () => void;
}

export const ModalCambioDivisa: React.FC<ModalCambioDivisaProps> = ({
  open,
  onOpenChange,
  cuentas,
  onSuccess
}) => {
  // Cuentas en Bolívares
  const cuentasBs = cuentas.filter(c => c.moneda === 'BS');
  const [cuentaId, setCuentaId] = useState<number>(cuentasBs[0]?.id || 4);
  const [montoBs, setMontoBs] = useState<string>('');
  const [tasaManual, setTasaManual] = useState<string>('');
  // Pre-llena la tasa con la BCV vigente (el operador solo la ajusta si el banco aplicó otra).
  useEffect(() => {
    if (!open) return;
    fetch('/api/bcv')
      .then(res => res.json())
      .then(d => { if (d.tasa > 0) setTasaManual(prev => prev || String(d.tasa)); })
      .catch(() => {});
  }, [open]);
  const [comisionBs, setComisionBs] = useState<string>('0.00');
  const [referencia, setReferencia] = useState<string>('');
  const [notas, setNotas] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedCuenta = cuentas.find(c => c.id === cuentaId);
  const saldoDisp = selectedCuenta ? parseFloat(String(selectedCuenta.saldo_actual)) : 0;

  const bsBase = parseFloat(montoBs) || 0;
  const tasa = parseFloat(tasaManual) || 0;
  const comision = parseFloat(comisionBs) || 0;
  const totalDebitadoBs = bsBase + comision;
  const totalUsdComprado = tasa > 0 ? parseFloat((bsBase / tasa).toFixed(2)) : 0;

  const isSaldoInsuficiente = totalDebitadoBs > saldoDisp;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (bsBase <= 0) {
      setErrorMsg('Ingrese un monto válido en Bolívares.');
      return;
    }
    if (tasa <= 0) {
      setErrorMsg('La tasa de cambio pactada debe ser mayor a 0.');
      return;
    }
    if (isSaldoInsuficiente) {
      setErrorMsg(`Saldo insuficiente en ${selectedCuenta?.nombre}. Disponible: ${saldoDisp.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs`);
      return;
    }

    try {
      setLoading(true);
      await registrarCambioDivisa({
        cuenta_origen_id: cuentaId,
        monto_bs_base: bsBase,
        tasa_cambio_manual: tasa,
        comision_bancaria_bs: comision,
        referencia: referencia.trim() || `FX-${Date.now().toString().slice(-6)}`,
        notas: notas.trim() || undefined,
        usuario: 'Administrador'
      });

      alert(`Operación completada con éxito. Se acreditaron $${totalUsdComprado.toFixed(2)} USD en Efectivo Divisas.`);
      onSuccess();
      onOpenChange(false);
      setMontoBs('');
      setComisionBs('0.00');
      setReferencia('');
      setNotas('');
    } catch (err) {
      setErrorMsg(getErrorMessage(err) || 'Error al ejecutar cambio de divisa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-600 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <span>Compra de Divisas (Cobertura Cambiaria)</span>
          </DialogTitle>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Cuenta Origen en Bolívares (Debita)</label>
            <select
              value={cuentaId}
              onChange={(e) => setCuentaId(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {cuentasBs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} - Saldo: {parseFloat(String(c.saldo_actual)).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Monto Base en Bs a Convertir *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={montoBs}
                onChange={(e) => setMontoBs(e.target.value)}
                placeholder="0.00 Bs"
                className="font-mono font-bold text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tasa Pactada Manual (Bs/$) *</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={tasaManual}
                onChange={(e) => setTasaManual(e.target.value)}
                placeholder="807.39"
                className="font-mono font-bold text-sm text-blue-700"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Comisión / Gasto Bancario (Bs)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={comisionBs}
                onChange={(e) => setComisionBs(e.target.value)}
                placeholder="0.00"
                className="font-mono font-bold text-sm text-amber-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° Referencia de Pago</label>
              <Input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Ej. FX-98310"
                className="text-xs"
              />
            </div>
          </div>

          {/* Tarjeta de Conversión Contable */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Total a debitar en Bs:</span>
              <span className="font-mono font-bold text-slate-900">
                {totalDebitadoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Destino:</span>
              <span className="font-bold text-emerald-700">Bóveda Efectivo Divisas ($)</span>
            </div>
            <div className="pt-2 border-t border-blue-200/60 flex justify-between items-center">
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">Divisas a Acreditar:</span>
              <span className="text-xl font-black font-mono text-emerald-600">
                $${totalUsdComprado.toFixed(2)} USD
              </span>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || isSaldoInsuficiente || bsBase <= 0}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
            >
              {loading ? 'Procesando...' : 'Confirmar Cobertura Cambiaria'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
