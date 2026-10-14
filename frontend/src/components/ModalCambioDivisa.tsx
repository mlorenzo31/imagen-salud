'use client';

import React, { useState } from 'react';
import { useAvisos } from '@/components/ui/avisos';
import { CuentaBancaria, registrarCambioDivisa, registrarVentaDivisa } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeftRight, AlertCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import { useFechaOperacion } from './FechaOperacion';

interface ModalCambioDivisaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentas: CuentaBancaria[];
  onSuccess: () => void;
}

type Operacion = 'COMPRA' | 'VENTA';
const bsFmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Compra o venta de divisas (P2P) a la tasa de mercado pactada, que se escribe en cada operación. */
export const ModalCambioDivisa: React.FC<ModalCambioDivisaProps> = ({ open, onOpenChange, cuentas, onSuccess }) => {
  const { avisar } = useAvisos();
  const cuentasBs = cuentas.filter(c => c.moneda === 'BS');
  const cuentaUsd = cuentas.find(c => c.moneda === 'USD');
  const [operacion, setOperacion] = useState<Operacion>('COMPRA');
  const [cuentaId, setCuentaId] = useState<number>(cuentasBs[0]?.id || 4);
  const [monto, setMonto] = useState<string>('');
  const [tasaManual, setTasaManual] = useState<string>('');
  const [comisionBs, setComisionBs] = useState<string>('0.00');
  const [referencia, setReferencia] = useState<string>('');
  const fechaOp = useFechaOperacion();
  const [notas, setNotas] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const esVenta = operacion === 'VENTA';
  const selectedCuenta = cuentas.find(c => c.id === cuentaId);
  const saldoBs = selectedCuenta ? parseFloat(String(selectedCuenta.saldo_actual)) : 0;
  const saldoUsd = cuentaUsd ? parseFloat(String(cuentaUsd.saldo_actual)) : 0;

  const montoNum = parseFloat(monto) || 0;
  const tasa = parseFloat(tasaManual) || 0;
  const comision = parseFloat(comisionBs) || 0;
  // Vista previa; el servidor calcula en centavos exactos.
  const totalDebitadoBs = montoNum + comision;
  const totalUsdComprado = tasa > 0 ? parseFloat((montoNum / tasa).toFixed(2)) : 0;
  const bsRecibidos = montoNum * tasa - comision;

  const saldoInsuficiente = esVenta ? montoNum > saldoUsd : totalDebitadoBs > saldoBs;

  const cambiarOperacion = (op: Operacion) => { setOperacion(op); setMonto(''); setErrorMsg(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (montoNum <= 0) return setErrorMsg(esVenta ? 'Indique cuántos dólares se venden.' : 'Ingrese un monto válido en Bolívares.');
    if (tasa <= 0) return setErrorMsg('Escriba la tasa de mercado pactada (Bs por $).');
    if (esVenta && bsRecibidos <= 0) return setErrorMsg('La comisión no puede ser igual o mayor que lo recibido por la venta.');
    if (saldoInsuficiente) {
      return setErrorMsg(esVenta
        ? `Saldo insuficiente en Efectivo Divisas. Disponible: $${saldoUsd.toFixed(2)}`
        : `Saldo insuficiente en ${selectedCuenta?.nombre}. Disponible: ${bsFmt(saldoBs)} Bs`);
    }

    try {
      setLoading(true);
      if (esVenta) {
        await registrarVentaDivisa({
          cuenta_destino_id: cuentaId, monto_usd: montoNum, tasa_cambio_manual: tasa, comision_bancaria_bs: comision,
          referencia: referencia.trim() || undefined, notas: notas.trim() || undefined, ...fechaOp.payload,
        });
        avisar({ tipo: 'exito', mensaje: `Venta registrada: salieron $${montoNum.toFixed(2)} de Efectivo Divisas y entraron ${bsFmt(bsRecibidos)} Bs en ${selectedCuenta?.nombre}.` });
      } else {
        await registrarCambioDivisa({
          cuenta_origen_id: cuentaId, monto_bs_base: montoNum, tasa_cambio_manual: tasa, comision_bancaria_bs: comision,
          referencia: referencia.trim() || `FX-${Date.now().toString().slice(-6)}`, notas: notas.trim() || undefined, usuario: 'Administrador',
          ...fechaOp.payload,
        });
        avisar({ tipo: 'exito', mensaje: `Compra registrada: se acreditaron $${totalUsdComprado.toFixed(2)} en Efectivo Divisas.` });
      }
      onSuccess();
      onOpenChange(false);
      setMonto('');
      setComisionBs('0.00');
      setReferencia('');
      setNotas('');
    } catch (err) {
      setErrorMsg(getErrorMessage(err) || 'Error al registrar la operación cambiaria.');
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
            <span>Operación cambiaria (P2P)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
          {(['COMPRA', 'VENTA'] as const).map(op => (
            <Button key={op} type="button" variant={operacion === op ? 'default' : 'ghost'} onClick={() => cambiarOperacion(op)} className="h-8 rounded-lg text-xs font-bold">
              {op === 'COMPRA' ? 'Comprar $' : 'Vender $'}
            </Button>
          ))}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {esVenta ? 'Cuenta en Bolívares donde entra el pago' : 'Cuenta Origen en Bolívares (Debita)'}
            </label>
            <select
              value={cuentaId}
              onChange={(e) => setCuentaId(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {cuentasBs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} - Saldo: {bsFmt(parseFloat(String(c.saldo_actual)))} Bs
                </option>
              ))}
            </select>
            {esVenta && <p className="mt-1 text-xs text-slate-500">Sale de Efectivo Divisas · disponible ${saldoUsd.toFixed(2)}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{esVenta ? 'Dólares a vender ($) *' : 'Monto Base en Bs a Convertir *'}</label>
              <Input type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)}
                placeholder={esVenta ? '0.00 $' : '0.00 Bs'} className="font-mono font-bold text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tasa de mercado pactada (Bs/$) *</label>
              <Input type="number" step="0.0001" min="0.0001" value={tasaManual} onChange={(e) => setTasaManual(e.target.value)}
                placeholder="Tasa P2P" className="font-mono font-bold text-sm text-blue-700" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Comisión / Gasto Bancario (Bs)</label>
              <Input type="number" step="0.01" min="0" value={comisionBs} onChange={(e) => setComisionBs(e.target.value)}
                placeholder="0.00" className="font-mono font-bold text-sm text-amber-900" />
            </div>
            <div>{fechaOp.campo}</div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° Referencia de Pago</label>
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej. FX-98310" className="text-xs" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notas</label>
              <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" className="text-xs" />
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-2">
            {esVenta ? (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Sale de Efectivo Divisas:</span>
                  <span className="font-mono font-bold text-slate-900">${montoNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Destino:</span>
                  <span className="font-bold text-emerald-700">{selectedCuenta?.nombre}</span>
                </div>
                <div className="pt-2 border-t border-blue-200/60 flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">Bs a recibir:</span>
                  <span className="text-xl font-black font-mono text-emerald-600">{bsFmt(Math.max(bsRecibidos, 0))} Bs</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Total a debitar en Bs:</span>
                  <span className="font-mono font-bold text-slate-900">{bsFmt(totalDebitadoBs)} Bs</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Destino:</span>
                  <span className="font-bold text-emerald-700">Bóveda Efectivo Divisas ($)</span>
                </div>
                <div className="pt-2 border-t border-blue-200/60 flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">Divisas a Acreditar:</span>
                  <span className="text-xl font-black font-mono text-emerald-600">${totalUsdComprado.toFixed(2)} USD</span>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="text-xs font-bold">Cancelar</Button>
            <Button
              type="submit"
              disabled={loading || saldoInsuficiente || montoNum <= 0 || fechaOp.incompleta}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
            >
              {loading ? 'Procesando...' : esVenta ? 'Confirmar venta' : 'Confirmar compra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
