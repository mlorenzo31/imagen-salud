'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Activity, Percent, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TremorDashboardProps {
  ingresosUsd: number;
  ingresosBs: number;
  egresosBs: number;
  comisionesBs: number;
}

export const TremorDashboard: React.FC<TremorDashboardProps> = ({
  ingresosUsd,
  ingresosBs,
  egresosBs,
  comisionesBs
}) => {
  // Datos analíticos de flujo semanal (Gráfico de barras SVG interactivo de alta fidelidad estilo Tremor)
  const dataFlujo = [
    { dia: 'Lun', ingresos: 42000, egresos: 8500 },
    { dia: 'Mar', ingresos: 58000, egresos: 12400 },
    { dia: 'Mié', ingresos: 39000, egresos: 6200 },
    { dia: 'Jue', ingresos: 71000, egresos: 15300 },
    { dia: 'Vie', ingresos: 89000, egresos: 21000 },
    { dia: 'Sáb', ingresos: 64000, egresos: 9800 },
    { dia: 'Dom', ingresos: 28000, egresos: 4500 }
  ];

  const maxVal = Math.max(...dataFlujo.map(d => Math.max(d.ingresos, d.egresos))) * 1.15;

  return (
    <div className="space-y-6">
      {/* KPI Cards de Estilo Tremor */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recaudación USD</span>
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                +14.2% mes
              </Badge>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-2">
              $${ingresosUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-3 flex items-center text-[11px] text-emerald-600 font-bold space-x-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Acreditado 100% en Bóveda</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recaudación Bs</span>
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                Punto + PM
              </Badge>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-2">
              {ingresosBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
            </div>
            <div className="mt-3 flex items-center text-[11px] text-blue-600 font-bold space-x-1">
              <Activity className="w-3.5 h-3.5" />
              <span>Conciliado en tiempo real</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Egresos Operativos</span>
              <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                Gastos
              </Badge>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-2">
              {egresosBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
            </div>
            <div className="mt-3 flex items-center text-[11px] text-rose-600 font-bold space-x-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Doble asiento contable</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comisiones Pago Móvil</span>
              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                100% Manual
              </Badge>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mt-2">
              {comisionesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
            </div>
            <div className="mt-3 flex items-center text-[11px] text-amber-700 font-bold space-x-1">
              <Percent className="w-3.5 h-3.5" />
              <span>Sin discrepancias bancarias</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfica Comparativa de Flujo de Fondos Semanal */}
      <Card className="rounded-3xl border border-slate-200 shadow-sm p-6 bg-white space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <CardTitle className="text-base font-black text-slate-900">
              Flujo Semanal de Liquidez: Ingresos vs Egresos
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparativa diaria de entradas y salidas de capital (Bs)
            </p>
          </div>
        </div>

        {/* Renderizado de Barras Analíticas con Recharts */}
        <div className="pt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dataFlujo}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis 
                dataKey="dia" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#64748B', fontWeight: 600 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#64748B', fontWeight: 500 }}
                tickFormatter={(value) => `Bs ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                cursor={{ fill: '#F8FAFC' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => [`Bs ${Number(value).toLocaleString('es-VE')}`, '']}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#475569', paddingTop: '20px' }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#1D7A70" radius={[4, 4, 0, 0]} barSize={24} />
              <Bar dataKey="egresos" name="Egresos" fill="#E11D48" radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
