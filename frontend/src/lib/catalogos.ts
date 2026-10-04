// Catálogo Clínico Oficial de Imagen Salud
// Migrado con paridad matemática y reglas de negocio exactas

export interface EstudioItem {
  nombre: string;
  precio: number;
  area: string;
  sala: string;
  dist: {
    imagen: number;
    medico: number;
    eco: number;
    patologo: number;
  };
}

export interface EspecialistaItem {
  nombre: string;
  especialidad?: string;
  precio?: number;
  pctMedico?: number;
}

export const ESTUDIOS_CLINICOS: Record<string, EstudioItem[]> = {
  ECOGRAFIA_AM: [
    { nombre: "Abdominal", precio: 20, area: "ECOGRAFIA_AM", sala: "SALA_ECO_AM", dist: { imagen: 0, medico: 6, eco: 14, patologo: 0 } },
    { nombre: "Renal", precio: 20, area: "ECOGRAFIA_AM", sala: "SALA_ECO_AM", dist: { imagen: 0, medico: 6, eco: 14, patologo: 0 } },
    { nombre: "Mamario", precio: 20, area: "ECOGRAFIA_AM", sala: "SALA_ECO_AM", dist: { imagen: 0, medico: 6, eco: 14, patologo: 0 } },
    { nombre: "Tiroideo", precio: 20, area: "ECOGRAFIA_AM", sala: "SALA_ECO_AM", dist: { imagen: 0, medico: 6, eco: 14, patologo: 0 } }
  ],
  ECOGRAFIA_PM: [
    { nombre: "Prostático", precio: 20, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 6, eco: 14, patologo: 0 } },
    { nombre: "Renovesico Prostatico", precio: 40, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 12, eco: 28, patologo: 0 } },
    { nombre: "Renovesical Prostatico Con Medición De Residuos", precio: 45, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 13.5, eco: 31.5, patologo: 0 } },
    { nombre: "Doppler Carotido", precio: 35, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 14, eco: 21, patologo: 0 } },
    { nombre: "Doppler Tiroideo", precio: 25, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 10, eco: 15, patologo: 0 } },
    { nombre: "Doppler Renal", precio: 35, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 14, eco: 21, patologo: 0 } },
    { nombre: "Doppler Testicular", precio: 25, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 10, eco: 15, patologo: 0 } },
    { nombre: "Doppler Hepatoesplenico", precio: 30, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 12, eco: 18, patologo: 0 } },
    { nombre: "Doppler Arterial", precio: 30, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 12, eco: 18, patologo: 0 } },
    { nombre: "Doppler Venoso", precio: 30, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 12, eco: 18, patologo: 0 } },
    { nombre: "Doppler Arterial Y Venoso 2 Miembros", precio: 50, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 20, eco: 30, patologo: 0 } },
    { nombre: "Doppler Arterial Y Venoso 1 Miembro", precio: 35, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 14, eco: 21, patologo: 0 } },
    { nombre: "Doppler Aorta Abdominal", precio: 35, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 14, eco: 21, patologo: 0 } },
    { nombre: "SOLO ECO", precio: 20, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 6, eco: 14, patologo: 0 } },
    { nombre: "DOPPLER OBSTETRICO", precio: 35, area: "ECOGRAFIA_PM", sala: "SALA_ECO_PM", dist: { imagen: 0, medico: 14, eco: 21, patologo: 0 } }
  ],
  RADIOLOGIA: [
    { nombre: "Tórax PA (1 Proyección)", precio: 25, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 25, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Tórax PA y Lateral (2 Proyecciones)", precio: 30, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 30, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Cráneo AP y Lateral (2 Proyecciones)", precio: 30, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 30, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Cervical AP y Lateral (2 Proyecciones)", precio: 30, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 30, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Columna Dorsal AP y Lateral (2 Proyecciones)", precio: 30, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 30, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Columna Lumbar AP y Lateral (2 Proyecciones)", precio: 30, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 30, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Columna Dorso Lumbar AP y Lateral", precio: 40, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 40, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Senos Paranasales (3 Proyecciones)", precio: 35, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 35, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Pelvis AP (1 Proyección)", precio: 25, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 25, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Pelvis AP y Rana (2 Proyecciones)", precio: 35, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 35, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Rodilla AP y Lateral (2 Proyecciones)", precio: 30, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 30, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Pie AP y Oblicuas (2 Proyecciones)", precio: 30, area: "RADIOLOGIA", sala: "SALA_RAYOS_X", dist: { imagen: 30, medico: 0, eco: 0, patologo: 0 } }
  ],
  MAMOGRAFIA: [
    { nombre: "Mamografía Digital", precio: 25, area: "MAMOGRAFIA", sala: "SALA_MAMOGRAFIA", dist: { imagen: 25, medico: 0, eco: 0, patologo: 0 } },
    { nombre: "Mamografía Digital (Prótesis)", precio: 25, area: "MAMOGRAFIA", sala: "SALA_MAMOGRAFIA", dist: { imagen: 25, medico: 0, eco: 0, patologo: 0 } }
  ],
  GINECOLOGIA: [
    { nombre: "CONSULTA COMPLETA", precio: 50, area: "GINECOLOGIA", sala: "CONSULTORIO_GINECO", dist: { imagen: 13, medico: 18, eco: 14, patologo: 5 } },
    { nombre: "CONSULTA SOLA", precio: 20, area: "GINECOLOGIA", sala: "CONSULTORIO_GINECO", dist: { imagen: 12, medico: 8, eco: 0, patologo: 0 } },
    { nombre: "CONSULTA+ ECO", precio: 35, area: "GINECOLOGIA", sala: "CONSULTORIO_GINECO", dist: { imagen: 9, medico: 12, eco: 14, patologo: 0 } },
    { nombre: "SOLO ECO", precio: 20, area: "GINECOLOGIA", sala: "CONSULTORIO_GINECO", dist: { imagen: 0, medico: 6, eco: 14, patologo: 0 } },
    { nombre: "CONSULTA +CITOLOGIA", precio: 35, area: "GINECOLOGIA", sala: "CONSULTORIO_GINECO", dist: { imagen: 16, medico: 14, eco: 0, patologo: 5 } },
    { nombre: "CITOLOGIA", precio: 25, area: "GINECOLOGIA", sala: "CONSULTORIO_GINECO", dist: { imagen: 12, medico: 8, eco: 0, patologo: 5 } },
    { nombre: "RETIRO DE APARATO", precio: 50, area: "GINECOLOGIA", sala: "CONSULTORIO_GINECO", dist: { imagen: 30, medico: 20, eco: 0, patologo: 0 } },
    { nombre: "DOPPLER OBSTETRICO", precio: 35, area: "GINECOLOGIA", sala: "CONSULTORIO_GINECO", dist: { imagen: 0, medico: 14, eco: 21, patologo: 0 } },
    { nombre: "MORFOLOGICO SABADO", precio: 45, area: "GINECOLOGIA", sala: "CONSULTORIO_GINECO", dist: { imagen: 0, medico: 13.5, eco: 31.5, patologo: 0 } },
    { nombre: "BIOPSIA", precio: 160, area: "GINECOLOGIA", sala: "CONSULTORIO_GINECO", dist: { imagen: 50, medico: 50, eco: 0, patologo: 60 } }
  ]
};

export const ESPECIALISTAS_MEDICOS: Record<string, EspecialistaItem[]> = {
  CONSULTAS: [
    { nombre: "Tania De Leon", precio: 55, pctMedico: 0.70, especialidad: "Medicina Interna" },
    { nombre: "Augusto Soto", precio: 40, pctMedico: 0.70, especialidad: "Cardiología" },
    { nombre: "Carlos Cardona", precio: 60, pctMedico: 0.60, especialidad: "Traumatología" },
    { nombre: "Yuliana Romero", precio: 25, pctMedico: 0.70, especialidad: "Medicina General" },
    { nombre: "Maria Piña", precio: 30, pctMedico: 0.70, especialidad: "Pediatría" }
  ],
  GINECOLOGIA: [
    { nombre: "Stefany Mendez", especialidad: "Ginecología & Obstetricia" },
    { nombre: "Rosa Valdivieso", especialidad: "Ginecología & Obstetricia" },
    { nombre: "Rafael Bencomo", especialidad: "Ginecología & Obstetricia" },
    { nombre: "Iraima Macero", especialidad: "Ginecología & Obstetricia" },
    { nombre: "Oriana Armas", especialidad: "Ginecología & Obstetricia" },
    { nombre: "Darel Palacios", especialidad: "Ginecología & Obstetricia" },
    { nombre: "Dra. Silvia", especialidad: "Ginecología & Obstetricia" }
  ],
  ECOGRAFIA_AM: [{ nombre: "Dra. Silvia", especialidad: "Ecografía Matutina" }],
  ECOGRAFIA_PM: [{ nombre: "Dra. Carmen", especialidad: "Ecografía Vespertina" }],
  MAMOGRAFIA: [{ nombre: "Dra. Imagen", especialidad: "Especialista en Mamografía" }],
  RADIOLOGIA: [{ nombre: "Técnico Radiología", especialidad: "Radiología General" }]
};

export const PATOLOGO_OFICIAL = {
  nombre: "Dra. Carmen Rodríguez",
  especialidad: "Patología y Citología Clínica"
};
