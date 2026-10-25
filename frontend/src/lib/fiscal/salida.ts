/**
 * Verificación de salida a producción (Fase 8): qué falta para facturar conforme a la Providencia antes de su
 * vigencia. FALTA bloquea la salida; AVISO se puede resolver después.
 */
import type { ConfigEmisor } from './factura';

/** Entrada en vigencia de la Providencia (G.O. 21/10/2026 + 180 días). */
export const VIGENCIA = '2027-04-19';
/** Por debajo de esta cantidad de formatos disponibles se avisa para pedir otro talonario. */
const MIN_FORMATOS = 50;

export type EstadoItem = 'OK' | 'FALTA' | 'AVISO';
export interface ItemSalida { id: string; titulo: string; estado: EstadoItem; detalle: string }

export interface DatosSalida {
  hoy: string;
  emisor: ConfigEmisor;
  env: Partial<Record<string, string | undefined>>;
  talonarios: Array<{ serie: string; disponibles: number }>;
  estudiosSinCodigo: number;
  documentosRechazados: number;
  documentosPendientes: number;
  contingenciaVencida: boolean;
  proveedoresSinCorreo: number;
}

const dias = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

export function verificarSalida(d: DatosSalida): { items: ItemSalida[]; lista: boolean; diasParaVigencia: number } {
  const e = d.emisor;
  const items: ItemSalida[] = [];
  const add = (id: string, titulo: string, estado: EstadoItem, detalle: string) => items.push({ id, titulo, estado, detalle });

  const faltan = [!e.razonSocial && 'razón social', !e.rif && 'RIF', !e.domicilioFiscal && 'domicilio fiscal', !e.leyendaProvidencia && 'leyenda (art. 19)'].filter(Boolean);
  add('emisor', 'Datos fiscales de la clínica', faltan.length ? 'FALTA' : 'OK',
    faltan.length ? `Falta: ${faltan.join(', ')}.` : `${e.razonSocial} · ${e.rif} · ${e.condicionIva === 'FORMAL' ? 'contribuyente formal' : 'contribuyente ordinario'}${e.percibeIgtf ? ` · IGTF ${e.igtfPct}%` : ''}.`);

  add('imprenta', 'Imprenta digital autorizada (art. 9.3)', e.imprenta ? 'OK' : 'FALTA',
    e.imprenta ? `${e.imprenta.razonSocial} · ${e.imprenta.rif} · ${e.imprenta.providencia}.` : 'Registre la imprenta en Catálogos → Datos fiscales.');

  const p = d.env.FISCAL_PROVEEDOR?.trim();
  if (!p) add('proveedor', 'Conexión con la imprenta (FISCAL_PROVEEDOR)', 'FALTA', 'La emisión fiscal está desactivada.');
  else if (p === 'simulado') {
    add('proveedor', 'Conexión con la imprenta (FISCAL_PROVEEDOR)', d.env.NODE_ENV === 'production' ? 'FALTA' : 'AVISO',
      'El proveedor simulado no emite documentos válidos: configure el adaptador de la imprenta.');
  } else add('proveedor', 'Conexión con la imprenta (FISCAL_PROVEEDOR)', 'OK', `Proveedor: ${p}.`);

  if (!e.inicioFacturacion) add('inicio', 'Inicio de la facturación fiscal', 'FALTA', `Defina la fecha (a más tardar el ${VIGENCIA}).`);
  else if (e.inicioFacturacion > VIGENCIA) add('inicio', 'Inicio de la facturación fiscal', 'FALTA', `El ${e.inicioFacturacion} es posterior a la vigencia (${VIGENCIA}).`);
  else add('inicio', 'Inicio de la facturación fiscal', 'OK', `Desde el ${e.inicioFacturacion}.`);

  const disponibles = d.talonarios.reduce((a, t) => a + t.disponibles, 0);
  add('talonarios', 'Talonarios de contingencia (art. 6, parágrafo único)',
    d.talonarios.length === 0 ? 'FALTA' : disponibles < MIN_FORMATOS ? 'AVISO' : 'OK',
    d.talonarios.length === 0 ? 'Debe haber formatos de contingencia en la clínica.'
      : `${disponibles} formato(s) disponibles (series ${d.talonarios.map((t) => t.serie).join(', ')})${disponibles < MIN_FORMATOS ? ': pida otro talonario a la imprenta.' : '.'}`);

  add('documentos', 'Documentos fiscales al día',
    d.documentosRechazados ? 'FALTA' : d.documentosPendientes ? 'AVISO' : 'OK',
    d.documentosRechazados ? `${d.documentosRechazados} rechazado(s) por la imprenta: corríjalos en Control Fiscal.`
      : d.documentosPendientes ? `${d.documentosPendientes} pendiente(s) de envío.` : 'Sin rechazos ni pendientes.');

  add('contingencia', 'Contingencias remitidas (art. 7)', d.contingenciaVencida ? 'FALTA' : 'OK',
    d.contingenciaVencida ? 'Hay una contingencia con el plazo de remisión vencido.' : 'Sin contingencias vencidas.');

  add('codigos', 'Código de operación de los estudios (art. 9.2)', d.estudiosSinCodigo ? 'AVISO' : 'OK',
    d.estudiosSinCodigo ? `${d.estudiosSinCodigo} estudio(s) activos sin código: la factura usa su área.` : 'Todos los estudios activos tienen código.');

  add('correos', 'Correo de los proveedores (art. 18.4)', d.proveedoresSinCorreo ? 'AVISO' : 'OK',
    d.proveedoresSinCorreo ? `${d.proveedoresSinCorreo} proveedor(es) activos sin correo: el comprobante de retención lo exige.` : 'Todos tienen correo.');

  return { items, lista: items.every((i) => i.estado !== 'FALTA'), diasParaVigencia: dias(d.hoy, VIGENCIA) };
}
