import { z } from 'zod';
import { normalizarCedulaRif } from '@/lib/cedulaRif';
import { CONFIG_EMISOR_DEFECTO, type ConfigEmisor } from './factura';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const texto = (max: number) => z.string().trim().min(1).max(max);

/** RIF con letra y 9 dígitos (8 + dígito verificador), normalizado sin guiones. */
const rif = (letras: string, msg: string) =>
  z.string().transform((v) => normalizarCedulaRif(v)).refine((v) => new RegExp(`^[${letras}]\\d{9}$`).test(v), msg);

/** Configuración del emisor (clínica) para la facturación fiscal. Se guarda en config_fiscal con clave 'emisor'. */
export const configEmisorSchema = z.object({
  razonSocial: texto(200),
  rif: rif('JG', 'El RIF del emisor debe ser jurídico (J) o gubernamental (G) con 9 dígitos.'),
  domicilioFiscal: texto(300),
  condicionIva: z.enum(['ORDINARIO', 'FORMAL']),
  percibeIgtf: z.boolean(),
  igtfPct: z.number().gt(0).max(10),
  leyendaProvidencia: texto(300),
  imprenta: z.object({
    razonSocial: texto(200),
    rif: rif('JG', 'RIF de la imprenta inválido.'),
    providencia: texto(60),
    fechaProvidencia: z.string().regex(ISO, 'Fecha AAAA-MM-DD.'),
  }).nullable(),
  inicioFacturacion: z.string().regex(ISO, 'Fecha AAAA-MM-DD.').nullable().default(null),
}) satisfies z.ZodType<ConfigEmisor, unknown>;

/** Lo guardado en BD completado con los valores por defecto (para versiones anteriores de la configuración). */
export function leerConfigGuardada(valor: unknown): ConfigEmisor {
  return { ...CONFIG_EMISOR_DEFECTO, ...(valor && typeof valor === 'object' ? (valor as Partial<ConfigEmisor>) : {}) };
}

/** "Facturar a": empresa o aseguradora que recibe la factura en lugar del paciente (art. 8.6). */
export const receptorAlternoSchema = z.object({
  razonSocial: texto(200),
  rif: rif('VEJGPC', 'RIF inválido (letra y 9 dígitos).'),
  domicilio: z.string().trim().max(300).optional(),
});
export type ReceptorAlterno = z.infer<typeof receptorAlternoSchema>;
