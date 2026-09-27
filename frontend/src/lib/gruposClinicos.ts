/**
 * Arquitectura de Grupos Clínicos de Imagen Salud
 * Mapeo estricto, salas asignadas y colores oficiales
 */

export type GrupoClinico = 'A' | 'B' | 'C';

export interface InfoGrupoClinico {
  codigo: GrupoClinico;
  nombre: string;
  nombreCorto: string;
  subtitulo: string;
  boxConsultorioDefecto: string;
  colorHex: string;
  colorTexto: string;
  colorFondoSuave: string;
  colorBorde: string;
  prefijoTicket: string;
}

export const GRUPOS_CLINICOS: Record<GrupoClinico, InfoGrupoClinico> = {
  A: {
    codigo: 'A',
    nombre: 'Grupo A: Ginecología y Ecografía',
    nombreCorto: 'Ginecología & Ecografía',
    subtitulo: 'Ecografía General, Doppler, Obstetricia y Ginecología (AM y PM)',
    boxConsultorioDefecto: 'Box Ecografía 1 / Sala Ginecológica',
    colorHex: '#80DDD2',
    colorTexto: '#1D7A70',
    colorFondoSuave: '#EBF9F7',
    colorBorde: '#80DDD2',
    prefijoTicket: 'A'
  },
  B: {
    codigo: 'B',
    nombre: 'Grupo B: Mamografía y Radiología',
    nombreCorto: 'Mamografía & Rayos X',
    subtitulo: 'Mamografía Digitalizada y Radiología Especializada',
    boxConsultorioDefecto: 'Sala Mamografía / Rayos X',
    colorHex: '#9BCEDF',
    colorTexto: '#0369A1',
    colorFondoSuave: '#F0F9FF',
    colorBorde: '#9BCEDF',
    prefijoTicket: 'B'
  },
  C: {
    codigo: 'C',
    nombre: 'Grupo C: Consultas Médicas',
    nombreCorto: 'Consultas Médicas Especializadas',
    subtitulo: 'Consultorios Médicos Especializados',
    boxConsultorioDefecto: 'Consultorio Médico Principal',
    colorHex: '#C4B5FD',
    colorTexto: '#6D28D9',
    colorFondoSuave: '#F5F3FF',
    colorBorde: '#DDD6FE',
    prefijoTicket: 'C'
  }
};

/**
 * Mapea de manera inequívoca cualquier estudio o área a uno de los 3 grupos clínicos:
 * Grupo A: Ginecología y Ecografía (AM y PM)
 * Grupo B: Mamografía y Radiología (Rayos X)
 * Grupo C: Consultas Médicas Especializadas
 */
export function mapearEstudioAGrupo(estudio: string, area?: string): GrupoClinico {
  const t = `${area || ''} ${estudio || ''}`.toUpperCase();

  // 1. Grupo A: Ginecología y Ecografías (AM y PM)
  if (
    t.includes('ECOGRAFIA') ||
    t.includes('ECO') ||
    t.includes('DOPPLER') ||
    t.includes('GINECOLOGIA') ||
    t.includes('GINECO') ||
    t.includes('OBSTETRIC') ||
    t.includes('PELVIC') ||
    t.includes('TRANSVAGINAL') ||
    t.includes('ABDOMINAL') ||
    t.includes('RENAL') ||
    t.includes('TIROIDEO') ||
    t.includes('PROSTATICO') ||
    t.includes('PARTES BLANDAS') ||
    t.includes('MAMA') && !t.includes('MAMOGRAFIA')
  ) {
    return 'A';
  }

  // 2. Grupo B: Mamografía y Radiología (Rayos X)
  if (
    t.includes('MAMOGRAFIA') ||
    t.includes('MAMO') ||
    t.includes('RADIOLOGIA') ||
    t.includes('RAYOS') ||
    t.includes('RX') ||
    t.includes('TORAX') ||
    t.includes('COLUMNA') ||
    t.includes('CRANEO') ||
    t.includes('EXTREMIDADES') ||
    t.includes('PELVIS OSEA') ||
    t.includes('DENSITOMETRIA')
  ) {
    return 'B';
  }

  // 3. Grupo C: Consultas Médicas Especializadas
  return 'C';
}

/**
 * Retorna el box o consultorio sugerido según el estudio y grupo
 */
export function inferirBoxConsultorio(grupo: GrupoClinico, estudio: string, medico?: string): string {
  const e = (estudio || '').toUpperCase();
  if (grupo === 'A') {
    if (e.includes('GINECO')) return 'Consultorio Ginecológico';
    if (e.includes('DOPPLER')) return 'Box Ecografía 2 (Doppler)';
    return 'Box Ecografía 1';
  }
  if (grupo === 'B') {
    if (e.includes('MAMO')) return 'Sala de Mamografía Digital';
    return 'Sala de Rayos X';
  }
  // Grupo C
  if (medico) return `Consultorio • ${medico}`;
  return 'Consultorio Médico';
}
