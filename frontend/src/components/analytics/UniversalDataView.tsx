'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  BarChart3,
  LineChart,
  PieChart,
  Table2,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Maximize2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { DataViewMode, DataPoint } from '@/types';
import { descargarExcel } from '@/lib/excel';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { hoyLocal } from '@/lib/date';

export interface ColumnDef {
  key: string;
  header: string;
  format?: 'currency_usd' | 'currency_bs' | 'number' | 'percentage' | 'text';
  align?: 'left' | 'center' | 'right';
}

export interface UniversalDataViewProps {
  titulo: string;
  subtitulo?: string;
  data: DataPoint[];
  dataKey?: string;
  secondaryDataKey?: string;
  categoryKey?: string;
  nombreSeriePrincipal?: string;
  nombreSerieSecundaria?: string;
  columnasTabla?: ColumnDef[];
  totales?: {
    label: string;
    totalUSD?: number;
    totalBS?: number;
    secundarioUSD?: number;
  };
  tasaBcv?: number;
  initialViewMode?: DataViewMode;
  nombreArchivoExport?: string;
  alturaGrafico?: number;
}

const PALETA_COLORES = [
  '#80DDD2', // Aguamarina Corporativo
  '#FFAB6B', // Melocotón / Coral Suave
  '#9BCEDF', // Azul Cielo
  '#2EA89B', // Verde Azulado Oscuro
  '#C084FC', // Púrpura Pastel
  '#FBBF24', // Ámbar
  '#34D399', // Esmeralda
  '#F472B6'  // Rosa Suave
];

export const UniversalDataView: React.FC<UniversalDataViewProps> = ({
  titulo,
  subtitulo,
  data,
  dataKey = 'valorUSD',
  secondaryDataKey,
  categoryKey = 'label',
  nombreSeriePrincipal = 'Ingreso / Monto ($)',
  nombreSerieSecundaria = 'Honorarios / Costo ($)',
  columnasTabla,
  totales,
  tasaBcv = 0,
  initialViewMode = 'bar',
  nombreArchivoExport = 'reporte_clinico',
  alturaGrafico = 340
}) => {
  const [viewMode, setViewMode] = useState<DataViewMode>(initialViewMode);
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 8;
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Formateador de moneda
  const formatUSD = (val: number) => `$${Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatBS = (val: number) => `Bs. ${Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Columnas por defecto para la tabla si no se especifican
  const cols: ColumnDef[] = columnasTabla || [
    { key: categoryKey, header: 'Concepto / Rubro', align: 'left' },
    { key: dataKey, header: nombreSeriePrincipal, format: 'currency_usd', align: 'right' },
    ...(secondaryDataKey ? [{ key: secondaryDataKey, header: nombreSerieSecundaria, format: 'currency_usd' as const, align: 'right' as const }] : []),
    ...(tasaBcv > 0 ? [{ key: 'valorBS', header: 'Equivalente (Bs.)', format: 'currency_bs' as const, align: 'right' as const }] : [])
  ];

  // Filtrar datos para la tabla
  const datosFiltrados = data.filter(d => {
    if (!busquedaTabla.trim()) return true;
    const term = busquedaTabla.toLowerCase();
    return Object.values(d).some(val => String(val).toLowerCase().includes(term));
  });

  // Paginación
  const totalPaginas = Math.ceil(datosFiltrados.length / filasPorPagina) || 1;
  const datosPaginados = datosFiltrados.slice(
    (paginaActual - 1) * filasPorPagina,
    paginaActual * filasPorPagina
  );

  // Totales calculados
  const sumPrincipal = totales?.totalUSD ?? data.reduce((acc, curr) => acc + Number(curr[dataKey] || 0), 0);
  const sumSecundario = totales?.secundarioUSD ?? (secondaryDataKey ? data.reduce((acc, curr) => acc + Number(curr[secondaryDataKey] || 0), 0) : 0);
  const sumBS = totales?.totalBS ?? (tasaBcv > 0 ? sumPrincipal * tasaBcv : data.reduce((acc, curr) => acc + Number(curr.valorBS || 0), 0));

  // Exportar a Excel
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const rowsToExport = data.map((item, idx) => {
        const obj: Record<string, string | number | boolean | null | undefined> = { '#': idx + 1 };
        cols.forEach(c => {
          const val = item[c.key];
          obj[c.header] = typeof val === 'number' ? Number(val.toFixed(2)) : val;
        });
        return obj;
      });

      // Agregar fila de totales
      const filaTotal: Record<string, string | number | boolean | null | undefined> = { '#': 'TOTAL GENERAL' };
      cols.forEach(c => {
        if (c.key === dataKey) filaTotal[c.header] = Number(sumPrincipal.toFixed(2));
        else if (c.key === secondaryDataKey) filaTotal[c.header] = Number(sumSecundario.toFixed(2));
        else if (c.key === 'valorBS') filaTotal[c.header] = Number(sumBS.toFixed(2));
        else filaTotal[c.header] = '';
      });
      rowsToExport.push(filaTotal);

      const timestamp = hoyLocal();
      await descargarExcel(`${nombreArchivoExport}_${timestamp}.xlsx`, [
        { nombreHoja: 'Datos', data: rowsToExport, anchoMinimo: 16 },
      ]);
    } catch (err) {
      console.error('Error al exportar Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Exportar a PDF capturando vista activa
  const handleExportPDF = async () => {
    if (!containerRef.current) return;
    try {
      setIsExporting(true);
      let canvas: HTMLCanvasElement | null = null;
      try {
        canvas = await html2canvas(containerRef.current, {
          scale: 1.5,
          backgroundColor: '#FFFFFF',
          logging: false,
          useCORS: true,
          onclone: (clonedDoc) => {
            const elements = clonedDoc.getElementsByTagName('*');
            for (let i = 0; i < elements.length; i++) {
              const el = elements[i] as HTMLElement;
              if (el.style) {
                ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'].forEach(prop => {
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
        console.warn('Capture fallback:', err);
      }

      const imgData = canvas ? canvas.toDataURL('image/png') : null;
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'letter'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Encabezado institucional
      doc.setFillColor(46, 168, 155); // #2EA89B
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFillColor(128, 221, 210); // #80DDD2
      doc.rect(0, 40, pageWidth, 4, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('CENTRO CLÍNICO RADIOLÓGICO IMAGEN SALUD, C.A.', 28, 25);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generado: ${new Date().toLocaleString('es-VE')}`, pageWidth - 28, 25, { align: 'right' });

      // Título del reporte
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(titulo.toUpperCase(), 28, 68);

      if (subtitulo) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(subtitulo, 28, 84);
      }

      // Añadir la captura del gráfico o tabla ejecutiva con autoTable
      if (canvas && imgData) {
        const imgWidth = pageWidth - 56;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const finalHeight = Math.min(imgHeight, pageHeight - 140);
        doc.addImage(imgData, 'PNG', 28, 96, imgWidth, finalHeight);
      } else {
        autoTable(doc, {
          startY: subtitulo ? 95 : 80,
          head: [cols.map(c => c.header)],
          body: data.map(item => cols.map(c => {
            const val = item[c.key];
            return c.format === 'currency_usd' ? formatUSD(Number(val || 0)) : String(val ?? '-');
          })),
          theme: 'striped',
          headStyles: { fillColor: [46, 168, 155], textColor: [255, 255, 255], fontStyle: 'bold' }
        });
      }

      // Pie de página
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Documento Confidencial para Uso Administrativo y Contable Interno de Centro Clínico Imagen Salud.',
        pageWidth / 2,
        pageHeight - 18,
        { align: 'center' }
      );

      const timestamp = hoyLocal();
      doc.save(`${nombreArchivoExport}_${timestamp}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="border border-slate-200/90 shadow-sm bg-white overflow-hidden rounded-2xl">
      {/* Header con Título, Métricas y Controles de Vista */}
      <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#80DDD2] shadow-sm" />
              <CardTitle className="text-base font-black text-slate-800 tracking-tight">
                {titulo}
              </CardTitle>
            </div>
            {subtitulo && (
              <CardDescription className="text-xs text-slate-500 mt-0.5 ml-4.5">
                {subtitulo}
              </CardDescription>
            )}
          </div>

          {/* Badges de Totales Resumen */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total $</span>
              <span className="text-xs font-black text-[#1D7A70]">{formatUSD(sumPrincipal)}</span>
            </div>
            {sumBS > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-cyan-50/60 border border-cyan-200/60 flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-cyan-600">Total Bs.</span>
                <span className="text-xs font-black text-cyan-900">{formatBS(sumBS)}</span>
              </div>
            )}

            {/* Selector de Modos de Vista */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('bar')}
                title="Vista de Barras Comparativas"
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'bar'
                    ? 'bg-white text-[#1D7A70] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Barras</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('line')}
                title="Tendencia Temporal"
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'line'
                    ? 'bg-white text-[#1D7A70] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LineChart className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Líneas</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('donut')}
                title="Distribución Porcentual"
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'donut'
                    ? 'bg-white text-[#1D7A70] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Donut</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Matriz Numérica"
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-white text-[#1D7A70] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Tabla</span>
              </button>
            </div>

            {/* Acciones de Exportación */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="h-8 px-2.5 rounded-xl border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-xs font-semibold flex items-center gap-1 shadow-none"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="h-8 px-2.5 rounded-xl border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-xs font-semibold flex items-center gap-1 shadow-none"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Contenido Visual Reactivo */}
      <CardContent className="p-4 sm:p-5" ref={containerRef}>
        {data.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <TrendingUp className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
            <p className="text-xs font-medium">No hay datos registrados para el criterio seleccionado.</p>
          </div>
        ) : (
          <>
            {/* 1. VISTA DE BARRAS */}
            {viewMode === 'bar' && (
              <div style={{ width: '100%', height: alturaGrafico }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey={categoryKey}
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={val => `$${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#1E293B',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '11px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)'
                      }}
                      itemStyle={{ color: '#F8FAFC' }}
                      formatter={(value, name) => [formatUSD(Number(value)), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar
                      dataKey={dataKey}
                      name={nombreSeriePrincipal}
                      fill="#80DDD2"
                      radius={[6, 6, 0, 0]}
                    />
                    {secondaryDataKey && (
                      <Bar
                        dataKey={secondaryDataKey}
                        name={nombreSerieSecundaria}
                        fill="#FFAB6B"
                        radius={[6, 6, 0, 0]}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 2. VISTA DE LÍNEAS / ÁREA SUAVE */}
            {viewMode === 'line' && (
              <div style={{ width: '100%', height: alturaGrafico }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                    <defs>
                      <linearGradient id="colorPrincipalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#80DDD2" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#80DDD2" stopOpacity={0.0} />
                      </linearGradient>
                      {secondaryDataKey && (
                        <linearGradient id="colorSecundarioGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FFAB6B" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#FFAB6B" stopOpacity={0.0} />
                        </linearGradient>
                      )}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey={categoryKey}
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={val => `$${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#1E293B',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '11px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)'
                      }}
                      itemStyle={{ color: '#F8FAFC' }}
                      formatter={(value, name) => [formatUSD(Number(value)), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey={dataKey}
                      name={nombreSeriePrincipal}
                      stroke="#2EA89B"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorPrincipalGrad)"
                    />
                    {secondaryDataKey && (
                      <Area
                        type="monotone"
                        dataKey={secondaryDataKey}
                        name={nombreSerieSecundaria}
                        stroke="#FFAB6B"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorSecundarioGrad)"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 3. VISTA DE DONUT */}
            {viewMode === 'donut' && (
              <div style={{ width: '100%', height: alturaGrafico }} className="flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#1E293B',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '11px'
                      }}
                      formatter={(val) => [formatUSD(Number(val)), 'Total']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Pie
                      data={data}
                      dataKey={dataKey}
                      nameKey={categoryKey}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={3}
                    >
                      {data.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PALETA_COLORES[index % PALETA_COLORES.length]}
                          stroke="#FFFFFF"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 4. VISTA DE TABLA NUMÉRICA PAGINADA */}
            {viewMode === 'table' && (
              <div className="space-y-3">
                {/* Barra de búsqueda interna */}
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Filtrar concepto o valor..."
                      value={busquedaTabla}
                      onChange={e => {
                        setBusquedaTabla(e.target.value);
                        setPaginaActual(1);
                      }}
                      className="pl-8 h-8 text-xs rounded-xl bg-slate-50/70 border-slate-200"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    Mostrando {datosPaginados.length} de {datosFiltrados.length} registros
                  </div>
                </div>

                {/* Tabla de Datos */}
                <div className="overflow-x-auto rounded-xl border border-slate-200/90 shadow-none">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        {cols.map((col, idx) => (
                          <th
                            key={idx}
                            className={`py-2.5 px-3.5 ${
                              col.align === 'right'
                                ? 'text-right'
                                : col.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                            }`}
                          >
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {datosPaginados.map((fila, fIdx) => (
                        <tr key={fIdx} className="hover:bg-slate-50/70 transition-colors">
                          {cols.map((col, cIdx) => {
                            const val = fila[col.key];
                            return (
                              <td
                                key={cIdx}
                                className={`py-2.5 px-3.5 font-medium ${
                                  col.align === 'right'
                                    ? 'text-right font-mono'
                                    : col.align === 'center'
                                    ? 'text-center'
                                    : 'text-slate-800'
                                }`}
                              >
                                {col.format === 'currency_usd'
                                  ? formatUSD(Number(val || 0))
                                  : col.format === 'currency_bs'
                                  ? formatBS(Number(val || 0))
                                  : col.format === 'percentage'
                                  ? `${Number(val || 0).toFixed(1)}%`
                                  : col.format === 'number'
                                  ? Number(val || 0).toLocaleString('es-VE')
                                  : String(val ?? '-')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    {/* Fila de Totales al pie */}
                    <tfoot className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-200 text-xs">
                      <tr>
                        {cols.map((col, idx) => {
                          if (idx === 0) return <td key={idx} className="py-2.5 px-3.5 uppercase tracking-wide text-slate-700">TOTAL GENERAL</td>;
                          if (col.key === dataKey) return <td key={idx} className="py-2.5 px-3.5 text-right font-mono text-[#1D7A70]">{formatUSD(sumPrincipal)}</td>;
                          if (col.key === secondaryDataKey) return <td key={idx} className="py-2.5 px-3.5 text-right font-mono text-amber-700">{formatUSD(sumSecundario)}</td>;
                          if (col.key === 'valorBS') return <td key={idx} className="py-2.5 px-3.5 text-right font-mono text-cyan-800">{formatBS(sumBS)}</td>;
                          return <td key={idx} className="py-2.5 px-3.5 text-right font-mono text-slate-400">-</td>;
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Controles de Paginación */}
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Página {paginaActual} de {totalPaginas}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                        disabled={paginaActual === 1}
                        className="h-7 w-7 p-0 rounded-lg"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                        disabled={paginaActual === totalPaginas}
                        className="h-7 w-7 p-0 rounded-lg"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
