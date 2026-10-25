/**
 * Contingencia (arts. 6, 7, 11 y 27 de la Providencia G.O. 21/10/2026): si la imprenta digital no se puede usar,
 * se factura en talonarios autorizados (N° de control preimpreso) y, al cesar, se registran todos los documentos
 * físicos y se remiten en PDF a la imprenta digital al día siguiente.
 */
import { z } from 'zod';
import { esNumeroControl, fechaFiscal } from './formato';
import type { DocumentoFiscal } from './factura';
import { rif } from './configEmisor';

/** Art. 6, numerales que aplican a la clínica. */
export const MOTIVOS_CONTINGENCIA = {
  ENERGIA: 'Falla prolongada del suministro eléctrico (art. 6.1)',
  INTERNET: 'Interrupción severa de internet o de la conectividad (art. 6.2)',
  AVERIA: 'Avería técnica comprobada del medio de facturación (art. 6.3)',
  MANTENIMIENTO: 'Mantenimiento crítico no programado del sistema digital central (art. 6.4)',
} as const;
export type MotivoContingencia = keyof typeof MOTIVOS_CONTINGENCIA;
export const motivoContingenciaSchema = z.enum(['ENERGIA', 'INTERNET', 'AVERIA', 'MANTENIMIENTO']);

export function leerControl(control: string): { identificador: number; secuencial: number } {
  if (!esNumeroControl(control)) throw new Error(`N° de control inválido: ${control} (formato 00-00000001).`);
  return { identificador: Number(control.slice(0, 2)), secuencial: Number(control.slice(3)) };
}

export interface RangoTalonario {
  serie: string;
  controlDesde: string;
  controlHasta: string;
  facturaDesde: number;
  facturaHasta: number;
}

/**
 * N° de factura que corresponde a un N° de control del talonario: ambos rangos tienen el mismo tamaño y avanzan
 * juntos (art. 27). `null` si el control no pertenece al talonario.
 */
export function numeroFacturaContingencia(t: RangoTalonario, control: string): number | null {
  if (!esNumeroControl(control)) return null;
  const c = leerControl(control), d = leerControl(t.controlDesde), h = leerControl(t.controlHasta);
  if (c.identificador !== d.identificador || c.secuencial < d.secuencial || c.secuencial > h.secuencial) return null;
  return t.facturaDesde + (c.secuencial - d.secuencial);
}

/** Dos talonarios no pueden compartir N° de control (numeración única del emisor, art. 27). */
export function rangosSeSolapan(a: Pick<RangoTalonario, 'controlDesde' | 'controlHasta'>, b: Pick<RangoTalonario, 'controlDesde' | 'controlHasta'>): boolean {
  const [ad, ah, bd, bh] = [a.controlDesde, a.controlHasta, b.controlDesde, b.controlHasta].map(leerControl);
  return ad.identificador === bd.identificador && ad.secuencial <= bh.secuencial && bd.secuencial <= ah.secuencial;
}

/** Art. 11.2. */
export function rangoControlTexto(t: Pick<RangoTalonario, 'controlDesde' | 'controlHasta'>): string {
  return `N° de Control desde el N° ${t.controlDesde} hasta el N° ${t.controlHasta}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const control = z.string().trim().refine(esNumeroControl, 'N° de control inválido (formato 00-00000001).');
const numeroDoc = z.number().int().min(1).max(99_999_999);

/** Talonario autorizado (art. 11.4-5 y art. 27), registrado por el admin. */
export const talonarioSchema = z.object({
  /** Art. 20: serie que distingue la numeración del talonario de la digital. */
  serie: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, 'Serie: 1 a 6 letras o dígitos.'),
  imprentaRazonSocial: z.string().trim().min(1).max(200),
  imprentaRif: rif('JG', 'RIF de la imprenta inválido.'),
  imprentaProvidencia: z.string().trim().min(1).max(60),
  imprentaFechaProvidencia: z.string().regex(ISO, 'Fecha AAAA-MM-DD.'),
  fechaElaboracion: z.string().regex(ISO, 'Fecha AAAA-MM-DD.'),
  controlDesde: control,
  controlHasta: control,
  facturaDesde: numeroDoc,
  facturaHasta: numeroDoc,
}).superRefine((t, ctx) => {
  const d = leerControl(t.controlDesde), h = leerControl(t.controlHasta);
  if (d.identificador !== h.identificador) ctx.addIssue({ code: 'custom', message: 'El N° de control inicial y el final deben tener el mismo identificador.' });
  else if (d.secuencial > h.secuencial) ctx.addIssue({ code: 'custom', message: 'El N° de control inicial es mayor que el final.' });
  else if (t.facturaDesde > t.facturaHasta) ctx.addIssue({ code: 'custom', message: 'El N° de factura inicial es mayor que el final.' });
  else if (h.secuencial - d.secuencial !== t.facturaHasta - t.facturaDesde) {
    ctx.addIssue({ code: 'custom', message: 'El rango de N° de control y el de N° de factura deben tener la misma cantidad de documentos.' });
  }
});
export type Talonario = z.infer<typeof talonarioSchema>;

/** Art. 7: los documentos físicos se remiten a la imprenta digital al día siguiente de cesar la contingencia. */
export function plazoEnvio(fechaFin: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaFin);
  if (!m) throw new Error(`Fecha inválida: ${fechaFin}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1)).toISOString().slice(0, 10);
}

export type EstadoContingencia = 'ACTIVA' | 'POR_ENVIAR' | 'VENCE_HOY' | 'VENCIDA' | 'ENVIADA';

export function estadoContingencia(c: { fechaFin: string | null; enviada: boolean }, hoy: string): EstadoContingencia {
  if (c.enviada) return 'ENVIADA';
  if (c.fechaFin === null) return 'ACTIVA';
  const plazo = plazoEnvio(c.fechaFin);
  return hoy < plazo ? 'POR_ENVIAR' : hoy === plazo ? 'VENCE_HOY' : 'VENCIDA';
}

/** Factura armada → documento en formato de contingencia: serie, imprenta del talonario y datos del art. 11. */
export function documentoContingencia(doc: DocumentoFiscal, t: Talonario): DocumentoFiscal {
  if (!doc.numeroControl || numeroFacturaContingencia(t, doc.numeroControl) === null) {
    throw new Error(`El N° de control ${doc.numeroControl ?? '(vacío)'} no pertenece al talonario serie ${t.serie}.`);
  }
  return {
    ...doc,
    serie: t.serie,
    imprenta: { razonSocial: t.imprentaRazonSocial, rif: t.imprentaRif, providencia: t.imprentaProvidencia, fechaProvidencia: fechaFiscal(t.imprentaFechaProvidencia) },
    contingencia: { rangoControl: rangoControlTexto(t), fechaElaboracion: fechaFiscal(t.fechaElaboracion) },
  };
}

/** GET /api/fiscal/contingencia: contingencia aún no remitida y talonarios activos. */
export interface RespuestaContingencia {
  contingencia: {
    id: number; motivo: MotivoContingencia; observacion: string | null; fechaInicio: string; horaInicio: string;
    fechaFin: string | null; horaFin: string | null; documentos: number; estado: EstadoContingencia; plazoEnvio: string | null; ultimoError: string | null;
  } | null;
  talonarios: Array<{ serie: string; controlDesde: string; controlHasta: string; usados: number }>;
}

/** Reporte de contingencias: si la remisión cumplió el plazo del art. 7 (fechas AAAA-MM-DD locales). */
export function cumplimientoEnvio(fechaFin: string | null, fechaEnvio: string | null): 'ACTIVA' | 'SIN_ENVIAR' | 'A_TIEMPO' | 'TARDE' {
  if (fechaFin === null) return 'ACTIVA';
  if (fechaEnvio === null) return 'SIN_ENVIAR';
  return fechaEnvio <= plazoEnvio(fechaFin) ? 'A_TIEMPO' : 'TARDE';
}
