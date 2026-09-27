/**
 * Utilidades canónicas para validación y normalización de Cédula y RIF
 * Formato estricto: sin guiones, sin puntos y sin espacios (ej. V23196410, J315046482, E84123456)
 */

/**
 * Extrae únicamente los dígitos de una cédula o RIF para comparaciones directas
 * @example "V-21.105.736" -> "21105736"
 * @example "V21105736" -> "21105736"
 * @example "21105736" -> "21105736"
 */
export function extraerDigitos(documento: string | number | undefined | null): string {
  if (!documento) return '';
  return String(documento).replace(/\D/g, '');
}

/**
 * Normaliza cualquier entrada de Cédula o RIF al formato estricto:
 * Prefijo y dígitos pegados, SIN guiones, SIN puntos y SIN espacios.
 * @example "V-23.196.410" -> "V23196410"
 * @example "23196410" -> "V23196410"
 * @example "v-23196410" -> "V23196410"
 * @example "J-31504648-2" -> "J315046482"
 * @example "j 31504648 2" -> "J315046482"
 * @example "E-84123456" -> "E84123456"
 */
export function normalizarCedulaRif(documento: string | number | undefined | null): string {
  if (!documento) return '';
  const str = String(documento).trim().toUpperCase();

  // Detectar letra de prefijo si existe al inicio
  const prefijoMatch = str.match(/^([VEJGP])/i);
  let prefijo = 'V';
  let resto = str;

  if (prefijoMatch) {
    prefijo = prefijoMatch[1].toUpperCase();
    resto = str.slice(prefijoMatch[0].length);
  }

  // Extraer únicamente los dígitos
  const digitos = resto.replace(/\D/g, '');
  if (!digitos) return '';

  return `${prefijo}${digitos}`;
}

/**
 * Comprueba si dos identificadores de documento corresponden a la misma persona física o jurídica
 * @example sonMismoDocumento("23196410", "V23196410") -> true
 * @example sonMismoDocumento("V-23196410", "V23196410") -> true
 */
export function sonMismoDocumento(doc1: string | number | null | undefined, doc2: string | number | null | undefined): boolean {
  const d1 = extraerDigitos(doc1);
  const d2 = extraerDigitos(doc2);
  if (!d1 || !d2) return false;
  return d1 === d2;
}

/**
 * Valida si un documento tiene una estructura válida de Cédula o RIF
 */
export function validarEstructuraCedulaRif(documento: string | number | null | undefined): { valido: boolean; mensaje?: string } {
  if (!documento) {
    return { valido: false, mensaje: 'El documento de identidad es requerido.' };
  }
  const digitos = extraerDigitos(documento);
  if (digitos.length < 5) {
    return { valido: false, mensaje: 'El número de cédula o RIF debe tener al menos 5 dígitos.' };
  }
  if (digitos.length > 10) {
    return { valido: false, mensaje: 'El número de documento excede la longitud válida (máx 10 dígitos).' };
  }
  return { valido: true };
}
