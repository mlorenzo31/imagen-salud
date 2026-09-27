'use client';

import React, { useState } from 'react';
import { CuentaBancaria, registrarEgresoOperativo } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, DollarSign } from 'lucide-react';

interface ModalEgresoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentas: CuentaBancaria[];
  onSuccess: () => void;
}

export const ModalEgreso: React.FC<ModalEgresoProps> = ({
  open,
  onOpenChange,
  cuentas,
  onSuccess
}) => {
  const [cuentaId, setCuentaId] = useState<number>(4); // Pago Móvil por defecto
  const [categoria, setCategoria] = useState<string>('Gastos Operativos');
  const [conceptoLibre, setConceptoLibre] = useState<string>('');
  const [montoNeto, setMontoNeto] = useState<string>('');
  const [comisionManual, setComisionManual] = useState<string>('');
  const [beneficiario, setBeneficiario] = useState<string>('');
  const [referencia, setReferencia] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedCuenta = cuentas.find(c => c.id === cuentaId);
  const isPagoMovil = selectedCuenta?.codigo === 'PAGO_MOVIL_BS' || cuentaId === 4;

  const netoNum = parseFloat(montoNeto) || 0;
  const comisionNum = isPagoMovil ? (parseFloat(comisionManual) || 0) : 0;
  const totalDebitado = parseFloat((netoNum + comisionNum).toFixed(2));
  const saldoDisp = selectedCuenta ? parseFloat(String(selectedCuenta.saldo_actual)) : 0;
  const isSaldoInsuficiente = totalDebitado > saldoDisp;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (netoNum <= 0) {
      setErrorMsg('El monto neto debe ser mayor a 0.');
      return;
    }

    if (isPagoMovil && comisionNum === 0) {
      const confirmaCero = confirm('Ha indicado 0.00 Bs de comisión bancaria para el Pago Móvil.\n¿El comprobante bancario no cobró comisión?');
      if (!confirmaCero) return;
    }

    if (isSaldoInsuficiente) {
      setErrorMsg(`Saldo insuficiente en la cuenta. Disponible: ${saldoDisp.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${selectedCuenta?.moneda}`);
      return;
    }

    try {
      setLoading(true);
      await registrarEgresoOperativo({
        cuenta_id: cuentaId,
        categoria,
        concepto_libre: conceptoLibre.trim() || undefined,
        monto_neto: netoNum,
        comision_bancaria: comisionNum,
        referencia: referencia.trim() || `EGR-${Date.now().toString().slice(-6)}`,
        proveedor_beneficiario: beneficiario.trim() || 'Beneficiario General',
        descripcion: descripcion.trim() || undefined,
        usuario: 'Administrador'
      });

      alert('Egreso operativo registrado exitosamente con doble asiento contable.');
      onSuccess();
      onOpenChange(false);
      // Reset form
      setMontoNeto('');
      setComisionManual('');
      setConceptoLibre('');
      setBeneficiario('');
      setReferencia('');
      setDescripcion('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el egreso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>Registrar Gasto / Egreso Operativo</span>
          </DialogTitle>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cuenta de Origen</label>
              <select
                value={cuentaId}
                onChange={(e) => setCuentaId(parseInt(e.target.value))}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {cuentas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda}) - Saldo: {parseFloat(String(c.saldo_actual)).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="Gastos Operativos">Gastos Operativos</option>
                <option value="Insumos Médicos">Insumos Médicos</option>
                <option value="Servicios Públicos">Servicios Públicos</option>
                <option value="Mantenimiento y Reparaciones">Mantenimiento y Reparaciones</option>
                <option value="Nómina y Personal">Nómina y Personal</option>
                <option value="Otros Gastos">Otros Gastos</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Concepto Libre (Opcional)</label>
            <Input
              value={conceptoLibre}
              onChange={(e) => setConceptoLibre(e.target.value)}
              placeholder="Ej. Compra de guantes de látex y gasas"
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Beneficiario / Proveedor</label>
              <Input
                value={beneficiario}
                onChange={(e) => setBeneficiario(e.target.value)}
                placeholder="Nombre del proveedor o persona"
                className="text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° Referencia Bancaria</label>
              <Input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Ej. 994821"
                className="text-xs"
              />
            </div>
          </div>

          {/* Importe Neto y Comisión Bancaria Manual */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Monto Neto a Pagar ({selectedCuenta?.moneda || 'BS'}) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoNeto}
                  onChange={(e) => setMontoNeto(e.target.value)}
                  placeholder="0.00"
                  className="font-mono font-bold text-slate-900 text-sm"
                  required
                />
              </div>

              {isPagoMovil && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-amber-900">
                      Comisión Manual (Bs) *
                    </label>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                      100% Manual
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={comisionManual}
                    onChange={(e) => setComisionManual(e.target.value)}
                    placeholder="0.00"
                    className="font-mono font-bold text-amber-950 text-sm border-amber-300 bg-amber-50/50"
                    required
                  />
                  <p className="text-[10px] text-amber-800 mt-1">
                    Monto exacto reflejado en el comprobante bancario.
                  </p>
                </div>
              )}
            </div>

            {/* Resumen Contable de Débito */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total a Debitar de la Cuenta</p>
                <p className="text-xs text-slate-400 font-mono">Neto + Comisión bancaria</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-black font-mono ${isSaldoInsuficiente ? 'text-rose-600' : 'text-slate-900'}`}>
                  {totalDebitado.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedCuenta?.moneda}
                </p>
                {isSaldoInsuficiente && (
                  <p className="text-[10px] text-rose-600 font-bold">¡Saldo insuficiente!</p>
                )}
              </div>
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
              disabled={loading || isSaldoInsuficiente || netoNum <= 0}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
            >
              {loading ? 'Procesando...' : 'Confirmar y Debitar Egreso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
