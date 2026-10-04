'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Volume2, CheckCircle2, AlertTriangle, XCircle, Undo2, Users, ArrowRightLeft } from 'lucide-react';
import { calcularEdadReal } from '@/lib/date';
import { normalizarCedulaRif } from '@/lib/cedulaRif';
import { BOXES_CONSULTA, RECURSOS, aTarea, clavePaciente, planificarLlamado, type FilaSala } from '@/lib/sala';

const colorGrupo = (g: string) =>
  g === 'A' ? 'bg-clinica-selection text-clinica-dark border border-clinica-aquamarine/40' : g === 'B' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';

const codigo = (t: FilaSala) => `${t.grupo}-${String(t.turno_num ?? 0).padStart(2, '0')}`;

interface Comunes {
  turno: FilaSala;
  todos: FilaSala[];
  isReadOnly: boolean;
  ocupado: boolean;
}

function Datos({ t }: { t: FilaSala }) {
  const edad = t.fecha_nacimiento_paciente ? `${calcularEdadReal(t.fecha_nacimiento_paciente)} años` : null;
  return (
    <div>
      <h4 className="font-bold text-slate-900 text-sm leading-snug">{t.nombre_paciente}</h4>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-medium">
        <span className="font-mono text-slate-700 font-bold">{normalizarCedulaRif(t.cedula_paciente ?? '') || 'S/C'}</span>
        {edad && <><span>•</span><span className="font-bold text-teal-700">{edad}</span></>}
      </div>
    </div>
  );
}

/** Otros estudios del mismo paciente, con su estado: da contexto para decidir a quién llamar. */
function Hermanos({ t, todos }: { t: FilaSala; todos: FilaSala[] }) {
  const clave = clavePaciente(t.cedula_paciente, t.factura_id);
  const otros = todos.filter((o) => o.id !== t.id && clavePaciente(o.cedula_paciente, o.factura_id) === clave);
  if (otros.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {otros.map((o) => (
        <span
          key={o.id}
          title={o.estudio}
          className={'text-[10px] font-semibold px-2 py-0.5 rounded-full border ' + (
            o.estado === 'ATENCION' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'
          )}
        >
          {RECURSOS[o.recurso].etiqueta} · {o.estado === 'ATENCION' ? `en atención${o.box ? ` (${o.box})` : ''}` : 'en espera'}
        </span>
      ))}
    </div>
  );
}

interface PropsEspera extends Comunes {
  isAdmin: boolean;
  llamando: boolean;
  onLlamar: (ids: number[], box?: string) => void;
  onAnular: (t: FilaSala) => void;
}

export const TarjetaEspera: React.FC<PropsEspera> = ({ turno: t, todos, isReadOnly, isAdmin, llamando, onLlamar, onAnular }) => {
  const [box, setBox] = useState<string>('');
  const clave = clavePaciente(t.cedula_paciente, t.factura_id);
  const tareas = todos.map(aTarea);
  const mismosGrupo = todos.filter((o) => o.id !== t.id && o.estado === 'ESPERA' && o.grupo === t.grupo && clavePaciente(o.cedula_paciente, o.factura_id) === clave);

  const plan = planificarLlamado([t.id], tareas, box || undefined);
  const bloqueo = plan.ok ? null : plan.mensaje;
  const planConjunto = mismosGrupo.length > 0 ? planificarLlamado([t.id, ...mismosGrupo.map((o) => o.id)], tareas, box || undefined) : null;

  return (
    <Card className={'rounded-2xl border transition-all shadow-sm bg-white p-4 space-y-3 ' + (
      bloqueo ? 'border-slate-200 bg-slate-50/60' : t.retorno ? 'border-clinica-coral/60 bg-clinica-coral-soft/50 ring-2 ring-clinica-coral/20' : 'border-slate-200 hover:border-slate-300'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={'font-mono text-xs font-black px-2.5 py-1 rounded-xl text-white ' + (t.retorno ? 'bg-clinica-coral animate-pulse' : 'bg-slate-900')}>{codigo(t)}</span>
          <Datos t={t} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={'text-[10px] font-bold ' + colorGrupo(t.grupo)}>Grupo {t.grupo}</Badge>
          {t.retorno && <Badge className="bg-clinica-coral text-white text-[9px] font-bold">Retorno prioritario</Badge>}
          {t.ausencias > 0 && <Badge className="bg-amber-100 text-amber-800 text-[9px] font-bold">Ausente {t.ausencias}×</Badge>}
        </div>
      </div>

      <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 text-xs">
        <p className="text-slate-800 font-semibold">{t.estudio}</p>
        <div className="flex items-center justify-between text-[11px] text-slate-500 gap-2">
          <span>{RECURSOS[t.recurso].etiqueta}{t.recurso !== 'CONS' ? ` · ${RECURSOS[t.recurso].boxes[0]}` : ''}</span>
          <span className="truncate">{t.medico || 'De guardia'}</span>
        </div>
        {t.recurso === 'CONS' && (
          <select
            value={box}
            onChange={(e) => setBox(e.target.value)}
            disabled={isReadOnly}
            className="mt-1 w-full text-[11px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700"
            aria-label="Consultorio"
          >
            <option value="">Consultorio: el primero libre</option>
            {BOXES_CONSULTA.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      <Hermanos t={t} todos={todos} />

      {bloqueo && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-px" />
          <span>{bloqueo}</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          disabled={isReadOnly || Boolean(bloqueo) || llamando}
          onClick={() => onLlamar([t.id], box || undefined)}
          className={'flex-1 text-white text-xs font-bold rounded-xl h-8 flex items-center justify-center gap-1.5 shadow-sm ' + (
            bloqueo ? 'bg-slate-300 cursor-not-allowed text-slate-500' : t.retorno ? 'bg-clinica-coral hover:bg-clinica-coral' : 'bg-clinica-primary hover:bg-clinica-primary-dark'
          )}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>{llamando ? 'Llamando...' : 'Llamar'}</span>
        </Button>
        {planConjunto?.ok && (
          <Button
            size="sm"
            variant="outline"
            disabled={isReadOnly || llamando}
            onClick={() => onLlamar([t.id, ...mismosGrupo.map((o) => o.id)], box || undefined)}
            className="text-xs font-bold rounded-xl h-8 px-2.5 flex items-center gap-1.5"
            title={`Llamar también: ${mismosGrupo.map((o) => o.estudio).join(', ')}`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>+{mismosGrupo.length}</span>
          </Button>
        )}
        {isAdmin && !isReadOnly && (
          <Button size="sm" variant="ghost" onClick={() => onAnular(t)} className="text-slate-400 hover:text-clinica-coral hover:bg-clinica-coral-soft rounded-xl h-8 px-2" title="Anular atención en sala y enviar fondos a reversión">
            <XCircle className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  );
};

interface PropsAtencion extends Comunes {
  onFinalizar: (ids: number[]) => void;
  onAusente: (t: FilaSala) => void;
  onRellamar: (t: FilaSala) => void;
}

export const TarjetaAtencion: React.FC<PropsAtencion> = ({ turno: t, todos, isReadOnly, onFinalizar, onAusente, onRellamar }) => {
  const clave = clavePaciente(t.cedula_paciente, t.factura_id);
  const mismosGrupo = todos.filter((o) => o.id !== t.id && o.estado === 'ATENCION' && o.grupo === t.grupo && clavePaciente(o.cedula_paciente, o.factura_id) === clave);
  return (
    <Card className="rounded-2xl border-2 border-blue-400/40 shadow-md bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-black px-2.5 py-1 bg-blue-600 text-white rounded-xl animate-pulse">{codigo(t)}</span>
          <Datos t={t} />
        </div>
        <Badge className="bg-blue-100 text-blue-800 text-[10px] font-bold">Grupo {t.grupo}</Badge>
      </div>

      <div className="p-2.5 bg-blue-50/50 rounded-xl space-y-1 text-xs">
        <p className="text-slate-800 font-semibold">{t.estudio}</p>
        <p className="text-slate-500 text-[11px] flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" />{t.box ?? RECURSOS[t.recurso].boxes[0]}</p>
      </div>

      <Hermanos t={t} todos={todos} />

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" disabled={isReadOnly} onClick={() => onFinalizar([t.id])} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-8 flex items-center justify-center gap-1.5 shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Culminar</span>
        </Button>
        {mismosGrupo.length > 0 && (
          <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => onFinalizar([t.id, ...mismosGrupo.map((o) => o.id)])} className="text-xs font-bold rounded-xl h-8 px-2.5" title="Culminar también los otros estudios de este grupo en atención">
            +{mismosGrupo.length}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => onRellamar(t)} className="text-slate-600 rounded-xl h-8 px-2.5" title="Re-llamar por altavoz">
          <Volume2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => onAusente(t)} className="text-amber-700 border-amber-200 hover:bg-amber-50 rounded-xl h-8 px-2.5" title="No se presentó: devolver a la sala de espera">
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
};
