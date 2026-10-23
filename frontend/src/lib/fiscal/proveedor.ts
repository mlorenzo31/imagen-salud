/**
 * Proveedor de emisión fiscal (imprenta digital autorizada, art. 4.1.2 de la Providencia G.O. 21/10/2026).
 * Solo servidor: las credenciales viven en variables de entorno y nunca llegan al navegador.
 * El adaptador de la imprenta elegida se agrega aquí implementando `ProveedorFiscal`.
 */
import { esNumeroControl, numeroControl } from './formato';
import type { DocumentoFiscal } from './factura';

export interface SolicitudEmision {
  /** Id del documento en documentos_fiscales: clave de idempotencia ante reintentos. */
  id: number;
  documento: DocumentoFiscal;
  /** Fecha local de hoy (AAAA-MM-DD). */
  hoy: string;
}

export interface RespuestaEmision {
  numeroControl: string;
  /** Fecha de asignación del N° de control (AAAA-MM-DD). */
  fechaAsignacion: string;
  pdfUrl?: string | null;
  qr?: string | null;
  crudo?: unknown;
}

/** Art. 7: documentos emitidos en físico durante una contingencia, con su relación en PDF. */
export interface SolicitudContingencia {
  /** Id de la contingencia: clave de idempotencia ante reintentos. */
  contingenciaId: number;
  documentos: DocumentoFiscal[];
  pdf: Uint8Array;
  hoy: string;
}

export interface ProveedorFiscal {
  nombre: string;
  emitir(s: SolicitudEmision): Promise<RespuestaEmision>;
  registrarContingencia(s: SolicitudContingencia): Promise<{ crudo?: unknown }>;
}

/** La imprenta rechazó el documento (datos inválidos): reintentar no sirve, hay que corregirlo. */
export class ErrorRechazo extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorRechazo';
  }
}

export function validarRespuesta(r: RespuestaEmision): RespuestaEmision {
  if (!esNumeroControl(r.numeroControl)) throw new ErrorRechazo(`La imprenta devolvió un N° de control inválido: ${r.numeroControl}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fechaAsignacion)) throw new ErrorRechazo(`La imprenta devolvió una fecha de asignación inválida: ${r.fechaAsignacion}`);
  return r;
}

/**
 * Simulado para demo y pruebas: N° de control 00-<id del documento>. NO es un documento fiscal válido;
 * en producción solo se usa con FISCAL_PERMITIR_SIMULADO=true (p. ej. un ambiente de demostración).
 */
export const proveedorSimulado: ProveedorFiscal = {
  nombre: 'simulado',
  async emitir({ id, hoy }) {
    return { numeroControl: numeroControl(0, id), fechaAsignacion: hoy, pdfUrl: null, qr: null, crudo: { simulado: true } };
  },
  async registrarContingencia({ documentos, pdf }) {
    return { crudo: { simulado: true, documentos: documentos.length, bytesPdf: pdf.length } };
  },
};

type Env = Partial<Record<string, string | undefined>>;

/** Proveedor configurado en FISCAL_PROVEEDOR; `null` = emisión fiscal desactivada. */
export function obtenerProveedor(env: Env = process.env): ProveedorFiscal | null {
  const p = env.FISCAL_PROVEEDOR?.trim();
  if (!p) return null;
  if (p === 'simulado') {
    if (env.NODE_ENV === 'production' && env.FISCAL_PERMITIR_SIMULADO !== 'true') {
      throw new Error('El proveedor fiscal "simulado" no emite documentos válidos: en producción requiere FISCAL_PERMITIR_SIMULADO=true.');
    }
    return proveedorSimulado;
  }
  throw new Error(`Proveedor fiscal desconocido: ${p}`);
}
