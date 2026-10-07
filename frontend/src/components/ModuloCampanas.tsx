'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Megaphone, Send, Users } from 'lucide-react';
import { FiltrosSegmento, FORM_VACIO, aFiltros, type FormFiltros } from '@/components/campanas/FiltrosSegmento';
import { diferir } from '@/lib/diferir';
import { centsToStr } from '@/lib/money';
import { MAX_DESTINATARIOS, personalizarMensaje, type PacienteSegmento, type ResumenSegmento } from '@/lib/segmentos';
import type { ResumenCampana } from '@/lib/campanasDb';

type Opciones = { areas: string[]; medicos: string[]; estudios: string[] };
const digitos = (s: string) => s.replace(/\D/g, '');

const Barra: React.FC<{ titulo: string; items: { etiqueta: string; total: number }[]; onClick?: (e: string) => void }> = ({ titulo, items, onClick }) => (
  <div className="p-3 bg-white rounded-2xl border border-slate-200/90 space-y-1.5">
    <p className="text-[10px] font-black uppercase text-slate-500">{titulo}</p>
    {items.length === 0 && <p className="text-[11px] text-slate-400">Sin datos</p>}
    {items.map((i) => (
      <button key={i.etiqueta} type="button" disabled={!onClick} onClick={() => onClick?.(i.etiqueta)}
        className="w-full flex items-center justify-between text-[11px] text-left hover:bg-slate-50 rounded-md px-1 disabled:hover:bg-transparent">
        <span className="font-semibold text-slate-700 truncate">{i.etiqueta}</span>
        <span className="font-mono font-bold text-clinica-primary-dark">{i.total}</span>
      </button>
    ))}
  </div>
);

export const ModuloCampanas: React.FC = () => {
  const [form, setForm] = useState<FormFiltros>(FORM_VACIO);
  const [opciones, setOpciones] = useState<Opciones>({ areas: [], medicos: [], estudios: [] });
  const [pacientes, setPacientes] = useState<PacienteSegmento[]>([]);
  const [resumen, setResumen] = useState<ResumenSegmento | null>(null);
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [campanas, setCampanas] = useState<ResumenCampana[]>([]);
  const [nombre, setNombre] = useState('');
  const [mensaje, setMensaje] = useState('Hola {nombre}, en Imagen Salud tenemos una promoción para usted. ');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const cargarCampanas = async () => {
    try {
      const r = await fetch('/api/campanas');
      if (r.ok) setCampanas(await r.json());
    } catch { /* sin conexión: se conserva la lista actual */ }
  };

  const buscar = async (f: FormFiltros = form) => {
    setBuscando(true); setError(''); setAviso('');
    try {
      const r = await fetch('/api/campanas/segmento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filtros: aFiltros(f) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'No se pudo consultar el segmento.');
      setPacientes(d.pacientes); setResumen(d.resumen); setExcluidos(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión.');
    } finally {
      setBuscando(false);
    }
  };

  React.useEffect(() => diferir(() => {
    fetch('/api/campanas/segmento').then((r) => (r.ok ? r.json() : null)).then((o) => { if (o) setOpciones(o); }).catch(() => {});
    void cargarCampanas();
    void buscar(FORM_VACIO);
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const destinatarios = useMemo(() => {
    const vistos = new Set<string>();
    return pacientes.filter((p) => {
      if (!p.contactable || excluidos.has(digitos(p.cedula))) return false;
      const t = digitos(p.telefono ?? '').slice(-10);
      if (vistos.has(t)) return false;
      vistos.add(t);
      return true;
    });
  }, [pacientes, excluidos]);

  const alternar = (ced: string) => setExcluidos((prev) => {
    const n = new Set(prev); const k = digitos(ced);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const aplicarRango = (etiqueta: string) => {
    const m = etiqueta.match(/^(\d+)[–-](\d+)$/) ?? etiqueta.match(/^(\d+)\+$/);
    if (!m) return;
    const nuevo = { ...form, edadMin: m[1], edadMax: m[2] ?? '' };
    setForm(nuevo);
    void buscar(nuevo);
  };

  const enviar = async () => {
    setEnviando(true); setError('');
    try {
      const r = await fetch('/api/campanas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, mensaje, filtros: aFiltros(form), excluir: [...excluidos] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'No se pudo crear la campaña.');
      setAviso(`Campaña en cola: ${d.encolados} mensajes. El bot los envía con pausa de 20–40 s.`);
      setConfirmando(false); setNombre('');
      void cargarCampanas();
    } catch (e) {
      setConfirmando(false);
      setError(e instanceof Error ? e.message : 'Error de conexión.');
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async (id: number) => {
    await fetch('/api/campanas/cancelar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    void cargarCampanas();
  };

  const puedeEnviar = nombre.trim().length >= 3 && mensaje.trim().length >= 10 && destinatarios.length > 0 && destinatarios.length <= MAX_DESTINATARIOS;
  const vistaPrevia = personalizarMensaje(mensaje, destinatarios[0]?.nombre ?? 'María Pérez');

  return (
    <div className="space-y-4">
      <FiltrosSegmento form={form} setForm={setForm} opciones={opciones} buscando={buscando} onBuscar={() => void buscar()} />

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">{error}</div>}
      {aviso && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">{aviso}</div>}

      {resumen && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className="bg-slate-800 text-white"><Users className="w-3 h-3 mr-1" />{resumen.total} pacientes</Badge>
            <Badge className="bg-emerald-600 text-white">{resumen.contactables} contactables</Badge>
            <Badge variant="outline">{resumen.sinTelefono} sin teléfono válido</Badge>
            <Badge variant="outline">{resumen.conBaja} con baja</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Barra titulo="Por rango etario (clic para filtrar)" items={resumen.porRango} onClick={aplicarRango} />
            <Barra titulo="Por sexo" items={resumen.porSexo} />
            <Barra titulo="Por área" items={resumen.porArea} />
            <Barra titulo="Por médico" items={resumen.porMedico} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="p-2 w-8">Enviar</th><th className="p-2 text-left">Paciente</th><th className="p-2">Edad</th>
                    <th className="p-2">Visitas</th><th className="p-2">Gasto USD</th><th className="p-2">Última</th><th className="p-2 text-left">Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientes.slice(0, 500).map((p) => (
                    <tr key={p.cedula} className={`border-t border-slate-100 ${p.contactable ? '' : 'opacity-50'}`}>
                      <td className="p-2 text-center">
                        <input type="checkbox" disabled={!p.contactable} checked={p.contactable && !excluidos.has(digitos(p.cedula))} onChange={() => alternar(p.cedula)} />
                      </td>
                      <td className="p-2"><span className="font-bold text-slate-800">{p.nombre || '—'}</span> <span className="text-slate-400 font-mono">{p.cedula}</span></td>
                      <td className="p-2 text-center">{p.edad ?? '—'}</td>
                      <td className="p-2 text-center">{p.visitas}</td>
                      <td className="p-2 text-center font-mono">{centsToStr(p.gasto_cents)}</td>
                      <td className="p-2 text-center font-mono">{p.ultima_visita ?? '—'}</td>
                      <td className="p-2 font-mono">{p.telefono || <span className="text-amber-600">Sin teléfono</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pacientes.length > 500 && <p className="p-2 text-[11px] text-slate-500 border-t">Se muestran 500 de {pacientes.length}; afine los filtros para ver el resto.</p>}
          </div>
        </>
      )}

      <div className="p-4 bg-white rounded-2xl border border-emerald-200 space-y-3">
        <p className="flex items-center gap-2 text-sm font-black text-emerald-800"><Megaphone className="w-4 h-4" />Nueva campaña de WhatsApp</p>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre interno (ej. Mamografía mujeres 40+)" className="h-9 text-xs rounded-xl" />
        <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={900} rows={4}
          className="w-full text-xs rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        <p className="text-[11px] text-slate-500">Use <b>{'{nombre}'}</b> para el primer nombre. Se agrega automáticamente el pie de baja. {mensaje.length}/900</p>
        <pre className="text-[11px] whitespace-pre-wrap bg-slate-50 rounded-xl p-3 border border-slate-200 font-sans">{vistaPrevia}</pre>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">Destinatarios: <b>{destinatarios.length}</b> (máx. {MAX_DESTINATARIOS})</span>
          <Button disabled={!puedeEnviar} onClick={() => setConfirmando(true)} className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
            <Send className="w-3.5 h-3.5 mr-1.5" />Revisar y enviar
          </Button>
        </div>
      </div>

      <div className="p-4 bg-white rounded-2xl border border-slate-200/90 space-y-2">
        <p className="text-[10px] font-black uppercase text-slate-500">Campañas anteriores</p>
        {campanas.length === 0 && <p className="text-xs text-slate-400">Aún no hay campañas.</p>}
        {campanas.map((c) => (
          <div key={c.id} className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
            <div className="min-w-0">
              <p className="font-bold text-slate-800 truncate">{c.nombre}</p>
              <p className="text-[10px] text-slate-500">{c.creado.slice(0, 16).replace('T', ' ')} · {c.usuario ?? '—'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className="bg-emerald-600 text-white">{c.enviados} enviados</Badge>
              <Badge variant="outline">{c.pendientes} pendientes</Badge>
              {c.fallidos > 0 && <Badge variant="outline" className="text-red-700 border-red-300">{c.fallidos} fallidos</Badge>}
              {c.pendientes > 0 && <Button variant="outline" className="h-7 text-[11px] rounded-lg" onClick={() => void cancelar(c.id)}>Cancelar</Button>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={confirmando} onOpenChange={(o) => !enviando && setConfirmando(o)}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white p-6">
          <DialogHeader><DialogTitle className="text-emerald-800 font-black">Confirmar campaña</DialogTitle></DialogHeader>
          <div className="text-xs space-y-2 text-slate-700">
            <p>Se enviará <b>«{nombre}»</b> a <b>{destinatarios.length}</b> pacientes, uno cada 20–40 s (≈ {Math.ceil((destinatarios.length * 30) / 60)} min en total, con tope diario del bot).</p>
            <p className="text-amber-700">Envíe solo a pacientes que aceptaron recibir mensajes: el envío masivo no solicitado puede hacer que WhatsApp restrinja el número de la clínica.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={enviando} onClick={() => setConfirmando(false)} className="rounded-xl text-xs">Volver</Button>
            <Button disabled={enviando} onClick={() => void enviar()} className="rounded-xl text-xs font-bold bg-emerald-600 text-white">{enviando ? 'Encolando…' : 'Enviar campaña'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModuloCampanas;
