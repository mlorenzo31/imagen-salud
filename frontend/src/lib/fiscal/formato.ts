/**
 * Formatos exigidos por la Providencia SENIAT de facturación (G.O. 21/10/2026).
 * Funciones puras: sin acceso a base de datos ni a la hora del sistema.
 */

/** Art. 8.5: fecha de emisión en 8 dígitos DDMMAAAA (se permiten separadores). `iso` = 'AAAA-MM-DD'. */
export function fechaFiscal(iso: string, separador = '/'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Fecha inválida: ${iso}`);
  const [, a, mm, d] = m;
  const fecha = new Date(Date.UTC(Number(a), Number(mm) - 1, Number(d)));
  if (fecha.getUTCFullYear() !== Number(a) || fecha.getUTCMonth() !== Number(mm) - 1 || fecha.getUTCDate() !== Number(d)) {
    throw new Error(`Fecha inválida: ${iso}`);
  }
  return [d, mm, a].join(separador);
}

/** Art. 8.5: hora de emisión HH.MM.SS en reloj de 12 horas, con a.m./p.m. `hora` = 'HH:MM[:SS]' (24 h). */
export function horaFiscal(hora: string): string {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hora.trim());
  if (!m) throw new Error(`Hora inválida: ${hora}`);
  const h = Number(m[1]), min = Number(m[2]), s = Number(m[3] ?? '0');
  if (h > 23 || min > 59 || s > 59) throw new Error(`Hora inválida: ${hora}`);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(h12)}.${dos(min)}.${dos(s)} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}

const MAX_SECUENCIAL = 99_999_999;

/** Arts. 9.1 y 27: N° de control = identificador de 2 dígitos + secuencial de hasta 8 (p. ej. 00-00000001). */
export function numeroControl(identificador: number, secuencial: number): string {
  if (!Number.isInteger(identificador) || identificador < 0 || identificador > 99) throw new Error(`Identificador de control inválido: ${identificador}`);
  if (!Number.isInteger(secuencial) || secuencial < 1 || secuencial > MAX_SECUENCIAL) throw new Error(`Secuencial de control inválido: ${secuencial}`);
  return `${String(identificador).padStart(2, '0')}-${String(secuencial).padStart(8, '0')}`;
}

export function esNumeroControl(valor: string): boolean {
  const m = /^(\d{2})-(\d{8})$/.exec(valor);
  return !!m && Number(m[2]) >= 1;
}

/** Art. 8.7: los bienes o servicios exentos, exonerados o no gravados llevan " (E)" junto a la descripción. */
export function marcarExento(descripcion: string): string {
  const d = descripcion.trim();
  return d.endsWith('(E)') ? d : `${d} (E)`;
}
