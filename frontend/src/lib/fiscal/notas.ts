/**
 * Notas de crédito y débito (arts. 12-13): se emiten por el mismo medio que la factura, con su mismo receptor
 * y tipo de cambio, y referencian su fecha, número, N° de control y monto.
 */
import { construirNota, type ConfigEmisor, type DocumentoFiscal, type LineaEntrada } from './factura';
import { lineasDeCobro, type CobroDiferido } from './emision';

interface Base { numero: string; fecha: string; hora: string; motivo: string; emisor: ConfigEmisor; original: DocumentoFiscal; acreditadoPrevioUsd: number }

/** NC total por la anulación de un cobro: sus líneas (en la consolidada, solo las de ese paciente). */
export function notaCreditoPorAnulacion(p: Base & { cobro: CobroDiferido; consolidada: boolean }): DocumentoFiscal {
  return construirNota({
    tipo: 'NOTA_CREDITO', numero: p.numero, numeroControl: null, fechaAsignacionControl: null, fecha: p.fecha, hora: p.hora,
    motivo: `Anulación del cobro #${p.cobro.id}: ${p.motivo.trim() || 'sin motivo indicado'}`,
    original: p.original, emisor: p.emisor, acreditadoPrevioUsd: p.acreditadoPrevioUsd,
    lineas: lineasDeCobro(p.cobro, p.consolidada),
  });
}

/** Nota manual de ajuste (crédito parcial o débito) con una línea exenta por el monto indicado. */
export function notaAjuste(p: Base & { tipo: 'NOTA_CREDITO' | 'NOTA_DEBITO'; montoUsd: number }): DocumentoFiscal {
  if (!Number.isInteger(p.montoUsd) || p.montoUsd <= 0) throw new Error('El monto de la nota debe ser mayor a cero.');
  const linea: LineaEntrada = { codigo: 'AJUSTE', descripcion: p.motivo.trim(), cantidad: 1, precioUnitarioUsd: p.montoUsd, descuentoUsd: 0, alicuota: 0 };
  return construirNota({
    tipo: p.tipo, numero: p.numero, numeroControl: null, fechaAsignacionControl: null, fecha: p.fecha, hora: p.hora,
    motivo: p.motivo, original: p.original, emisor: p.emisor, acreditadoPrevioUsd: p.acreditadoPrevioUsd, lineas: [linea],
  });
}
