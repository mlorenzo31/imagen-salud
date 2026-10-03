import pool from '@/lib/db';

export interface TasaBcv {
  tasa: number;
  fuente: string;
  fecha: string;
  /** true = obtenida ahora (o hace menos de 5 min) de un proveedor oficial. */
  exito: boolean;
  desactualizada?: boolean;
}

const TTL_MS = 5 * 60 * 1000;
let ultima: { dato: TasaBcv; en: number } | null = null;

const positivo = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  return res.ok ? res.json() : null;
}

async function desdeProveedores(): Promise<TasaBcv | null> {
  const principal = (await getJson('https://ve.dolarapi.com/v1/dolares/oficial').catch(() => null)) as
    { promedio?: unknown; fechaActualizacion?: string } | null;
  const t1 = positivo(principal?.promedio);
  if (t1) {
    return { tasa: t1, fuente: 'Banco Central de Venezuela (BCV Oficial)', fecha: principal?.fechaActualizacion || new Date().toISOString(), exito: true };
  }
  const respaldo = (await getJson('https://pydolarve.org/api/v1/dollar?page=bcv').catch(() => null)) as
    { monitors?: { usd?: { price?: unknown } } } | null;
  const t2 = positivo(respaldo?.monitors?.usd?.price);
  if (t2) return { tasa: t2, fuente: 'BCV Oficial (Respaldo PyDolar)', fecha: new Date().toISOString(), exito: true };
  return null;
}

/** Última tasa usada en una factura: sobrevive a reinicios y no requiere intervención humana. */
async function desdeUltimaFactura(): Promise<TasaBcv | null> {
  try {
    const r = await pool.query('SELECT tasa_bcv, fecha FROM facturas_caja WHERE tasa_bcv > 0 ORDER BY id DESC LIMIT 1');
    const t = positivo(r.rows[0]?.tasa_bcv);
    if (t) {
      return { tasa: t, fuente: 'Última tasa utilizada en facturación', fecha: new Date(r.rows[0].fecha).toISOString(), exito: false, desactualizada: true };
    }
  } catch (err) {
    console.error('No se pudo leer la última tasa de facturas_caja:', err);
  }
  return null;
}

/**
 * Cadena automática: proveedor oficial → proveedor de respaldo → última tasa en memoria → última tasa facturada.
 * Solo devuelve null en un sistema sin ninguna factura previa y con ambos proveedores caídos.
 */
export async function obtenerTasaBcv(): Promise<TasaBcv | null> {
  if (ultima && Date.now() - ultima.en < TTL_MS) return ultima.dato;

  const fresca = await desdeProveedores();
  if (fresca) {
    ultima = { dato: fresca, en: Date.now() };
    return fresca;
  }
  if (ultima) return { ...ultima.dato, fuente: `${ultima.dato.fuente} (última conocida)`, exito: false, desactualizada: true };
  return desdeUltimaFactura();
}
