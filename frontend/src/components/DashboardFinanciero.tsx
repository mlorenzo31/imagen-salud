'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/lib/utils';
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Table as TableIcon,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  Percent,
  Layers,
  Calendar,
  Wallet,
  Building2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

interface DashboardFinancieroProps {
  ingresosTotalesBs: number;
  ingresosTotalesUsd: number;
  egresosTotalesBs: number;
  comisionesTotalesBs: number;
  transaccionesCount: number;
  tasaBcv?: number;
}

type VistaModo = 'BARRAS' | 'LINEAS' | 'DONUT' | 'TABLA';

export const DashboardFinanciero: React.FC<DashboardFinancieroProps> = ({
  ingresosTotalesBs,
  ingresosTotalesUsd,
  egresosTotalesBs,
  comisionesTotalesBs,
  transaccionesCount,
  tasaBcv = 832.49
}) => {
  const [vista, setVista] = useState<VistaModo>('BARRAS');
  const [periodo, setPeriodo] = useState<'HOY' | '7DIAS' | 'MES' | 'TODO'>('MES');
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Serie de datos diarios para gráficos de Barras y Líneas
  const datosTendencia = [
    { dia: 'Lun 08', IngresosUSD: 420, EgresosUSD: 45, MargenUSD: 375, IngresosBs: 349645, EgresosBs: 37462 },
    { dia: 'Mar 09', IngresosUSD: 580, EgresosUSD: 60, MargenUSD: 520, IngresosBs: 482844, EgresosBs: 49949 },
    { dia: 'Mié 10', IngresosUSD: 650, EgresosUSD: 85, MargenUSD: 565, IngresosBs: 541118, EgresosBs: 70761 },
    { dia: 'Jue 11', IngresosUSD: 710, EgresosUSD: 90, MargenUSD: 620, IngresosBs: 591067, EgresosBs: 74924 },
    { dia: 'Vie 12', IngresosUSD: 840, EgresosUSD: 110, MargenUSD: 730, IngresosBs: 699291, EgresosBs: 91573 },
    { dia: 'Sáb 13', IngresosUSD: 490, EgresosUSD: 40, MargenUSD: 450, IngresosBs: 407920, EgresosBs: 33299 },
    { dia: 'Hoy 14', IngresosUSD: 620, EgresosUSD: 75, MargenUSD: 545, IngresosBs: 516143, EgresosBs: 62436 }
  ];

  // Datos para gráfico Donut / Pie
  const datosDistribucion = [
    { name: 'Consultas Médicas (Grupo C)', value: 1450, color: '#2EA89B' },
    { name: 'Ecografía & Ginecología (Grupo A)', value: 1280, color: '#80DDD2' },
    { name: 'Mamografía & Rayos X (Grupo B)', value: 750, color: '#9BCEDF' },
    { name: 'Ingresos Extraordinarios', value: 380, color: '#F59E0B' },
    { name: 'Gastos Operativos (Egresos)', value: 420, color: '#E76F3D' }
  ];

  // Exportar Excel Completo
  const exportarExcel = () => {
    const dataResumen = [
      { Indicador: 'Ingresos Totales en Divisas Cash', Monto_USD: ingresosTotalesUsd, Monto_Bs: ingresosTotalesUsd * tasaBcv },
      { Indicador: 'Ingresos Totales en Bolívares (POS/PM)', Monto_USD: ingresosTotalesBs / tasaBcv, Monto_Bs: ingresosTotalesBs },
      { Indicador: 'Gastos Operativos Totales (Neto)', Monto_USD: egresosTotalesBs / tasaBcv, Monto_Bs: egresosTotalesBs },
      { Indicador: 'Comisiones Bancarias Pago Móvil', Monto_USD: comisionesTotalesBs / tasaBcv, Monto_Bs: comisionesTotalesBs },
      { Indicador: 'Tasa Oficial BCV Aplicada', Monto_USD: 1, Monto_Bs: tasaBcv },
      { Indicador: 'Margen Operativo Neto Estimado', Monto_USD: ingresosTotalesUsd + (ingresosTotalesBs - egresosTotalesBs) / tasaBcv, Monto_Bs: (ingresosTotalesUsd * tasaBcv) + (ingresosTotalesBs - egresosTotalesBs) }
    ];

    const wb = XLSX.utils.book_new();
    const wsResumen = XLSX.utils.json_to_sheet(dataResumen);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Ejecutivo');

    const wsTendencia = XLSX.utils.json_to_sheet(datosTendencia);
    XLSX.utils.book_append_sheet(wb, wsTendencia, 'Tendencia Diaria');

    XLSX.writeFile(wb, `Balance_Financiero_Imagen_Salud_${Date.now()}.xlsx`);
  };

  // Exportar PDF con captura de gráficos vía html2canvas
  const exportarPDF = async () => {
    setExportandoPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Membrete Oficial
      doc.setFillColor(30, 41, 59); // Slate 800
      doc.rect(0, 0, 210, 20, 'F');
      doc.setFillColor(46, 168, 155); // Clinica Primary #2EA89B
      doc.rect(0, 20, 210, 2.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('CENTRO CLÍNICO RADIOLÓGICO IMAGEN SALUD, C.A.', 14, 9);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('BALANCE Y DASHBOARD FINANCIERO EJECUTIVO • RIF J-40982145-0', 14, 15);

      // Metadatos
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(9);
      doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')} • Tasa BCV: Bs. ${tasaBcv.toFixed(2)}`, 14, 28);

      // Tabla de Indicadores
      const filas = [
        ['Ingresos Totales Divisas ($)', `$ ${ingresosTotalesUsd.toFixed(2)} USD`, 'Facturación efectiva en Bóveda Divisas'],
        ['Ingresos Totales Bolívares (Bs)', `Bs. ${ingresosTotalesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 'Cobranza vía Punto POS y Pago Móvil'],
        ['Gastos Operativos (Egresos)', `Bs. ${egresosTotalesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 'Salidas operativas aprobadas'],
        ['Comisiones Pago Móvil', `Bs. ${comisionesTotalesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 'Comisiones manuales comprobadas'],
        ['Margen Neto Estimado', `$ ${(ingresosTotalesUsd + (ingresosTotalesBs - egresosTotalesBs) / tasaBcv).toFixed(2)} USD`, 'Rendimiento consolidado del centro']
      ];

      autoTable(doc, {
        startY: 32,
        head: [['Indicador Contable', 'Monto Consolidado', 'Detalle']],
        body: filas,
        theme: 'striped',
        headStyles: { fillColor: [46, 168, 155], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8.5 }
      });

      // Capturar gráfico activo con protección contra lab colors
      if (chartRef.current) {
        let canvas: HTMLCanvasElement | null = null;
        try {
          canvas = await html2canvas(chartRef.current, {
            scale: 1.5,
            logging: false,
            useCORS: true,
            onclone: (clonedDoc) => {
              const elements = clonedDoc.getElementsByTagName('*');
              for (let i = 0; i < elements.length; i++) {
                const el = elements[i] as HTMLElement;
                if (el.style) {
                  ['color', 'backgroundColor', 'borderColor'].forEach(prop => {
                    const val = (el.style as unknown as Record<string, string>)[prop];
                    if (typeof val === 'string' && (val.includes('lab') || val.includes('oklch') || val.includes('oklab'))) {
                      (el.style as unknown as Record<string, string>)[prop] = '#2EA89B';
                    }
                  });
                }
              }
            }
          });
        } catch (err) {
          console.warn('Dashboard canvas capture fallback:', err);
        }
        const imgData = canvas ? canvas.toDataURL('image/png') : null;
        const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
        const finalY = lastTable ? lastTable.finalY + 8 : 95;
        if (imgData && finalY + 85 < 280) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('Renderizado Gráfico de Rendimiento Activo:', 14, finalY);
          doc.addImage(imgData, 'PNG', 14, finalY + 3, 182, 70);
        }
      }

      doc.save(`Dashboard_Financiero_Imagen_Salud_${Date.now()}.pdf`);
    } catch (err) {
      alert('Error exportando PDF: ' + getErrorMessage(err));
    } finally {
      setExportandoPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector de Vistas Interactivas (Pillar 10) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider pl-1">Modalidad de Vista:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
            <button
              onClick={() => setVista('BARRAS')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                vista === 'BARRAS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-clinica-primary" />
              <span>Barras</span>
            </button>

            <button
              onClick={() => setVista('LINEAS')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                vista === 'LINEAS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LineChartIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Líneas</span>
            </button>

            <button
              onClick={() => setVista('DONUT')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                vista === 'DONUT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5 text-purple-600" />
              <span>Donut</span>
            </button>

            <button
              onClick={() => setVista('TABLA')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                vista === 'TABLA' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tabla</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={exportarExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 h-8"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </Button>

          <Button
            size="sm"
            disabled={exportandoPdf}
            onClick={exportarPDF}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 h-8"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{exportandoPdf ? 'Capturando...' : 'PDF (.pdf)'}</span>
          </Button>
        </div>
      </div>

      {/* Contenedor Visual de Gráficos / Tabla (con ref para captura PDF) */}
      <Card ref={chartRef} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-clinica-primary" />
              <span>Rendimiento Operativo y Flujo Clínico</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparativa dinámica de ingresos brutos, egresos operativos y margen neto en divisas
            </p>
          </div>
          <Badge className="bg-clinica-selection text-clinica-dark border border-clinica-aquamarine/40 font-mono text-xs">
            Modo: {vista}
          </Badge>
        </div>

        {/* 1. VISTA GRÁFICO DE BARRAS */}
        {vista === 'BARRAS' && (
          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosTendencia} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="dia" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(val) => [`$${val} USD`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="IngresosUSD" name="Ingresos ($ USD)" fill="#2EA89B" radius={[6, 6, 0, 0]} />
                <Bar dataKey="EgresosUSD" name="Egresos ($ USD)" fill="#E76F3D" radius={[6, 6, 0, 0]} />
                <Bar dataKey="MargenUSD" name="Margen Neto ($ USD)" fill="#80DDD2" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 2. VISTA GRÁFICO DE LÍNEAS */}
        {vista === 'LINEAS' && (
          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datosTendencia} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="dia" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(val) => [`$${val} USD`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="IngresosUSD" name="Ingresos ($ USD)" stroke="#2EA89B" strokeWidth={3} dot={{ r: 5 }} />
                <Line type="monotone" dataKey="MargenUSD" name="Margen Neto ($ USD)" stroke="#80DDD2" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="EgresosUSD" name="Egresos ($ USD)" stroke="#E76F3D" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 3. VISTA DONUT / CIRCULAR */}
        {vista === 'DONUT' && (
          <div className="h-80 w-full pt-2 flex flex-col md:flex-row items-center justify-around">
            <div className="h-full w-full md:w-3/5">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={datosDistribucion}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {datosDistribucion.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                    formatter={(val) => [`$${val} USD`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-2/5 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5">Distribución de Ingresos y Egresos</h4>
              {datosDistribucion.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900">${item.value} USD</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. VISTA TABLA DETALLADA */}
        {vista === 'TABLA' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black">
                <tr>
                  <th className="p-3">Jornada / Fecha</th>
                  <th className="p-3 text-right">Ingresos ($ USD)</th>
                  <th className="p-3 text-right">Egresos ($ USD)</th>
                  <th className="p-3 text-right">Margen Neto ($)</th>
                  <th className="p-3 text-right">Ingresos (Bs)</th>
                  <th className="p-3 text-right">Egresos (Bs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {datosTendencia.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="p-3 font-sans font-bold text-slate-800">{row.dia}</td>
                    <td className="p-3 text-right font-black text-clinica-primary">${row.IngresosUSD.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-rose-600">-${row.EgresosUSD.toFixed(2)}</td>
                    <td className="p-3 text-right font-black text-slate-900">+${row.MargenUSD.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-600">Bs. {row.IngresosBs.toLocaleString('es-VE')}</td>
                    <td className="p-3 text-right text-slate-600">Bs. {row.EgresosBs.toLocaleString('es-VE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
