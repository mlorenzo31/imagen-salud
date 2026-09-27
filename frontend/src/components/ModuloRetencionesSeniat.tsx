'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Search,
  Plus,
  RefreshCw,
  Printer,
  ShieldCheck,
  AlertCircle,
  Building2,
  Percent,
  CheckCircle2
} from 'lucide-react';
import { exportarAExcel, exportarAPDF } from '@/lib/exportUtils';
import { RetencionSENIAT, UserRole, ModoOperacion } from '@/types';

interface ModuloRetencionesSeniatProps {
  currentRole: UserRole;
  modoOperacion: ModoOperacion;
  tasaBcv?: number;
}

export const ModuloRetencionesSeniat: React.FC<ModuloRetencionesSeniatProps> = ({
  currentRole,
  modoOperacion,
  tasaBcv = 832.49
}) => {
  const [retenciones, setRetenciones] = useState<RetencionSENIAT[]>([
    {
      id: 1,
      nro_comprobante: '20260900000001',
      periodo_fiscal: '2026-09',
      fecha_emision: '2026-09-12',
      paciente_cliente: 'Seguros Mercantil, C.A.',
      cedula_rif: 'J-00012345-6',
      factura_asociada_id: 'FAC-001045',
      base_imponible_usd: 120.00,
      base_imponible_bs: 99898.80,
      tasa_bcv: 832.49,
      iva_total_bs: 15983.81,
      porcentaje_iva_retenido: 75,
      monto_iva_retenido_bs: 11987.86,
      porcentaje_islr_retenido: 2,
      monto_islr_retenido_bs: 1997.98,
      total_retenido_bs: 13985.84,
      total_retenido_usd: 16.80,
      estado: 'APLICADA',
      usuario: 'Asistente Administrativo',
      observaciones: 'Retención corporativa convenio mercantil 75% IVA + 2% ISLR'
    },
    {
      id: 2,
      nro_comprobante: '20260900000002',
      periodo_fiscal: '2026-09',
      fecha_emision: '2026-09-13',
      paciente_cliente: 'Banesco Banco Universal',
      cedula_rif: 'J-07013380-5',
      factura_asociada_id: 'FAC-001089',
      base_imponible_usd: 250.00,
      base_imponible_bs: 208122.50,
      tasa_bcv: 832.49,
      iva_total_bs: 33299.60,
      porcentaje_iva_retenido: 100,
      monto_iva_retenido_bs: 33299.60,
      porcentaje_islr_retenido: 3,
      monto_islr_retenido_bs: 6243.68,
      total_retenido_bs: 39543.28,
      total_retenido_usd: 47.50,
      estado: 'APLICADA',
      usuario: 'Director Médico (Admin)',
      observaciones: 'Contribuyente especial 100% IVA retenido'
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comprobanteActivoImprimir, setComprobanteActivoImprimir] = useState<RetencionSENIAT | null>(null);

  // Form State
  const fechaHoy = new Date().toISOString().slice(0, 10);
  const periodoActual = fechaHoy.slice(0, 7);

  const [formCliente, setFormCliente] = useState('');
  const [formRif, setFormRif] = useState('');
  const [formFactura, setFormFactura] = useState('');
  const [formBaseUsd, setFormBaseUsd] = useState('');
  const [formPctIva, setFormPctIva] = useState<75 | 100>(75);
  const [formPctIslr, setFormPctIslr] = useState<number>(2);
  const [formObs, setFormObs] = useState('');

  // Cálculos en vivo
  const baseUsdNum = parseFloat(formBaseUsd) || 0;
  const baseBsNum = baseUsdNum * tasaBcv;
  const ivaTotalBs = baseBsNum * 0.16;
  const montoIvaRetenidoBs = ivaTotalBs * (formPctIva / 100);
  const montoIslrRetenidoBs = baseBsNum * (formPctIslr / 100);
  const totalRetenidoBs = montoIvaRetenidoBs + montoIslrRetenidoBs;
  const totalRetenidoUsd = tasaBcv > 0 ? totalRetenidoBs / tasaBcv : 0;

  const isReadOnly = modoOperacion === 'vista';

  // Registrar Retención
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      alert('Operación no permitida en Modo Vista (Read-Only).');
      return;
    }
    if (!formCliente.trim() || !formRif.trim()) {
      alert('Por favor ingrese el nombre y RIF/Cédula del cliente o agente de retención.');
      return;
    }
    if (baseUsdNum <= 0) {
      alert('Ingrese una base imponible válida.');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      const nuevoNumero = `${periodoActual.replace('-', '')}${String(retenciones.length + 1).padStart(8, '0')}`;
      const nueva: RetencionSENIAT = {
        id: Date.now(),
        nro_comprobante: nuevoNumero,
        periodo_fiscal: periodoActual,
        fecha_emision: fechaHoy,
        paciente_cliente: formCliente.trim(),
        cedula_rif: formRif.trim().toUpperCase(),
        factura_asociada_id: formFactura.trim() || `FAC-${String(Date.now()).slice(-6)}`,
        base_imponible_usd: baseUsdNum,
        base_imponible_bs: baseBsNum,
        tasa_bcv: tasaBcv,
        iva_total_bs: ivaTotalBs,
        porcentaje_iva_retenido: formPctIva,
        monto_iva_retenido_bs: montoIvaRetenidoBs,
        porcentaje_islr_retenido: formPctIslr,
        monto_islr_retenido_bs: montoIslrRetenidoBs,
        total_retenido_bs: totalRetenidoBs,
        total_retenido_usd: totalRetenidoUsd,
        estado: 'APLICADA',
        usuario: currentRole === 'admin' ? 'Director Médico' : 'Asistente Administrativo',
        observaciones: formObs.trim()
      };

      setRetenciones(prev => [nueva, ...prev]);
      setOpenModal(false);
      setFormCliente('');
      setFormRif('');
      setFormFactura('');
      setFormBaseUsd('');
      setFormObs('');
      setSubmitting(false);
      alert(`✓ Comprobante SENIAT N° ${nuevoNumero} emitido y aplicado a la cuenta.`);
    }, 400);
  };

  // Filtrado
  const retencionesFiltradas = useMemo(() => {
    if (!searchQuery.trim()) return retenciones;
    const q = searchQuery.toLowerCase();
    return retenciones.filter(r =>
      r.nro_comprobante.toLowerCase().includes(q) ||
      r.paciente_cliente.toLowerCase().includes(q) ||
      r.cedula_rif.toLowerCase().includes(q) ||
      (r.factura_asociada_id && String(r.factura_asociada_id).toLowerCase().includes(q))
    );
  }, [retenciones, searchQuery]);

  // Totales
  const totalRetenidoBsAcumulado = retencionesFiltradas.reduce((acc, r) => acc + r.total_retenido_bs, 0);
  const totalRetenidoUsdAcumulado = retencionesFiltradas.reduce((acc, r) => acc + r.total_retenido_usd, 0);

  // Exportar Excel
  const handleExportExcel = () => {
    if (retencionesFiltradas.length === 0) return alert('No hay comprobantes para exportar.');
    const data = retencionesFiltradas.map(r => ({
      'N° Comprobante SENIAT': r.nro_comprobante,
      'Período Fiscal': r.periodo_fiscal,
      'Fecha Emisión': r.fecha_emision,
      'Cliente / Agente': r.paciente_cliente,
      'RIF / Cédula': r.cedula_rif,
      'Factura Asociada': r.factura_asociada_id || 'S/F',
      'Base Imponible (Bs)': r.base_imponible_bs,
      'IVA Total (Bs)': r.iva_total_bs,
      '% IVA Retenido': `${r.porcentaje_iva_retenido}%`,
      'IVA Retenido (Bs)': r.monto_iva_retenido_bs,
      '% ISLR Retenido': `${r.porcentaje_islr_retenido}%`,
      'ISLR Retenido (Bs)': r.monto_islr_retenido_bs,
      'Total Retenido (Bs)': r.total_retenido_bs,
      'Total Retenido (USD)': r.total_retenido_usd,
      'Estado': r.estado,
      'Usuario': r.usuario
    }));

    exportarAExcel('Comprobantes_Retencion_SENIAT', [
      { nombreHoja: 'Retenciones SENIAT', data }
    ]);
  };

  // Exportar PDF
  const handleExportPDF = () => {
    if (retencionesFiltradas.length === 0) return alert('No hay comprobantes para exportar.');
    const filas = retencionesFiltradas.map(r => [
      r.nro_comprobante,
      r.fecha_emision,
      r.cedula_rif,
      r.paciente_cliente.slice(0, 20),
      `Bs. ${r.base_imponible_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
      `${r.porcentaje_iva_retenido}%`,
      `Bs. ${r.total_retenido_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
      `$ ${r.total_retenido_usd.toFixed(2)}`
    ]);

    exportarAPDF({
      titulo: 'LIBRO DE COMPROBANTES DE RETENCIÓN FISCAL SENIAT',
      subtitulo: 'Centro Clínico Radiológico Imagen Salud, C.A. — IVA e ISLR en Ventas',
      nombreArchivo: 'Retenciones_Fiscales_SENIAT',
      kpis: [
        { label: 'Total Comprobantes', valor: `${retencionesFiltradas.length}` },
        { label: 'Total Retenido Bs', valor: `Bs. ${totalRetenidoBsAcumulado.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` },
        { label: 'Equiv. Retenido USD', valor: `$ ${totalRetenidoUsdAcumulado.toFixed(2)}` }
      ],
      columnas: ['Comprobante', 'Fecha', 'RIF / C.I.', 'Cliente / Agente', 'Base (Bs)', '% IVA', 'Retenido (Bs)', 'Retenido ($)'],
      filas
    });
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Corporativo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-clinica-selection rounded-xl text-clinica-primary">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">Retenciones SENIAT (IVA e ISLR)</h2>
              <Badge className="bg-clinica-primary text-white text-[10px] font-mono">
                Providencia SNAT
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestión de comprobantes fiscales de 14 dígitos, retención del 75%/100% de IVA y deducción en cuentas por cobrar
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 h-9"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportPDF}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 h-9"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF (.pdf)</span>
          </Button>

          {!isReadOnly && (currentRole === 'admin' || currentRole === 'asistente') && (
            <Button
              onClick={() => setOpenModal(true)}
              className="bg-clinica-primary hover:bg-clinica-primary-dark text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 h-9"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Comprobante</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Retenido (Bs)</p>
          <h3 className="text-2xl font-black text-clinica-primary mt-1">
            Bs. {totalRetenidoBsAcumulado.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Deducido de cobranza fiscal</p>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Equivalente Divisas ($)</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">
            $ {totalRetenidoUsdAcumulado.toFixed(2)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Tasa oficial BCV Bs. {tasaBcv.toFixed(2)}</p>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Comprobantes Emitidos</p>
          <h3 className="text-2xl font-black text-cyan-700 mt-1">
            {retencionesFiltradas.length}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Período {periodoActual}</p>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estado de Validación</p>
          <div className="flex items-center gap-1.5 mt-1">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700">100% Conciliado</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sin descuadres fiscales</p>
        </Card>
      </div>

      {/* Buscador */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por N° comprobante de 14 dígitos, RIF, cliente o factura asociada..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs rounded-xl bg-slate-50 border-slate-200 h-10 w-full"
          />
        </div>
      </Card>

      {/* Tabla de Comprobantes SENIAT */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-3">Comprobante (14 Dígitos)</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Cliente / RIF</th>
                <th className="p-3">Factura</th>
                <th className="p-3 text-right">Base Imponible</th>
                <th className="p-3 text-center">% IVA / ISLR</th>
                <th className="p-3 text-right">Total Retenido</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {retencionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No se encontraron comprobantes de retención para la búsqueda.
                  </td>
                </tr>
              ) : (
                retencionesFiltradas.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px]">
                        {r.nro_comprobante}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{r.fecha_emision}</td>
                    <td className="p-3">
                      <p className="font-bold text-slate-900">{r.paciente_cliente}</p>
                      <p className="text-[11px] font-mono text-slate-500">{r.cedula_rif}</p>
                    </td>
                    <td className="p-3 font-mono text-slate-700">{r.factura_asociada_id || 'S/F'}</td>
                    <td className="p-3 text-right font-mono font-medium text-slate-700">
                      Bs. {r.base_imponible_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      <div className="text-[10px] text-slate-400">${r.base_imponible_usd.toFixed(2)}</div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge className="bg-clinica-selection text-clinica-dark text-[10px] font-bold mr-1">
                        IVA {r.porcentaje_iva_retenido}%
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-slate-600">
                        ISLR {r.porcentaje_islr_retenido}%
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-mono font-black text-clinica-primary text-sm">
                      Bs. {r.total_retenido_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      <div className="text-[10px] text-slate-500 font-normal">≈ ${r.total_retenido_usd.toFixed(2)} USD</div>
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setComprobanteActivoImprimir(r)}
                        className="rounded-xl text-[11px] h-8 px-2.5 font-bold flex items-center gap-1 mx-auto"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span>Ver Formato</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Nuevo Comprobante */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-xl rounded-3xl p-6 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <div className="p-2 bg-clinica-selection rounded-xl text-clinica-primary">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <span>Registrar Retención SENIAT</span>
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Emisión de comprobante oficial de retención y deducción directa de cuenta por cobrar
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cliente / Agente de Retención</label>
                <Input
                  placeholder="Ej. Seguros Caracas, C.A."
                  value={formCliente}
                  onChange={(e) => setFormCliente(e.target.value)}
                  required
                  className="text-xs rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">RIF / Cédula Fiscal</label>
                <Input
                  placeholder="Ej. J-12345678-9"
                  value={formRif}
                  onChange={(e) => setFormRif(e.target.value)}
                  required
                  className="text-xs rounded-xl h-10 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Factura o Procedimiento Asociado</label>
                <Input
                  placeholder="Ej. FAC-001099"
                  value={formFactura}
                  onChange={(e) => setFormFactura(e.target.value)}
                  className="text-xs rounded-xl h-10 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Base Imponible ($ USD)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formBaseUsd}
                  onChange={(e) => setFormBaseUsd(e.target.value)}
                  required
                  className="text-xs rounded-xl h-10 font-mono font-bold"
                />
              </div>
            </div>

            {/* Configuración de Porcentajes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">% Retención de IVA</label>
                <select
                  value={formPctIva}
                  onChange={(e) => setFormPctIva(Number(e.target.value) as any)}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value={75}>75% (Contribuyente General)</option>
                  <option value={100}>100% (Contribuyente Especial / Casos Ley)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">% Retención de ISLR</label>
                <select
                  value={formPctIslr}
                  onChange={(e) => setFormPctIslr(Number(e.target.value))}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value={1}>1% (Bienes y Servicios)</option>
                  <option value={2}>2% (Servicios Comerciales)</option>
                  <option value={3}>3% (Honorarios Profesionales Persona Jurídica)</option>
                  <option value={5}>5% (Honorarios Profesionales Persona Natural)</option>
                  <option value={0}>0% (Exento)</option>
                </select>
              </div>
            </div>

            {/* Resumen de Cálculo en Vivo */}
            {baseUsdNum > 0 && (
              <div className="p-3 bg-clinica-selection rounded-xl border border-clinica-aquamarine/40 space-y-1 text-xs">
                <div className="flex justify-between font-medium text-slate-700">
                  <span>Base Imponible en Bolívares:</span>
                  <span className="font-mono font-bold">Bs. {baseBsNum.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-700">
                  <span>Monto IVA Retenido ({formPctIva}%):</span>
                  <span className="font-mono font-bold text-clinica-primary">Bs. {montoIvaRetenidoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-700">
                  <span>Monto ISLR Retenido ({formPctIslr}%):</span>
                  <span className="font-mono font-bold text-cyan-700">Bs. {montoIslrRetenidoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-clinica-aquamarine/30 text-sm">
                  <span>Total a Deducir de la Cobranza:</span>
                  <span className="font-mono text-clinica-primary">Bs. {totalRetenidoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (≈ ${totalRetenidoUsd.toFixed(2)})</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Observaciones del Comprobante</label>
              <Input
                placeholder="Detalle o notas de retención (opcional)"
                value={formObs}
                onChange={(e) => setFormObs(e.target.value)}
                className="text-xs rounded-xl h-10"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenModal(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-clinica-primary hover:bg-clinica-primary-dark text-white text-xs font-bold rounded-xl shadow-md"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Emitir y Aplicar Deducción</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Visualizador Comprobante Formato SENIAT */}
      {comprobanteActivoImprimir && (
        <Dialog open={!!comprobanteActivoImprimir} onOpenChange={() => setComprobanteActivoImprimir(null)}>
          <DialogContent className="sm:max-w-2xl rounded-3xl p-6 bg-white shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900 flex items-center justify-between">
                <span>Comprobante Oficial de Retención de Impuestos</span>
                <Badge className="bg-slate-900 text-white font-mono text-[10px]">
                  N° {comprobanteActivoImprimir.nro_comprobante}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3 font-sans">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-black text-slate-900">CENTRO CLÍNICO RADIOLÓGICO IMAGEN SALUD, C.A.</h4>
                  <p className="text-slate-500 font-mono">RIF: J-40982145-0 • NIT: 01458921</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-700">Fecha: {comprobanteActivoImprimir.fecha_emision}</p>
                  <p className="text-slate-500 font-mono">Período: {comprobanteActivoImprimir.periodo_fiscal}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>
                  <span className="font-bold">Agente de Retención / Sujeto Pasivo:</span>
                  <p className="font-semibold text-slate-900">{comprobanteActivoImprimir.paciente_cliente}</p>
                </div>
                <div>
                  <span className="font-bold">RIF / C.I.:</span>
                  <p className="font-mono font-bold text-slate-900">{comprobanteActivoImprimir.cedula_rif}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-2">Concepto</th>
                      <th className="p-2 text-right">Base Imponible</th>
                      <th className="p-2 text-center">Alicuota</th>
                      <th className="p-2 text-right">Monto Retenido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    <tr>
                      <td className="p-2">Retención de Impuesto al Valor Agregado (IVA)</td>
                      <td className="p-2 text-right">Bs. {comprobanteActivoImprimir.base_imponible_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-center font-sans font-bold">{comprobanteActivoImprimir.porcentaje_iva_retenido}%</td>
                      <td className="p-2 text-right font-bold text-clinica-primary">Bs. {comprobanteActivoImprimir.monto_iva_retenido_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Retención de I.S.L.R. Servicios Profesionales</td>
                      <td className="p-2 text-right">Bs. {comprobanteActivoImprimir.base_imponible_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-center font-sans font-bold">{comprobanteActivoImprimir.porcentaje_islr_retenido}%</td>
                      <td className="p-2 text-right font-bold text-cyan-700">Bs. {comprobanteActivoImprimir.monto_islr_retenido_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold">
                    <tr>
                      <td colSpan={3} className="p-2 text-right font-sans">TOTAL IMPUESTO RETENIDO:</td>
                      <td className="p-2 text-right font-mono font-black text-slate-900">
                        Bs. {comprobanteActivoImprimir.total_retenido_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                <span>Comprobante emitido de acuerdo a la Providencia Administrativa SENIAT vigente.</span>
                <span>Firma y Sello Autorizado</span>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setComprobanteActivoImprimir(null)}
                className="rounded-xl text-xs"
              >
                Cerrar
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Comprobante</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
