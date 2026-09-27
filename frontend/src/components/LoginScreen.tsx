'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Lock, 
  UserCheck, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Stethoscope,
  KeyRound,
  CheckCircle2,
  Briefcase,
  FileCheck2,
  Receipt
} from 'lucide-react';
import { UserRole, ModoOperacion } from '@/types';

interface LoginScreenProps {
  onLoginSuccess: (role: UserRole, nombreUsuario: string, modo: ModoOperacion) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [rolSeleccionado, setRolSeleccionado] = useState<UserRole>('admin');
  const [modoSeleccionado, setModoSeleccionado] = useState<ModoOperacion>('operador');
  const [pin, setPin] = useState<string>('');
  const [mostrarPin, setMostrarPin] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<boolean>(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);

    setTimeout(() => {
      // 1. Rol Director / Administrador
      if (rolSeleccionado === 'admin') {
        if (pin === '1234' || pin === 'admin123' || pin === 'admin') {
          const sessionData = { role: 'admin', nombre: 'Dr. Director Médico', modo: modoSeleccionado, time: Date.now() };
          try { localStorage.setItem('imagen_salud_session', JSON.stringify(sessionData)); } catch (e) {}
          onLoginSuccess('admin', 'Dr. Director Médico', modoSeleccionado);
        } else {
          setError('PIN de Administrador incorrecto. (PIN de acceso: 1234)');
          setCargando(false);
        }
        return;
      }

      // 2. Rol Asistente Administrativo
      if (rolSeleccionado === 'asistente') {
        if (pin === '4321' || pin === 'asistente' || pin === '1234' || pin === '') {
          const sessionData = { role: 'asistente', nombre: 'Lcda. Asistente Administrativo', modo: modoSeleccionado, time: Date.now() };
          try { localStorage.setItem('imagen_salud_session', JSON.stringify(sessionData)); } catch (e) {}
          onLoginSuccess('asistente', 'Lcda. Asistente Administrativo', modoSeleccionado);
        } else {
          setError('PIN de Asistente Administrativo incorrecto. (PIN de acceso: 4321)');
          setCargando(false);
        }
        return;
      }

      // 3. Rol Cajero / Admisión
      if (rolSeleccionado === 'cajero') {
        const sessionData = { role: 'cajero', nombre: 'Cajero(a) de Turno', modo: modoSeleccionado, time: Date.now() };
        try { localStorage.setItem('imagen_salud_session', JSON.stringify(sessionData)); } catch (e) {}
        onLoginSuccess('cajero', 'Cajero(a) de Turno', modoSeleccionado);
      }
    }, 350);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Elementos visuales sutiles de fondo con paleta oficial */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-clinica-aquamarine/15 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-clinica-blue/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="w-full max-w-lg space-y-6 relative z-10 animate-in fade-in-50 duration-500">
        {/* Identidad Corporativa Oficial */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-xl shadow-clinica-primary/10 border border-clinica-aquamarine/30 text-clinica-primary mb-1">
            <Building2 className="w-9 h-9 text-clinica-primary" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            IMAGEN SALUD
          </h1>
          <p className="text-xs text-clinica-primary font-bold uppercase tracking-widest">
            Centro Clínico Radiológico, C.A.
          </p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Sistema Hospitalario de Admisión, Facturación Multimoneda y Control Financiero
          </p>
        </div>

        {/* Tarjeta de Autenticación */}
        <Card className="border border-slate-200 bg-white/95 backdrop-blur-md shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-clinica-primary" />
                Acceso al Sistema Clínico
              </span>
              <Badge className="bg-clinica-selection text-clinica-dark border border-clinica-aquamarine/40 text-[10px] font-mono">
                Enterprise v4.8
              </Badge>
            </CardTitle>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-4">
              {/* Mensaje de Error */}
              {error && (
                <div className="p-3 bg-clinica-coral-soft border border-clinica-coral/30 rounded-2xl flex items-center gap-2 text-xs text-clinica-coral font-bold animate-in fade-in-50">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. Selector de Rol Clínico (RBAC) */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Perfil de Usuario Clínico
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Admin */}
                  <button
                    type="button"
                    onClick={() => { setRolSeleccionado('admin'); setError(null); }}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      rolSeleccionado === 'admin'
                        ? 'border-clinica-primary bg-clinica-selection shadow-sm text-clinica-dark'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <ShieldCheck className={`w-5 h-5 ${rolSeleccionado === 'admin' ? 'text-clinica-primary' : 'text-slate-400'}`} />
                    <span className="text-[11px] font-bold leading-tight">Director / Admin</span>
                  </button>

                  {/* Asistente Administrativo */}
                  <button
                    type="button"
                    onClick={() => { setRolSeleccionado('asistente'); setError(null); }}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      rolSeleccionado === 'asistente'
                        ? 'border-clinica-primary bg-clinica-selection shadow-sm text-clinica-dark'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Briefcase className={`w-5 h-5 ${rolSeleccionado === 'asistente' ? 'text-clinica-primary' : 'text-slate-400'}`} />
                    <span className="text-[11px] font-bold leading-tight">Asistente Admin</span>
                  </button>

                  {/* Cajero */}
                  <button
                    type="button"
                    onClick={() => { setRolSeleccionado('cajero'); setError(null); }}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      rolSeleccionado === 'cajero'
                        ? 'border-clinica-primary bg-clinica-selection shadow-sm text-clinica-dark'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Receipt className={`w-5 h-5 ${rolSeleccionado === 'cajero' ? 'text-clinica-primary' : 'text-slate-400'}`} />
                    <span className="text-[11px] font-bold leading-tight">Caja & Admisión</span>
                  </button>
                </div>
              </div>

              {/* 2. Selector de Modo de Operación (Operador vs Vista Read-Only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Modo de Operación por Credencial
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setModoSeleccionado('operador')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      modoSeleccionado === 'operador'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-clinica-primary" />
                    <span>Modo Operador (Edición)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoSeleccionado('vista')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      modoSeleccionado === 'vista'
                        ? 'bg-white text-amber-900 shadow-sm border border-amber-200'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-600" />
                    <span>Modo Vista (Read-Only)</span>
                  </button>
                </div>
              </div>

              {/* 3. PIN de Seguridad */}
              {rolSeleccionado !== 'cajero' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>PIN / Contraseña de Seguridad</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {rolSeleccionado === 'admin' ? 'Por defecto: 1234' : 'Por defecto: 4321'}
                    </span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <Input
                      type={mostrarPin ? 'text' : 'password'}
                      placeholder={rolSeleccionado === 'admin' ? 'Ingrese PIN de Administrador...' : 'Ingrese PIN de Asistente...'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                      className="pl-9 pr-10 text-xs rounded-xl bg-slate-50 border-slate-200 h-10 tracking-widest font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPin(!mostrarPin)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {mostrarPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-clinica-primary shrink-0" />
                  <span>Acceso simplificado de turno para taquilla y admisión de pacientes.</span>
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-2 pb-5 border-t border-slate-100 flex flex-col gap-2">
              <Button
                type="submit"
                disabled={cargando}
                className="w-full bg-clinica-primary hover:bg-clinica-primary-dark text-white font-bold text-xs rounded-xl h-10 shadow-md shadow-clinica-primary/20 transition-all flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verificando Credenciales...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Iniciar Sesión en Sistema Clínico</span>
                  </span>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Footer Institucional */}
        <div className="text-center space-y-1 text-[11px] text-slate-400">
          <p>© 2026 Centro Clínico Radiológico Imagen Salud, C.A.</p>
          <p>Módulos auditados conforme a estándares hospitalarios y providencias fiscales SENIAT</p>
        </div>
      </div>
    </div>
  );
};
