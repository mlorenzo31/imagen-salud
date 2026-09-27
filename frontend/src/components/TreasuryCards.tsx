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

  const getCardColors = (codigo: string) => {
    switch (codigo) {
      case 'EFECTIVO_USD':
        return {
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-950/20 hover:bg-emerald-950/30',
          badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          iconBg: 'bg-emerald-500/20 text-emerald-400'
        };
      case 'EFECTIVO_BS':
        return {
          border: 'border-blue-500/30',
          bg: 'bg-blue-950/20 hover:bg-blue-950/30',
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          iconBg: 'bg-blue-500/20 text-blue-400'
        };
      case 'PUNTO_VENTA_BS':
        return {
          border: 'border-indigo-500/30',
          bg: 'bg-indigo-950/20 hover:bg-indigo-950/30',
          badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          iconBg: 'bg-indigo-500/20 text-indigo-400'
        };
      case 'PAGO_MOVIL_BS':
        return {
          border: 'border-amber-500/30',
          bg: 'bg-amber-950/20 hover:bg-amber-950/30',
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          iconBg: 'bg-amber-500/20 text-amber-400'
        };
      default:
        return {
          border: 'border-slate-800',
          bg: 'bg-slate-900',
          badge: 'bg-slate-800 text-slate-300',
          iconBg: 'bg-slate-800 text-slate-400'
        };
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
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.badge}`}>
                    {cta.moneda === 'USD' ? 'Divisas Efectivo' : 'Moneda Nacional'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
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
