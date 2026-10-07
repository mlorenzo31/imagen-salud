'use client';

import React from 'react';
import Image from 'next/image';
import { ShoppingCart, Receipt, Tv, CreditCard, FileCheck2, Wallet, TrendingUp, ArrowDownRight, ArrowLeftRight, Stethoscope, ShieldAlert, LayoutDashboard, BarChart3, Settings, FileSpreadsheet, LogOut, Eye, CheckCircle2, History, Megaphone, ScrollText } from 'lucide-react';
import { UserRole, ModoOperacion } from '@/types';

interface SidebarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeSection: string;
  onSelectSection: (section: string) => void;
  onLogout?: () => void;
  modoOperacion?: ModoOperacion;
  onToggleModoOperacion?: () => void;
  /** En pantallas menores a lg el menú es un panel deslizable. */
  abierto?: boolean;
  onCerrar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  activeSection,
  onSelectSection,
  onLogout,
  modoOperacion = 'operador',
  onToggleModoOperacion,
  abierto = false,
  onCerrar
}) => {
  const isAdmin = currentRole === 'admin';
  const isAsistente = currentRole === 'asistente';

  // MATRIZ DE CONTROL DE ACCESO ESTRICTO (RBAC) - TÍTULOS CORTOS Y CORPORATIVOS
  const menuSections = [
    {
      group: 'ATENCIÓN CLÍNICA',
      items: [
        { id: 'facturacion', label: 'Recepción', icon: ShoppingCart, allowed: ['admin', 'asistente', 'cajero'] },
        { id: 'caja', label: 'Caja', icon: Receipt, allowed: ['admin', 'asistente', 'cajero'] },
        { id: 'kanban', label: 'Sala de Espera', icon: Tv, allowed: ['admin', 'asistente', 'cajero'] },
        { id: 'historial-pacientes', label: 'Historial Pacientes', icon: History, allowed: ['admin', 'asistente', 'cajero'] },
      ]
    },
    {
      group: 'OPERACIONES Y BANCOS',
      // Ocultamiento total para Cajero en DOM y navegación
      items: [
        { id: 'conciliacion-pos', label: 'Conciliaciones', icon: CreditCard, allowed: ['admin', 'asistente'] },
        { id: 'retenciones', label: 'Retenciones SENIAT', icon: FileCheck2, allowed: ['admin', 'asistente'] },
      ]
    },
    {
      group: 'TESORERÍA Y CONTROL',
      // Exclusivo para Administrador / Dirección Médica
      items: [
        { id: 'tesoreria', label: 'Tesorería', icon: Wallet, allowed: ['admin'] },
        { id: 'ingresos-extra', label: 'Ingresos Extraordinarios', icon: TrendingUp, allowed: ['admin'] },
        { id: 'egresos', label: 'Egresos', icon: ArrowDownRight, allowed: ['admin'] },
        { id: 'divisas', label: 'Cambio Divisas', icon: ArrowLeftRight, allowed: ['admin'] },
        { id: 'honorarios', label: 'Honorarios', icon: Stethoscope, allowed: ['admin'] },
        { id: 'bitacora', label: 'Bitácora', icon: ScrollText, allowed: ['admin'] },
        { id: 'cierre', label: 'Cierre Diario', icon: ShieldAlert, allowed: ['admin', 'asistente', 'cajero'] },
      ]
    },
    {
      group: 'DIRECCIÓN EJECUTIVA',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, allowed: ['admin', 'asistente'] },
        { id: 'analiticas', label: 'Analíticas', icon: BarChart3, allowed: ['admin', 'asistente'] },
        { id: 'admin', label: 'Catálogos', icon: Settings, allowed: ['admin'] },
        { id: 'campanas', label: 'Campañas WhatsApp', icon: Megaphone, allowed: ['admin'] },
        { id: 'excel', label: 'Carga Masiva', icon: FileSpreadsheet, allowed: ['admin', 'asistente'] },
      ]
    }
  ];

  const perfil = isAdmin ? 'Director Médico' : isAsistente ? 'Asistente Administrativo' : 'Caja y Admisión';

  return (
    <>
    {abierto && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onCerrar} aria-hidden="true" />}
    <aside
      aria-label="Menú principal"
      className={`w-64 bg-white text-slate-700 h-dvh fixed inset-y-0 left-0 z-40 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 transition-transform duration-200 flex flex-col border-r border-slate-200/80 shrink-0 ${abierto ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}
    >
      {/* Marca */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="sr-only">Imagen Salud · Centro de Atención Radiológica</h1>
        <Image src="/logo.png" alt="Imagen Salud, Centro de Atención Radiológica" width={594} height={576} priority className="w-24 h-auto mx-auto" />
      </div>

      {/* Perfil y modo de operación */}
      <div className="mx-4 mb-3 rounded-xl bg-slate-50 border border-slate-200/70 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Perfil activo</span>
          <span className="text-[11px] font-semibold text-clinica-dark bg-clinica-selection rounded-full px-2 py-0.5">{perfil}</span>
        </div>
        <button
          type="button"
          onClick={onToggleModoOperacion}
          title="Alternar entre Modo Operador y Modo Vista (solo lectura)"
          className="w-full flex items-center justify-between rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-[11px] hover:border-clinica-primary/40 transition-colors"
        >
          <span className="flex items-center gap-1.5 text-slate-500">
            {modoOperacion === 'operador'
              ? <CheckCircle2 className="w-3.5 h-3.5 text-clinica-primary" />
              : <Eye className="w-3.5 h-3.5 text-amber-500" />}
            Modo
          </span>
          <span className={`font-semibold ${modoOperacion === 'operador' ? 'text-clinica-dark' : 'text-amber-600'}`}>
            {modoOperacion === 'operador' ? 'Operador' : 'Solo lectura'}
          </span>
        </button>
      </div>

      {/* Navegación (ocultamiento total por rol) */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-4">
        {menuSections.map((sec, idx) => {
          const itemsPermitidos = sec.items.filter(it => it.allowed.includes(currentRole));
          if (itemsPermitidos.length === 0) return null;
          return (
            <div key={idx} className="space-y-1">
              <p className="px-3 pb-1 text-[10.5px] font-semibold tracking-[0.08em] text-slate-500 uppercase">{sec.group}</p>
              {itemsPermitidos.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectSection(item.id)}
                    className={`relative w-full flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-clinica-selection text-clinica-dark'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-clinica-primary" />}
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-clinica-primary' : 'text-slate-500'}`} strokeWidth={1.75} />
                    <span className="truncate text-left">{item.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Pie */}
      <div className="px-3 py-3 border-t border-slate-200/80">
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:text-clinica-coral hover:bg-clinica-coral-soft transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.75} />
            <span>Cerrar sesión</span>
          </button>
        )}
        <p className="mt-2 px-3 text-[10.5px] text-slate-500">v4.8 · Gestión clínica</p>
      </div>
    </aside>
    </>
  );
};
