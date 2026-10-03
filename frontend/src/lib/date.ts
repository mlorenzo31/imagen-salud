/**
 * Utilidades de fecha y cálculo dinámico de edad en tiempo real
 */

/**
 * Calcula la edad real y exacta en años en base a la fecha actual
 * @param fechaNacimiento Fecha de nacimiento en formato YYYY-MM-DD, string ISO o Date
 * @returns Edad cronológica cumplida (entero >= 0)
 */
export function calcularEdadReal(fechaNacimiento: string | Date | undefined | null): number {
  if (!fechaNacimiento) return 0;

  let nacimiento: Date;
  if (typeof fechaNacimiento === 'string') {
    // Si viene en formato YYYY-MM-DD, parsear los componentes para evitar desfases de huso horario UTC
    const partes = fechaNacimiento.split('T')[0].split('-');
    if (partes.length === 3) {
      nacimiento = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    } else {
      nacimiento = new Date(fechaNacimiento);
    }
  } else {
    nacimiento = new Date(fechaNacimiento);
  }

  if (isNaN(nacimiento.getTime())) return 0;

  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }

  return Math.max(0, edad);
}

/**
 * Devuelve la edad formateada legiblemente
 * @example formatearEdad("1995-01-15") -> "31 años"
 */
export function formatearEdad(fechaNacimiento: string | Date | undefined | null): string {
  if (!fechaNacimiento) return 'Edad no disponible';
  const edad = calcularEdadReal(fechaNacimiento);
  return `${edad} años`;
}

/**
 * Formatea una fecha de nacimiento a formato venezolano estándar DD/MM/AAAA
 * @example formatearFechaNacimiento("1995-01-15") -> "15/01/1995"
 */
export function formatearFechaNacimiento(fechaNacimiento: string | Date | undefined | null): string {
  if (!fechaNacimiento) return '';
  if (typeof fechaNacimiento === 'string') {
    const partes = fechaNacimiento.split('T')[0].split('-');
    if (partes.length === 3) {
      return `${partes[2].padStart(2, '0')}/${partes[1].padStart(2, '0')}/${partes[0]}`;
    }
  }
  const d = new Date(fechaNacimiento);
  if (isNaN(d.getTime())) return String(fechaNacimiento);
  return d.toLocaleDateString('es-VE');
}

/**
 * Convierte cualquier fecha a formato YYYY-MM-DD para input type="date"
 */
export function aFormatoInputDate(fecha: string | Date | undefined | null): string {
  if (!fecha) return '';
  if (typeof fecha === 'string') {
    return fecha.split('T')[0];
  }
  try {
    return fecha.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

const ZONA_CLINICA = 'America/Caracas';

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la clínica. `toISOString()` devuelve UTC y adelanta el día después de las 8 p. m. */
export function hoyLocal(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CLINICA }).format(ahora);
}

/** Suma (o resta, con negativos) días a una fecha YYYY-MM-DD sin depender de la zona horaria del navegador. */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}
