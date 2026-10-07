'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Lock, Eye, EyeOff, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { RecuperarClave } from '@/components/RecuperarClave';import { UserRole, ModoOperacion } from '@/types';

interface LoginScreenProps {
  onLoginSuccess: (role: UserRole, nombreUsuario: string, modo: ModoOperacion) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [usuario, setUsuario] = useState<string>('');
  const [recuperando, setRecuperando] = useState<boolean>(false);
  const [modoSeleccionado, setModoSeleccionado] = useState<ModoOperacion>('operador');
  const [pin, setPin] = useState<string>('');
  const [mostrarPin, setMostrarPin] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<boolean>(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, clave: pin, modo: modoSeleccionado })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'No se pudo iniciar sesión.');
        return;
      }
      onLoginSuccess(data.role as UserRole, data.nombre as string, data.modo as ModoOperacion);
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Elementos visuales sutiles de fondo con paleta oficial */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-clinica-aquamarine/15 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-clinica-blue/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="w-full max-w-lg space-y-6 relative z-10 animate-in fade-in-50 duration-500">
        {/* Identidad Corporativa Oficial */}
        <div className="text-center space-y-2">
          <h1 className="sr-only">Imagen Salud · Centro de Atención Radiológica</h1>
          <Image src="/logo.png" alt="Imagen Salud, Centro de Atención Radiológica" width={594} height={576} priority className="mx-auto w-40 h-auto" />
          <p className="text-sm text-slate-500 max-w-xs mx-auto pt-2">
            Admisión, facturación multimoneda y control financiero
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

              {/* 1. Usuario */}
              <div className="space-y-1.5">
                <label htmlFor="login-usuario" className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Usuario
                </label>
                <Input
                  id="login-usuario"
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="Ej. cajero"
                  value={usuario}
                  onChange={(e) => { setUsuario(e.target.value); setError(null); }}
                  required
                  className="text-xs rounded-xl bg-slate-50 border-slate-200 h-10 font-mono"
                />
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
              {(
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Clave</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <Input
                      type={mostrarPin ? 'text' : 'password'}
                      placeholder="Ingrese su clave..."
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                      className="pl-9 pr-10 text-xs rounded-xl bg-slate-50 border-slate-200 h-10 tracking-widest font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPin(!mostrarPin)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-600"
                    >
                      {mostrarPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
              <button
                type="button"
                onClick={() => setRecuperando(true)}
                className="text-[11px] font-bold text-clinica-primary hover:underline"
              >
                ¿Olvidó su clave?
              </button>
            </CardFooter>
          </form>
        </Card>

        <RecuperarClave open={recuperando} usuarioInicial={usuario} onCerrar={() => setRecuperando(false)} />

        {/* Footer Institucional */}
        <div className="text-center space-y-1 text-[11px] text-slate-500">
          <p>© 2026 Centro Clínico Radiológico Imagen Salud, C.A.</p>
          <p>Módulos auditados conforme a estándares hospitalarios y providencias fiscales SENIAT</p>
        </div>
      </div>
    </div>
  );
};
