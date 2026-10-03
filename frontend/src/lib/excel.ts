import { readSheet } from 'read-excel-file/universal';

export type Celda = string | number | boolean | null | undefined;
export type Fila = Record<string, Celda>;

export interface HojaExcel {
  nombreHoja: string;
  data: Fila[];
  /** Ancho mínimo de columna en caracteres (por defecto 14). */
  anchoMinimo?: number;
}

const valorCelda = (v: Celda): string | number | boolean | null => (v === undefined || v === '' ? null : v);

/** Descarga un .xlsx con una o varias hojas. Reemplaza a `xlsx` (con vulnerabilidades sin parche en npm). */
export async function descargarExcel(nombreArchivo: string, hojas: HojaExcel[]): Promise<void> {
  const sheets = hojas.map((h) => {
    const encabezados = h.data.length > 0 ? Object.keys(h.data[0]) : [];
    const filas = [
      encabezados.map((k) => ({ value: k, fontWeight: 'bold' as const })),
      ...h.data.map((fila) => encabezados.map((k) => valorCelda(fila[k]))),
    ];
    return {
      data: filas,
      sheet: h.nombreHoja.slice(0, 31),
      columns: encabezados.map((k) => ({ width: Math.max(k.length + 3, h.anchoMinimo ?? 14) })),
    };
  });
  // La librería acepta (datos, opciones) para una hoja o un arreglo de {data, sheet, columns} para varias.
  // Import dinámico: el escritor solo se carga en el navegador al exportar y no pesa en el bundle inicial.
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  await writeExcelFile(sheets as never).toFile(nombreArchivo);
}

const aTexto = (v: unknown): string | number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return v;
  return String(v).trim();
};

/** CSV mínimo (RFC 4180): comillas dobles, comas y saltos de línea dentro de campos. */
function parseCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  const limpio = texto.replace(/^﻿/, '');
  const sep = (limpio.split('\n', 1)[0].match(/;/g)?.length ?? 0) > (limpio.split('\n', 1)[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      filas.push(fila); fila = [];
    } else campo += c;
  }
  if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila); }
  return filas;
}

/** Lee la primera hoja de un .xlsx o .csv y la devuelve como objetos con las cabeceras de la fila 1. */
export async function leerHojaComoObjetos(contenido: ArrayBuffer, nombreArchivo: string): Promise<Record<string, string | number | undefined>[]> {
  const matriz: unknown[][] = /\.csv$/i.test(nombreArchivo)
    ? parseCsv(new TextDecoder('utf-8').decode(contenido))
    : ((await readSheet(contenido)) as unknown[][]);
  if (matriz.length < 2) return [];
  const cabeceras = matriz[0].map((h) => String(h ?? '').trim());
  return matriz.slice(1)
    .filter((fila) => fila.some((c) => aTexto(c) !== undefined))
    .map((fila) => {
      const obj: Record<string, string | number | undefined> = {};
      cabeceras.forEach((h, i) => { if (h) obj[h] = aTexto(fila[i]); });
      return obj;
    });
}
