'use client';

import React from 'react';
import { CircleDollarSign, Menu } from 'lucide-react';
import type { UserRole } from '@/types';
import { WhatsAppEstado } from '@/components/WhatsAppEstado';

const TITULOS: Record<string, { titulo: string; detalle: string }> = {
  facturacion: { titulo: 'Recepción', detalle: 'Registro del paciente, estudios y cobro' },
  caja: { titulo: 'Caja', detalle: 'Facturación del día y cobros por forma de pago' },
  kanban: { titulo: 'Sala de espera', detalle: 'Turnos en espera, en atención y finalizados' },
  'historial-pacientes': { titulo: 'Historial de pacientes', detalle: 'Atenciones y movimientos por paciente' },
  'conciliacion-pos': { titulo: 'Conciliaciones', detalle: 'Punto de venta y pagos recibidos' },
  retenciones: { titulo: 'Retenciones SENIAT', detalle: 'Retenciones de IVA e ISLR' },
  tesoreria: { titulo: 'Tesorería', detalle: 'Saldos y movimientos de cuentas' },
  'ingresos-extra': { titulo: 'Ingresos extraordinarios', detalle: 'Ingresos fuera de la facturación clínica' },
  egresos: { titulo: 'Egresos operativos', detalle: 'Gastos y comisiones bancarias' },
  divisas: { titulo: 'Cambio de divisas', detalle: 'Cobertura cambiaria en bolívares y dólares' },
  honorarios: { titulo: 'Honorarios médicos', detalle: 'Liquidación pendiente por especialista' },
  cierre: { titulo: 'Cierre diario', detalle: 'Auditoría y cierre de caja' },
  dashboard: { titulo: 'Dashboard', detalle: 'Resumen financiero del centro' },
  analiticas: { titulo: 'Analíticas', detalle: 'Indicadores por médico, área y período' },
  admin: { titulo: 'Catálogos', detalle: 'Pacientes, especialistas y estudios' },
  excel: { titulo: 'Carga masiva', detalle: 'Importación de atenciones históricas' },
};

interface Props {
  seccion: string;
  tasaBcv: number;
  nombreUsuario: string;
  role: UserRole;
  onMenu?: () => void;
}

const iniciales = (n: string) => n.replace(/^(Dr\.|Dra\.|Lcda\.|Lic\.)\s*/i, '').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

export const TopBar: React.FC<Props> = ({ seccion, tasaBcv, nombreUsuario, role, onMenu }) => {
  const info = TITULOS[seccion] ?? { titulo: 'Imagen Salud', detalle: '' };
  const fechaBase = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const fecha = fechaBase.charAt(0).toUpperCase() + fechaBase.slice(1);

  return (
    <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Abrir menú"
          className="lg:hidden shrink-0 -ml-1 p-2 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold tracking-tight text-slate-900 leading-tight truncate">{info.titulo}</h2>
          <p className="text-xs text-slate-500 truncate">{info.detalle}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden md:block text-xs text-slate-500">{fecha}</span>

          <WhatsAppEstado />

          <div
            title="Tasa oficial BCV (se actualiza automáticamente)"
            className="flex items-center gap-1.5 rounded-full bg-clinica-selection border border-clinica-aquamarine/50 px-3 py-1.5 text-xs"
          >
            <CircleDollarSign className="w-3.5 h-3.5 text-clinica-primary" strokeWidth={1.75} />
            <span className="text-slate-500">BCV</span>
            <span className="font-semibold text-clinica-dark tabular-nums">
              {tasaBcv > 0 ? `Bs ${tasaBcv.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div className="size-8 rounded-full bg-gradient-to-br from-clinica-aquamarine to-clinica-primary text-white text-[11px] font-semibold flex items-center justify-center">
              {iniciales(nombreUsuario) || 'IS'}
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="text-xs font-medium text-slate-800">{nombreUsuario}</p>
              <p className="text-[11px] text-slate-500">{role === 'admin' ? 'Dirección' : role === 'asistente' ? 'Administración' : 'Caja'}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
