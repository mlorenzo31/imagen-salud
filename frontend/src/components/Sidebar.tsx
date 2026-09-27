'use client';

import React from 'react';
import { 
  ShoppingCart, 
  Receipt, 
  Tv, 
  CreditCard, 
  FileCheck2, 
  Wallet, 
  TrendingUp, 
  ArrowDownRight, 
  ArrowLeftRight, 
  Stethoscope, 
  ShieldAlert, 
  LayoutDashboard, 
  BarChart3, 
  Settings, 
  FileSpreadsheet,
  Building2,
  LogOut,
  Eye,
  CheckCircle2,
  History
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { UserRole, ModoOperacion } from '@/types';

interface SidebarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeSection: string;
  onSelectSection: (section: string) => void;
  onLogout?: () => void;
  modoOperacion?: ModoOperacion;
  onToggleModoOperacion?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  onRoleChange,
  activeSection,
  onSelectSection,
  onLogout,
  modoOperacion = 'operador',
  onToggleModoOperacion
}) => {
  const isAdmin = currentRole === 'admin';
  const isAsistente = currentRole === 'asistente';
  const isCajero = currentRole === 'cajero';

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
        { id: 'cierre', label: 'Cierre Diario', icon: ShieldAlert, allowed: ['admin'] },
      ]
    },
    {
      group: 'DIRECCIÓN EJECUTIVA',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, allowed: ['admin', 'asistente'] },
        { id: 'analiticas', label: 'Analíticas', icon: BarChart3, allowed: ['admin', 'asistente'] },
        { id: 'admin', label: 'Catálogos', icon: Settings, allowed: ['admin'] },
        { id: 'excel', label: 'Carga Masiva', icon: FileSpreadsheet, allowed: ['admin', 'asistente'] },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col justify-between border-r border-slate-800 shadow-2xl shrink-0">
      <div className="flex-1 overflow-y-auto pb-4">
        {/* Header con Isotipo Oficial */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-white shadow-lg text-clinica-primary">
              <Building2 className="w-6 h-6 text-clinica-primary" />
            </div>
            <div>
              <h1 className="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
                <span>IMAGEN SALUD</span>
              </h1>
              <p className="text-[10px] text-clinica-aquamarine font-bold tracking-wider uppercase">
                Centro Clínico, C.A.
              </p>
            </div>
          </div>

          {/* Credencial Activa y Conmutador de Modo Operador / Modo Vista */}
          <div className="mt-4 pt-3 border-t border-slate-800/70 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 font-bold">Perfil Activo:</span>
              <Badge className={
                isAdmin ? 'bg-clinica-primary text-white text-[10px]' :
                isAsistente ? 'bg-blue-600 text-white text-[10px]' :
                'bg-slate-700 text-slate-200 text-[10px]'
              }>
                {isAdmin ? 'Director Médico' : isAsistente ? 'Asistente Admin' : 'Cajero(a)'}
              </Badge>
            </div>

            {/* Selector interactivo de Modo Operador / Modo Vista */}
            <div 
              onClick={onToggleModoOperacion}
              className="flex items-center justify-between p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 cursor-pointer transition-all text-xs border border-slate-700/60"
              title="Haga clic para alternar entre Modo Operador y Modo Vista (Read-Only)"
            >
              <span className="text-[10px] text-slate-300 font-medium flex items-center gap-1.5">
                {modoOperacion === 'operador' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-clinica-aquamarine" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Modo:</span>
              </span>
              <span className={`text-[10px] font-bold ${modoOperacion === 'operador' ? 'text-clinica-aquamarine' : 'text-amber-400'}`}>
                {modoOperacion === 'operador' ? 'Operador (Full)' : 'Lectura (Read-Only)'}
              </span>
            </div>
          </div>
        </div>

        {/* Grupos del Menú con Ocultamiento Total por RBAC */}
        <div className="p-3 space-y-5">
          {menuSections.map((sec, idx) => {
            const itemsPermitidos = sec.items.filter(it => it.allowed.includes(currentRole));
            if (itemsPermitidos.length === 0) return null; // Ocultamiento total en el DOM para Cajero

            return (
              <div key={idx} className="space-y-1">
                <p className="px-3 text-[10px] font-black tracking-wider text-slate-400 uppercase">
                  {sec.group}
                </p>
                <div className="space-y-0.5">
                  {itemsPermitidos.map(item => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectSection(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-clinica-primary text-white shadow-md shadow-clinica-primary/20'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate text-left">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer del Sidebar con Logout */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/50 space-y-2">
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        )}
        <p className="text-[10px] text-center text-slate-400">
          Imagen Salud • v4.8 Enterprise
        </p>
      </div>
    </aside>
  );
};
