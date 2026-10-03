export interface ResultadoDespacho {
  modo: 'bot' | 'manual';
  encolados: number;
  omitidos: { id: number; motivo: string }[];
  /** Enlace público de resultados por factura (para el mensaje manual wa.me). */
  enlaces: Record<number, string>;
}

/** Encola resultados en el bot de WhatsApp. modo "manual" = bot apagado: usar el enlace wa.me como respaldo. */
export async function despacharWhatsApp(facturaIds: number[], telefono?: string): Promise<ResultadoDespacho> {
  try {
    const res = await fetch('/api/whatsapp/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factura_ids: facturaIds, telefono }),
    });
    if (!res.ok) return { modo: 'manual', encolados: 0, omitidos: [], enlaces: {} };
    return (await res.json()) as ResultadoDespacho;
  } catch {
    return { modo: 'manual', encolados: 0, omitidos: [], enlaces: {} };
  }
}

export const resumenOmitidos = (o: ResultadoDespacho['omitidos']) => o.map((x) => `#${x.id}: ${x.motivo}`).join('\n');
