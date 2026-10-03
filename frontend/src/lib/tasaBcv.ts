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
const ESPERA_MS = 2500;
let ultima: { dato: TasaBcv; en: number } | null = null;

const positivo = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
  return res.ok ? res.json() : null;
}

async function proveedorPrincipal(): Promise<TasaBcv> {
  const j = (await getJson('https://ve.dolarapi.com/v1/dolares/oficial')) as { promedio?: unknown; fechaActualizacion?: string } | null;
  const t = positivo(j?.promedio);
  if (!t) throw new Error('sin tasa');
  return { tasa: t, fuente: 'Banco Central de Venezuela (BCV Oficial)', fecha: j?.fechaActualizacion || new Date().toISOString(), exito: true };
}

async function proveedorRespaldo(): Promise<TasaBcv> {
  const j = (await getJson('https://pydolarve.org/api/v1/dollar?page=bcv')) as { monitors?: { usd?: { price?: unknown } } } | null;
  const t = positivo(j?.monitors?.usd?.price);
  if (!t) throw new Error('sin tasa');
  return { tasa: t, fuente: 'BCV Oficial (Respaldo PyDolar)', fecha: new Date().toISOString(), exito: true };
}

/** Consulta ambos proveedores en paralelo; gana el primero que responda con una tasa válida. */
async function desdeProveedores(): Promise<TasaBcv | null> {
  try {
    // El principal tiene prioridad: el respaldo solo cuenta si el principal falla.
    return await proveedorPrincipal().catch(() => proveedorRespaldo());
  } catch {
    return null;
  }
}

/** Última tasa usada en una factura: sobrevive a reinicios y no requiere intervención humana. */
async function desdeUltimaFactura(): Promise<TasaBcv | null> {
  try {
    const r = await pool.query('SELECT tasa_bcv, fecha FROM facturas_caja WHERE tasa_bcv > 0 ORDER BY fecha DESC, id DESC LIMIT 1');
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

  // La consulta a proveedores sigue en segundo plano y alimenta la caché aunque la respuesta ya haya salido.
  const consulta = desdeProveedores().then((t) => {
    if (t) ultima = { dato: t, en: Date.now() };
    return t;
  });
  // Si un proveedor se cuelga, no se hace esperar al cajero: tras ESPERA_MS se responde con el respaldo local.
  const fresca = await Promise.race([consulta, new Promise<null>((r) => setTimeout(() => r(null), ESPERA_MS))]);
  if (fresca) return fresca;

  if (ultima) return { ...ultima.dato, fuente: `${ultima.dato.fuente} (última conocida)`, exito: false, desactualizada: true };
  return desdeUltimaFactura();
}
