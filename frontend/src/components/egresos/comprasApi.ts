/** Llamadas del cliente a la API de compras: devuelven el JSON o lanzan el mensaje de error del servidor. */
export async function pedir<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(url, {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? 'No se pudo completar la operación.');
  return j as T;
}

export interface Proveedor {
  id: number; rif: string; razon_social: string; direccion: string | null; telefono: string | null;
  tipo_persona: 'NATURAL' | 'JURIDICA'; contribuyente_especial: boolean; activo: boolean;
}
export interface ProductoCompra { id: number; nombre: string; categoria: string; alicuota_defecto: number; proveedor_id: number | null; activo: boolean }
export interface FacturaCompraFila {
  id: number; proveedor_id: number; rif: string; razon_social: string; numero_factura: string; numero_control: string | null; fecha: string;
  moneda: 'BS' | 'USD'; tasa: string; total: string; neto_a_pagar: string; pagado: string; pendiente: string; condicion: string;
  vencimiento: string | null; estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'ANULADA'; comprobante_retencion: string | null;
}

export const fmt = (n: number | string, moneda: 'BS' | 'USD' = 'BS') =>
  `${moneda === 'USD' ? '$' : 'Bs. '}${Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
