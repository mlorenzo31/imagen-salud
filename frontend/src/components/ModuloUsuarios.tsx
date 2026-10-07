'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KeyRound, Plus, RefreshCw, Users } from 'lucide-react';
import { diferir } from '@/lib/diferir';
import type { UserRole } from '@/types';

interface Usuario {
  id: number; usuario: string; nombre: string; rol: UserRole; telefono: string | null; email: string | null;
  activo: boolean; bloqueado_hasta: string | null; creado: string;
}

const ROLES: { id: UserRole; etiqueta: string }[] = [
  { id: 'admin', etiqueta: 'Administrador' },
  { id: 'asistente', etiqueta: 'Asistente' },
  { id: 'cajero', etiqueta: 'Cajero' },
];

interface Form { id?: number; usuario: string; nombre: string; rol: UserRole; telefono: string; email: string; clave: string }
const VACIO: Form = { usuario: '', nombre: '', rol: 'cajero', telefono: '', email: '', clave: '' };

/** Gestión de usuarios y roles. Solo administrador. */
export const ModuloUsuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/usuarios');
      if (!res.ok) throw new Error('No se pudo cargar la lista de usuarios.');
      setUsuarios((await res.json()) as Usuario[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => diferir(cargar), [cargar]);

  const enviar = async (metodo: 'POST' | 'PUT', cuerpo: object): Promise<boolean> => {
    setGuardando(true);
    setErrorForm(null);
    try {
      const res = await fetch('/api/admin/usuarios', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErrorForm(data.error ?? 'No se pudo guardar.'); return false; }
      await cargar();
      return true;
    } catch {
      setErrorForm('Error de conexión con el servidor.');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const base = { nombre: form.nombre, rol: form.rol, telefono: form.telefono.trim() || null, email: form.email.trim() || null };
    const ok = form.id === undefined
      ? await enviar('POST', { ...base, usuario: form.usuario, clave: form.clave })
      : await enviar('PUT', { id: form.id, ...base, ...(form.clave ? { nuevaClave: form.clave } : {}) });
    if (ok) setForm(null);
  };

  const alternarActivo = async (u: Usuario) => {
    setError(null);
    const ok = await enviar('PUT', { id: u.id, activo: !u.activo });
    if (!ok) setError('No se pudo cambiar el estado (no puede desactivarse a sí mismo ni dejar el sistema sin administrador).');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><Users className="w-6 h-6 text-slate-700" /> Usuarios</h2>
          <p className="text-xs text-slate-500 mt-1">Cada persona entra con su usuario y clave. El WhatsApp registrado se usa para recuperar la clave.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={cargar} disabled={cargando} className="rounded-xl text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
          <Button size="sm" onClick={() => { setErrorForm(null); setForm({ ...VACIO }); }} className="rounded-xl text-xs font-bold">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo usuario
          </Button>
        </div>
      </div>

      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr><th className="p-3">Usuario</th><th className="p-3">Nombre</th><th className="p-3">Rol</th><th className="p-3">WhatsApp</th><th className="p-3">Estado</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">{cargando ? 'Cargando…' : 'Sin usuarios.'}</td></tr>}
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="p-3 font-mono font-bold">{u.usuario}</td>
                  <td className="p-3">{u.nombre}</td>
                  <td className="p-3">{ROLES.find((r) => r.id === u.rol)?.etiqueta}</td>
                  <td className="p-3 font-mono">{u.telefono ?? <span className="text-amber-600 font-sans">Sin registrar</span>}</td>
                  <td className="p-3">
                    {u.activo ? <Badge className="bg-emerald-600 text-white">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}
                    {u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date() && <Badge className="ml-1 bg-amber-500 text-white">Bloqueado</Badge>}
                  </td>
                  <td className="p-3 whitespace-nowrap text-right">
                    <Button variant="outline" size="sm" className="rounded-lg text-[11px] mr-1" onClick={() => { setErrorForm(null); setForm({ id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, telefono: u.telefono ?? '', email: u.email ?? '', clave: '' }); }}>Editar</Button>
                    <Button variant="outline" size="sm" className="rounded-lg text-[11px]" disabled={guardando} onClick={() => alternarActivo(u)}>{u.activo ? 'Desactivar' : 'Activar'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={form !== null} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white shadow-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 font-black"><KeyRound className="w-5 h-5" />{form?.id === undefined ? 'Nuevo usuario' : `Editar ${form.usuario}`}</DialogTitle></DialogHeader>
          {form && (
            <form className="space-y-3" onSubmit={guardar}>
              {form.id === undefined && (
                <Input autoCapitalize="none" placeholder="Usuario de acceso (ej. mlopez)" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value.toLowerCase() })} className="rounded-xl font-mono" />
              )}
              <Input placeholder="Nombre completo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="rounded-xl" />
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as UserRole })} className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm">
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.etiqueta}</option>)}
              </select>
              <Input inputMode="tel" placeholder="WhatsApp (ej. 04141234567)" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="rounded-xl font-mono" />
              <Input type="email" placeholder="Correo (opcional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" />
              <Input type="password" autoComplete="new-password" placeholder={form.id === undefined ? 'Clave inicial (8+ caracteres, letras y números)' : 'Nueva clave (dejar vacío para no cambiarla)'} value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} className="rounded-xl" />
              {errorForm && <p className="text-xs font-bold text-rose-600">{errorForm}</p>}
              <Button type="submit" disabled={guardando || !form.nombre.trim() || (form.id === undefined && (!form.usuario || !form.clave))} className="w-full rounded-xl font-bold">
                {guardando ? 'Guardando…' : 'Guardar'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
