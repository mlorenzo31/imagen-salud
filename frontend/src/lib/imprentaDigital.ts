/**
 * Módulo de Imprenta Digital (SENIAT / Facturación Electrónica Fiscal)
 * Controlado mediante Feature Flag: NEXT_PUBLIC_FEATURE_IMPRENTA_DIGITAL
 * Por defecto desactivado (false) para no alterar la operatividad de taquilla.
 */

export interface DatosFacturaFiscal {
  factura_id: number | string;
  fecha: string;
  hora: string;
  paciente_nombre: string;
  cedula_rif: string;
  direccion?: string;
  telefono?: string;
  items: Array<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    tasa_iva_pct: number;
    monto_total: number;
  }>;
  subtotal: number;
  iva_monto: number;
  total: number;
  moneda: 'BS' | 'USD';
  tasa_bcv: number;
  metodos_pago: {
    efectivo_usd?: number;
    efectivo_bs?: number;
    punto_de_venta?: number;
    pago_movil?: number;
  };
}

export interface RespuestaImprentaDigital {
  exito: boolean;
  numero_control_fiscal?: string;
  numero_factura_fiscal?: string;
  fecha_emision_fiscal?: string;
  hash_seguridad_qr?: string;
  mensaje?: string;
  modo_simulacion: boolean;
}

export class ClienteImprentaDigital {
  private static get isEnabled(): boolean {
    if (typeof window !== 'undefined') {
      const override = localStorage.getItem('cfg_imprenta_digital');
      if (override !== null) return override === 'true';
    }
    return process.env.NEXT_PUBLIC_FEATURE_IMPRENTA_DIGITAL === 'true';
  }

  public static isActivo(): boolean {
    return this.isEnabled;
  }

  public static toggleActivo(activo: boolean): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cfg_imprenta_digital', activo ? 'true' : 'false');
    }
  }

  /**
   * Envía la factura a la imprenta digital autorizada o retorna simulación si el flag está apagado
   */
  public static async emitirFacturaFiscal(datos: DatosFacturaFiscal): Promise<RespuestaImprentaDigital> {
    if (!this.isEnabled) {
      // Impresión desactivada por defecto
      return {
        exito: true,
        numero_control_fiscal: `00-${String(datos.factura_id).padStart(8, '0')}`,
        numero_factura_fiscal: `FAC-${String(datos.factura_id).padStart(6, '0')}`,
        fecha_emision_fiscal: new Date().toISOString(),
        mensaje: 'Impresión en taquilla desactivada por configuración (Feature Flag). Factura registrada en base de datos.',
        modo_simulacion: true
      };
    }

    try {
      const endpoint = process.env.NEXT_PUBLIC_IMPRENTA_DIGITAL_URL || '/api/fiscal/imprenta-digital';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor: 'IMPRENTA_DIGITAL_SENIAT_V4',
          datos_emisor: {
            razon_social: 'CENTRO CLINICO RADIOLOGICO IMAGEN SALUD, C.A.',
            rif: 'J-40982145-0',
            direccion: 'Avenida Principal, Centro Médico Especializado'
          },
          factura: datos
        })
      });

      if (!res.ok) {
        throw new Error(`Error en servidor de imprenta: ${res.statusText}`);
      }

      return await res.json();
    } catch (err: any) {
      console.warn('Fallo al conectar con Imprenta Digital, usando modo contingencia:', err);
      return {
        exito: false,
        mensaje: `Error al emitir fiscalmente: ${err.message}`,
        modo_simulacion: true
      };
    }
  }
}
