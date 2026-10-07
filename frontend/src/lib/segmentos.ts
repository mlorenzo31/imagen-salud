import { z } from 'zod';
import { normalizarTelefono } from '@/lib/whatsapp';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.').nullish();
const entero = (min: number, max: number) => z.number().int().min(min).max(max).nullish();
const lista = z.array(z.string().trim().min(1).max(150)).max(40).default([]);

export const FiltrosSchema = z.object({
  edadMin: entero(0, 120),
  edadMax: entero(0, 120),
  incluirSinFecha: z.boolean().default(false),
  sexo: z.enum(['M', 'F', 'SIN']).nullish(),
  estudios: lista,
  areas: lista,
  medicos: lista,
  ultimaVisitaDesde: fecha,
  ultimaVisitaHasta: fecha,
  inactivoDias: entero(1, 3650),
  visitasMin: entero(0, 1000),
  visitasMax: entero(0, 1000),
  gastoMinUsd: z.number().min(0).max(1_000_000).nullish(),
  gastoMaxUsd: z.number().min(0).max(1_000_000).nullish(),
  busqueda: z.string().trim().max(80).nullish(),
});
export type Filtros = z.infer<typeof FiltrosSchema>;

export interface PacienteSegmento {
  cedula: string;
  nombre: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
  sexo: 'M' | 'F' | null;
  edad: number | null;
  visitas: number;
  gasto_cents: number;
  ultima_visita: string | null;
  estudios: string[];
  medicos: string[];
  areas: string[];
  /** Número válido y sin baja registrada. */
  contactable: boolean;
}

export const RANGOS_ETARIOS = [
  { id: '0-17', etiqueta: '0–17', min: 0, max: 17 },
  { id: '18-29', etiqueta: '18–29', min: 18, max: 29 },
  { id: '30-44', etiqueta: '30–44', min: 30, max: 44 },
  { id: '45-59', etiqueta: '45–59', min: 45, max: 59 },
  { id: '60-74', etiqueta: '60–74', min: 60, max: 74 },
  { id: '75+', etiqueta: '75+', min: 75, max: 120 },
] as const;

export function rangoEtario(edad: number | null): string {
  if (edad === null) return 'Sin fecha';
  return RANGOS_ETARIOS.find((r) => edad >= r.min && edad <= r.max)?.etiqueta ?? 'Sin fecha';
}

/** Edad cumplida a la fecha `hoy` (YYYY-MM-DD). null si no hay fecha de nacimiento válida. */
export function calcularEdad(nacimiento: string | null | undefined, hoy: string): number | null {
  if (!nacimiento || !/^\d{4}-\d{2}-\d{2}/.test(nacimiento)) return null;
  const [ny, nm, nd] = nacimiento.slice(0, 10).split('-').map(Number);
  const [hy, hm, hd] = hoy.split('-').map(Number);
  let edad = hy - ny;
  if (hm < nm || (hm === nm && hd < nd)) edad--;
  return edad >= 0 && edad <= 120 ? edad : null;
}

export interface ResumenSegmento {
  total: number;
  contactables: number;
  sinTelefono: number;
  conBaja: number;
  porRango: { etiqueta: string; total: number }[];
  porSexo: { etiqueta: string; total: number }[];
  porArea: { etiqueta: string; total: number }[];
  porMedico: { etiqueta: string; total: number }[];
}

function contar(items: string[]): { etiqueta: string; total: number }[] {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m].map(([etiqueta, total]) => ({ etiqueta, total })).sort((a, b) => b.total - a.total);
}

export function resumirSegmento(pacientes: PacienteSegmento[], conBaja: number): ResumenSegmento {
  const orden = [...RANGOS_ETARIOS.map((r) => r.etiqueta), 'Sin fecha'] as string[];
  const porRango = contar(pacientes.map((p) => rangoEtario(p.edad))).sort((a, b) => orden.indexOf(a.etiqueta) - orden.indexOf(b.etiqueta));
  return {
    total: pacientes.length,
    contactables: pacientes.filter((p) => p.contactable).length,
    sinTelefono: pacientes.filter((p) => !normalizarTelefono(p.telefono)).length,
    conBaja,
    porRango,
    porSexo: contar(pacientes.map((p) => (p.sexo === 'F' ? 'Mujeres' : p.sexo === 'M' ? 'Hombres' : 'Sin dato'))),
    porArea: contar(pacientes.flatMap((p) => p.areas)).slice(0, 12),
    porMedico: contar(pacientes.flatMap((p) => p.medicos)).slice(0, 12),
  };
}

export const PIE_BAJA = '_Responda BAJA para no recibir más mensajes._';
export const MAX_DESTINATARIOS = 500;

/** Primer nombre con inicial mayúscula ("MARIA JOSE PEREZ" → "Maria"). */
export function primerNombre(nombre: string): string {
  const p = nombre.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
}

/** Reemplaza {nombre} y agrega el pie de baja obligatorio. */
export function personalizarMensaje(plantilla: string, nombre: string): string {
  const cuerpo = plantilla.replace(/\{nombre\}/gi, primerNombre(nombre) || 'paciente').trim();
  return `${cuerpo}\n\n${PIE_BAJA}`;
}
