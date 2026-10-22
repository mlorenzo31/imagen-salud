/** Resultado fiscal que devuelve POST /api/facturas (campo `fiscal`). */
export interface ResultadoFiscalCobro {
  estado: 'EMITIDO' | 'PENDIENTE' | 'ERROR' | 'OMITIDO' | 'NO_EMITIDA' | 'DESACTIVADA' | 'DIFERIDA';
  facturarAntesDe?: string;
  numero?: string;
  numeroControl?: string;
  pdfUrl?: string | null;
  error?: string | null;
  aviso?: string | null;
}

export interface AvisoCaja { tipo: 'exito' | 'alerta' | 'error'; mensaje: string }

/** Mensaje para el cajero según cómo quedó la factura fiscal del cobro. */
export function avisoFiscal(f: ResultadoFiscalCobro | undefined): AvisoCaja | null {
  if (!f) return null;
  switch (f.estado) {
    case 'EMITIDO':
      return { tipo: 'exito', mensaje: `Factura fiscal N° ${f.numero} emitida · N° de control ${f.numeroControl}.` };
    case 'PENDIENTE':
    case 'OMITIDO':
      return { tipo: 'alerta', mensaje: `La factura fiscal N° ${f.numero} quedó pendiente de envío a la imprenta; se reintentará automáticamente.` };
    case 'ERROR':
      return { tipo: 'error', mensaje: `La imprenta rechazó la factura fiscal N° ${f.numero}: ${f.error}` };
    case 'NO_EMITIDA':
      return { tipo: 'error', mensaje: f.error ?? 'No se generó la factura fiscal.' };
    case 'DIFERIDA':
      return { tipo: 'alerta', mensaje: `Factura fiscal diferida: debe emitirse antes del ${f.facturarAntesDe} (Control Fiscal).` };
    case 'DESACTIVADA':
      return f.aviso ? { tipo: 'error', mensaje: `Facturación fiscal: ${f.aviso}` } : null;
  }
}
