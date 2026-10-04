import type { GrupoClinico } from '@/lib/gruposClinicos';

/**
 * Reglas de la sala de espera.
 * Cada servicio de una factura es un turno propio con un recurso (sala) físico:
 *   Grupo A: ECO (ecografía) y GINE (consultorio ginecológico) → pueden trabajar a la vez.
 *   Grupo B: MAMO (mamografía) y RX (rayos X) → pueden trabajar a la vez.
 *   Grupo C: CONS → 2 consultorios simultáneos.
 * Un paciente solo puede estar EN ATENCIÓN en un grupo a la vez; dentro del mismo grupo es opcional.
 */
export type Recurso = 'ECO' | 'GINE' | 'MAMO' | 'RX' | 'CONS';
export type EstadoServicio = 'ESPERA' | 'ATENCION' | 'FINALIZADO';

export const BOXES_CONSULTA = ['Consultorio 1', 'Consultorio 2'] as const;

export const RECURSOS: Record<Recurso, { grupo: GrupoClinico; etiqueta: string; boxes: readonly string[] }> = {
  ECO: { grupo: 'A', etiqueta: 'Ecografía', boxes: ['Sala de Ecografía'] },
  GINE: { grupo: 'A', etiqueta: 'Ginecología', boxes: ['Consultorio Ginecológico'] },
  MAMO: { grupo: 'B', etiqueta: 'Mamografía', boxes: ['Sala de Mamografía'] },
  RX: { grupo: 'B', etiqueta: 'Rayos X', boxes: ['Sala de Rayos X'] },
  CONS: { grupo: 'C', etiqueta: 'Consulta', boxes: BOXES_CONSULTA },
};

const RECURSO_POR_AREA: Record<string, Recurso> = {
  ECOGRAFIA_AM: 'ECO', ECOGRAFIA_PM: 'ECO', GINECOLOGIA: 'GINE', RADIOLOGIA: 'RX', MAMOGRAFIA: 'MAMO', CONSULTAS: 'CONS',
};

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

const RX_RE = /RAYOS|RADIOLOG|\bRX\b|TORAX|COLUMNA|CRANEO|CERVICAL|SENOS PARANASALES|PELVIS|RODILLA|\bPIE\b|\bMANO\b|HOMBRO|CADERA|EXTREMIDAD|COSTILLA|CLAVICULA|CODO|MUNECA|TOBILLO|FEMUR|TIBIA|ABDOMEN SIMPLE/;
const ECO_RE = /\bECO|ULTRASON|DOPPLER|ABDOMINAL|RENAL|RENOVESIC|TIROID|PROSTAT|PARTES BLANDAS|MAMARIO|\bCUELLO\b|MUSCULO ESQUELET|MORFOLOGIC|OBSTETRIC|TRANSVAGINAL|PELVIC|TESTICUL/;
const GINE_RE = /GINECO|CITOLOG|PAPANICOLAOU|COLPOSC|CONSULTA SOLA|CONSULTA COMPLETA|CONSULTA ?\+|RETIRO DE APARATO|BIOPSIA/;

/** Recurso y grupo de un servicio: por área del catálogo y, si falta, por palabras del nombre (sin tildes). */
export function clasificarServicio(estudio: string, area?: string): { recurso: Recurso; grupo: GrupoClinico } {
  const porArea = area ? RECURSO_POR_AREA[normalizar(area).replace(/\s+/g, '_')] : undefined;
  let recurso: Recurso;
  if (porArea) recurso = porArea;
  else {
    const t = normalizar(`${area ?? ''} ${estudio ?? ''}`);
    if (/MAMOGRAF|\bMAMO\b|DENSITOMETRIA/.test(t)) recurso = 'MAMO';
    else if (RX_RE.test(t)) recurso = 'RX';
    else if (ECO_RE.test(t)) recurso = 'ECO';
    else if (GINE_RE.test(t)) recurso = 'GINE';
    else recurso = 'CONS';
  }
  return { recurso, grupo: RECURSOS[recurso].grupo };
}

/** Clave del paciente (misma persona aunque tenga varias facturas el mismo día). */
export function clavePaciente(cedula: string | null | undefined, facturaId: number): string {
  const d = (cedula ?? '').replace(/\D/g, '');
  return d ? `c${d}` : `f${facturaId}`;
}

export interface TareaSala {
  id: number;
  factura_id: number;
  paciente: string;
  nombre: string;
  grupo: GrupoClinico;
  recurso: Recurso;
  medico: string | null;
  box: string | null;
  estado: EstadoServicio;
}

export type PlanLlamado =
  | { ok: true; asignaciones: { id: number; box: string }[] }
  | { ok: false; codigo: 'NO_ENCONTRADO' | 'ESTADO_INVALIDO' | 'GRUPO_MIXTO' | 'EN_OTRO_GRUPO' | 'BOX_OCUPADO' | 'MEDICO_OCUPADO'; mensaje: string };

const errPlan = (codigo: Extract<PlanLlamado, { ok: false }>['codigo'], mensaje: string): PlanLlamado => ({ ok: false, codigo, mensaje });

/**
 * Decide si se puede llamar a `ids` (todos del mismo paciente y grupo) y a qué sala va cada uno.
 * `abiertas` = todos los turnos activos (espera y atención) del sistema.
 */
export function planificarLlamado(ids: number[], abiertas: TareaSala[], boxSolicitado?: string): PlanLlamado {
  const seleccion = ids.map((id) => abiertas.find((t) => t.id === id));
  if (seleccion.length === 0 || seleccion.some((t) => !t)) return errPlan('NO_ENCONTRADO', 'El turno ya no está en la sala de espera.');
  const sel = seleccion as TareaSala[];
  if (sel.some((t) => t.estado !== 'ESPERA')) return errPlan('ESTADO_INVALIDO', 'El paciente ya fue llamado o atendido.');
  const { paciente, grupo, nombre } = sel[0];
  if (sel.some((t) => t.paciente !== paciente || t.grupo !== grupo)) {
    return errPlan('GRUPO_MIXTO', 'El llamado conjunto solo aplica a estudios del mismo paciente y del mismo grupo.');
  }

  const enOtroGrupo = abiertas.find((t) => t.paciente === paciente && t.estado === 'ATENCION' && t.grupo !== grupo);
  if (enOtroGrupo) {
    return errPlan('EN_OTRO_GRUPO',
      `${nombre} está en atención en ${RECURSOS[enOtroGrupo.recurso].etiqueta} (Grupo ${enOtroGrupo.grupo}). Culmínelo o márquelo como ausente antes de llamarlo a otro grupo.`);
  }

  // Salas ocupadas por OTROS pacientes (el mismo paciente puede compartir sala entre sus estudios).
  const ocupadas = new Map<string, string>();
  for (const t of abiertas) if (t.estado === 'ATENCION' && t.box && t.paciente !== paciente) ocupadas.set(t.box, t.nombre);

  const asignaciones: { id: number; box: string }[] = [];
  let boxConsulta: string | null = null;
  for (const t of sel) {
    let box: string;
    if (t.recurso === 'CONS') {
      if (!boxConsulta) {
        const candidatos = boxSolicitado && (BOXES_CONSULTA as readonly string[]).includes(boxSolicitado) ? [boxSolicitado] : [...BOXES_CONSULTA];
        const libre = candidatos.find((b) => !ocupadas.has(b));
        if (!libre) {
          return errPlan('BOX_OCUPADO', candidatos.length === 1
            ? `${candidatos[0]} está ocupado por ${ocupadas.get(candidatos[0])}.`
            : 'Ambos consultorios están ocupados. Culmine una consulta para llamar al siguiente paciente.');
        }
        boxConsulta = libre;
      }
      box = boxConsulta;
      const medicoOcupado = t.medico && abiertas.find((o) => o.estado === 'ATENCION' && o.paciente !== paciente && o.recurso === 'CONS' && o.medico === t.medico);
      if (medicoOcupado) return errPlan('MEDICO_OCUPADO', `${t.medico} ya está atendiendo a ${medicoOcupado.nombre}.`);
    } else {
      box = RECURSOS[t.recurso].boxes[0];
      if (ocupadas.has(box)) return errPlan('BOX_OCUPADO', `${box} está ocupada por ${ocupadas.get(box)}.`);
    }
    asignaciones.push({ id: t.id, box });
  }
  return { ok: true, asignaciones };
}

/** Turno por servicio tal como lo entrega /api/sala. */
export interface FilaSala {
  id: number; factura_id: number; idx: number; estudio: string; medico: string | null; grupo: 'A' | 'B' | 'C'; recurso: TareaSala['recurso'];
  box: string | null; estado: 'ESPERA' | 'ATENCION'; ausencias: number; retorno: boolean; orden_cola: string;
  turno_num: number | null; nombre_paciente: string | null; cedula_paciente: string | null; telefono_paciente: string | null;
  fecha_nacimiento_paciente: string | null; prioridad: string | null; fecha: string; hora: string | null;
}

export const aTarea = (r: FilaSala): TareaSala => ({
  id: r.id, factura_id: r.factura_id, paciente: clavePaciente(r.cedula_paciente, r.factura_id), nombre: r.nombre_paciente ?? 'Paciente',
  grupo: r.grupo, recurso: r.recurso, medico: r.medico, box: r.box, estado: r.estado,
});

