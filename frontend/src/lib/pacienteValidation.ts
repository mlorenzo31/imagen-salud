/**
 * Utilitarios de validación y saneamiento de campos para Ficha de Paciente y Catálogos Clínicos.
 * Garantiza la obligatoriedad y el tipo de dato estricto según la característica de cada campo.
 */

export const REGEX_SOLO_DIGITOS = /^\d+$/;
export const REGEX_SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/;
export const REGEX_TELEFONO_VE = /^\d{10,11}$/;

/**
 * Limpia y restringe el valor del input de cédula/documento en tiempo real.
 * Si es V, E o J, solo permite dígitos numéricos (máximo 9).
 * Si es P (Pasaporte), permite caracteres alfanuméricos en mayúsculas (máximo 12).
 */
export function limpiarCedulaInput(valor: string, tipoDoc: string = 'V'): string {
  if (tipoDoc === 'P') {
    return valor.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);
  }
  return valor.replace(/\D/g, '').slice(0, 9);
}

/**
 * Limpia y restringe el valor del nombre en tiempo real.
 * Solo permite letras, acentos, espacios, puntos, apóstrofes y guiones.
 * Bloquea números y convierte automáticamente a MAYÚSCULAS para una visual impecable.
 */
export function limpiarNombreInput(valor: string): string {
  return valor.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]/g, '').toUpperCase().slice(0, 100);
}

/**
 * Convierte cualquier texto general a MAYÚSCULAS en tiempo real.
 */
export function limpiarTextoGeneralInput(valor: string): string {
  return (valor || '').toUpperCase();
}

/**
 * Limpia y restringe el valor del teléfono en tiempo real.
 * Solo permite dígitos numéricos (máximo 11 cifras para números venezolanos).
 * Bloquea letras y símbolos.
 */
export function limpiarTelefonoInput(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 11);
}

export interface FichaPacienteDatos {
  tipoDoc?: 'V' | 'E' | 'J' | 'P';
  cedula: string;
  nombre: string;
  fecha_nacimiento?: string;
  sexo?: string;
  telefono: string;
  direccion: string;
}

export interface FichaErrores {
  cedula?: string;
  nombre?: string;
  fecha_nacimiento?: string;
  sexo?: string;
  telefono?: string;
  direccion?: string;
}

/**
 * Valida de forma estricta la obligatoriedad y características de cada campo de la Ficha del Paciente.
 */
export function validarFichaPaciente(datos: FichaPacienteDatos): { valido: boolean; errores: FichaErrores } {
  const errores: FichaErrores = {};
  const tipoDoc = datos.tipoDoc || 'V';

  // 1. Validación de Cédula / Documento (Obligatorio, numérico si V/E/J)
  const cedulaLimpia = (datos.cedula || '').trim();
  if (!cedulaLimpia) {
    errores.cedula = 'La cédula o documento es obligatorio.';
  } else if (tipoDoc !== 'P') {
    if (!REGEX_SOLO_DIGITOS.test(cedulaLimpia)) {
      errores.cedula = 'La cédula debe contener únicamente números (sin letras ni símbolos).';
    } else if (cedulaLimpia.length < 5 || cedulaLimpia.length > 9) {
      errores.cedula = 'La cédula debe tener entre 5 y 9 dígitos numéricos.';
    }
  } else {
    if (cedulaLimpia.length < 5 || cedulaLimpia.length > 12) {
      errores.cedula = 'El pasaporte debe tener entre 5 y 12 caracteres alfanuméricos.';
    }
  }

  // 2. Validación de Nombre Completo (Obligatorio, solo letras, sin números)
  const nombreLimpio = (datos.nombre || '').trim();
  if (!nombreLimpio) {
    errores.nombre = 'El nombre completo es obligatorio.';
  } else if (/\d/.test(nombreLimpio)) {
    errores.nombre = 'El nombre no puede contener números.';
  } else if (!REGEX_SOLO_LETRAS.test(nombreLimpio)) {
    errores.nombre = 'El nombre solo puede contener letras y espacios válidos.';
  } else if (nombreLimpio.length < 3) {
    errores.nombre = 'El nombre debe tener al menos 3 caracteres.';
  }

  // 3. Validación de Fecha de Nacimiento (Obligatorio, no futura, fecha real)
  const fechaNac = (datos.fecha_nacimiento || '').trim();
  if (!fechaNac) {
    errores.fecha_nacimiento = 'La fecha de nacimiento es obligatoria.';
  } else {
    const fechaObj = new Date(fechaNac);
    if (isNaN(fechaObj.getTime())) {
      errores.fecha_nacimiento = 'Fecha de nacimiento inválida.';
    } else {
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      if (fechaObj > hoy) {
        errores.fecha_nacimiento = 'La fecha de nacimiento no puede ser en el futuro.';
      } else {
        const hace125 = new Date();
        hace125.setFullYear(hace125.getFullYear() - 125);
        if (fechaObj < hace125) {
          errores.fecha_nacimiento = 'Fecha de nacimiento fuera de rango biológico.';
        }
      }
    }
  }

  // 3b. Sexo (obligatorio: M o F)
  if (datos.sexo !== 'M' && datos.sexo !== 'F') {
    errores.sexo = 'Seleccione el sexo (M o F).';
  }

  // 4. Validación de Teléfono / Celular (Obligatorio, solo dígitos numéricos)
  const telefonoLimpio = (datos.telefono || '').replace(/\D/g, '');
  if (!datos.telefono || !datos.telefono.trim()) {
    errores.telefono = 'El teléfono o celular es obligatorio.';
  } else if (/[a-zA-Z]/.test(datos.telefono)) {
    errores.telefono = 'El teléfono no puede contener letras.';
  } else if (telefonoLimpio.length < 10 || telefonoLimpio.length > 11) {
    errores.telefono = 'El teléfono debe tener entre 10 y 11 dígitos numéricos (ej. 04141234567).';
  }

  // 5. Validación de Dirección / Residencia (Obligatorio, mínimo 5 caracteres)
  const direccionLimpia = (datos.direccion || '').trim();
  if (!direccionLimpia) {
    errores.direccion = 'La dirección de residencia es obligatoria.';
  } else if (direccionLimpia.length < 5) {
    errores.direccion = 'La dirección debe tener al menos 5 caracteres descriptivos.';
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores
  };
}
