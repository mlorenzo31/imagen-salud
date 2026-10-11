'use client';

import React from 'react';
import { CuentaBancaria } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Landmark, CreditCard, Smartphone, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TreasuryCardsProps {
  cuentas: CuentaBancaria[];
  loading?: boolean;
  onRefresh?: () => void;
}

export const TreasuryCards: React.FC<TreasuryCardsProps> = ({ cuentas, loading, onRefresh }) => {
  const getCardIcon = (codigo: string) => {
    switch (codigo) {
      case 'EFECTIVO_USD': return DollarSign;
      case 'EFECTIVO_BS': return Landmark;
      case 'PUNTO_VENTA_BS': return CreditCard;
      case 'PAGO_MOVIL_BS': return Smartphone;
      default: return Landmark;
    }
  };

  // Mismo color por medio de pago que en Caja: divisas verde, efectivo Bs azul, punto índigo, pago móvil cian.
  const getCardColors = (codigo: string) => {
    switch (codigo) {
      case 'EFECTIVO_USD':
        return { border: 'border-emerald-200', bg: 'bg-white', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', iconBg: 'bg-emerald-50 text-emerald-700' };
      case 'EFECTIVO_BS':
        return { border: 'border-blue-200', bg: 'bg-white', badge: 'bg-blue-50 text-blue-700 border-blue-200', iconBg: 'bg-blue-50 text-blue-700' };
      case 'PUNTO_VENTA_BS':
        return { border: 'border-indigo-200', bg: 'bg-white', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', iconBg: 'bg-indigo-50 text-indigo-700' };
      case 'PAGO_MOVIL_BS':
        return { border: 'border-cyan-200', bg: 'bg-white', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200', iconBg: 'bg-cyan-50 text-cyan-700' };
      default:
        return { border: 'border-slate-200', bg: 'bg-white', badge: 'bg-slate-100 text-slate-600 border-slate-200', iconBg: 'bg-slate-100 text-slate-600' };
    }
  };

  const formatSaldo = (saldo: string | number, moneda: 'BS' | 'USD') => {
    const val = typeof saldo === 'string' ? parseFloat(saldo) : saldo;
    const num = isNaN(val) ? 0 : val;
    if (moneda === 'USD') {
      return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Tesorería & Bóveda</h2>
          <p className="text-xs text-slate-500">Saldos operativos independientes en tiempo real</p>
        </div>
        {onRefresh && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh} 
            disabled={loading}
            className="text-xs font-bold border-slate-300 hover:bg-slate-100"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cuentas.map((cta) => {
          const Icon = getCardIcon(cta.codigo);
          const theme = getCardColors(cta.codigo);

          return (
            <Card key={cta.id} className={`border transition-all shadow-sm ${theme.border} ${theme.bg}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {cta.nombre}
                </CardTitle>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                  {formatSaldo(cta.saldo_actual, cta.moneda)}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${theme.badge}`}>
                    {cta.moneda === 'USD' ? 'Divisas Efectivo' : 'Moneda Nacional'}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Cuenta #{cta.id}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
