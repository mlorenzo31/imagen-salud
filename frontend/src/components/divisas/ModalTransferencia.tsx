'use client';

import React, { useState } from 'react';
import { ArrowRightLeft, AlertCircle } from 'lucide-react';
import { useAvisos } from '@/components/ui/avisos';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFechaOperacion } from '@/components/FechaOperacion';
import { CuentaBancaria, registrarTransferencia } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

const bsFmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Transferencia entre cuentas en Bs (efectivo, pago móvil, punto). */
export function ModalTransferencia({ open, onOpenChange, cuentas, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; cuentas: CuentaBancaria[]; onSuccess: () => void;
}) {
  const { avisar } = useAvisos();
  const cuentasBs = cuentas.filter((c) => c.moneda === 'BS');
  const [origenId, setOrigenId] = useState<number>(cuentasBs[0]?.id ?? 0);
  const [destinoId, setDestinoId] = useState<number>(cuentasBs[1]?.id ?? 0);
  const [monto, setMonto] = useState('');
  const [comision, setComision] = useState('0.00');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fechaOp = useFechaOperacion();

  const origen = cuentasBs.find((c) => c.id === origenId);
  const destino = cuentasBs.find((c) => c.id === destinoId);
  const saldo = origen ? parseFloat(String(origen.saldo_actual)) : 0;
  const montoNum = parseFloat(monto) || 0;
  const comisionNum = parseFloat(comision) || 0;
  const mismaCuenta = origenId === destinoId;
  const insuficiente = montoNum + comisionNum > saldo;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mismaCuenta) return setError('El origen y el destino no pueden ser la misma cuenta.');
    if (montoNum <= 0) return setError('Indique el monto a transferir.');
    if (insuficiente) return setError(`Saldo insuficiente en ${origen?.nombre}. Disponible: ${bsFmt(saldo)} Bs`);
    setEnviando(true);
    try {
      const r = await registrarTransferencia({
        cuenta_origen_id: origenId, cuenta_destino_id: destinoId, monto: montoNum, comision: comisionNum,
        referencia: referencia.trim() || undefined, notas: notas.trim() || undefined, ...fechaOp.payload,
      });
      avisar({ tipo: 'exito', mensaje: r.mensaje ?? 'Transferencia registrada.' });
      onSuccess();
      onOpenChange(false);
      setMonto('');
      setComision('0.00');
      setReferencia('');
      setNotas('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setEnviando(false);
    }
  };

  const selector = (valor: number, cambiar: (id: number) => void) => (
    <select value={valor} onChange={(e) => cambiar(parseInt(e.target.value))}
      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
      {cuentasBs.map((c) => <option key={c.id} value={c.id}>{c.nombre} - Saldo: {bsFmt(parseFloat(String(c.saldo_actual)))} Bs</option>)}
    </select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />Transferir entre cuentas en Bs
          </DialogTitle>
        </DialogHeader>
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
          </div>
        )}
        <form onSubmit={enviar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Desde (debita)</label>{selector(origenId, setOrigenId)}</div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Hacia (acredita)</label>{selector(destinoId, setDestinoId)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Monto (Bs) *</label>
              <Input type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" className="font-mono font-bold text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Comisión bancaria (Bs)</label>
              <Input type="number" step="0.01" min="0" value={comision} onChange={(e) => setComision(e.target.value)} className="font-mono font-bold text-sm text-amber-900" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Referencia</label>
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" className="text-xs" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notas</label>
              <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. depósito del efectivo" className="text-xs" />
            </div>
          </div>
          {fechaOp.campo}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-600">Sale de {origen?.nombre}:</span><span className="font-mono font-bold">{bsFmt(montoNum + comisionNum)} Bs</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Entra a {destino?.nombre}:</span><span className="font-mono font-bold text-emerald-700">{bsFmt(montoNum)} Bs</span></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="text-xs font-bold">Cancelar</Button>
            <Button type="submit" disabled={enviando || mismaCuenta || montoNum <= 0 || insuficiente || fechaOp.incompleta} className="text-xs font-bold">
              {enviando ? 'Registrando…' : 'Confirmar transferencia'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
