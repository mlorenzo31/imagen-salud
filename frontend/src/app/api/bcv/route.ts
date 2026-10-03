import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TasaCache { tasa: number; fuente: string; fecha: string }
// Última tasa obtenida con éxito (memoria del proceso). Nunca se inventa una tasa por defecto.
let ultimaTasa: TasaCache | null = null;

async function consultar(url: string): Promise<unknown> {
  const res = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
  return res.ok ? res.json() : null;
}

const positivo = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function GET() {
  try {
    const principal = (await consultar('https://ve.dolarapi.com/v1/dolares/oficial').catch(() => null)) as
      { promedio?: unknown; fechaActualizacion?: string } | null;
    const tasaPrincipal = positivo(principal?.promedio);
    if (tasaPrincipal) {
      ultimaTasa = { tasa: tasaPrincipal, fuente: 'Banco Central de Venezuela (BCV Oficial)', fecha: principal?.fechaActualizacion || new Date().toISOString() };
      return NextResponse.json({ ...ultimaTasa, exito: true });
    }

    const respaldo = (await consultar('https://pydolarve.org/api/v1/dollar?page=bcv').catch(() => null)) as
      { monitors?: { usd?: { price?: unknown } } } | null;
    const tasaRespaldo = positivo(respaldo?.monitors?.usd?.price);
    if (tasaRespaldo) {
      ultimaTasa = { tasa: tasaRespaldo, fuente: 'BCV Oficial (Respaldo PyDolar)', fecha: new Date().toISOString() };
      return NextResponse.json({ ...ultimaTasa, exito: true });
    }
  } catch (err) {
    console.error('Error consultando tasa BCV:', err);
  }

  // Sin proveedores: última tasa conocida marcada como desactualizada, o ninguna.
  if (ultimaTasa) {
    return NextResponse.json({ ...ultimaTasa, fuente: `${ultimaTasa.fuente} (última conocida)`, exito: false, desactualizada: true });
  }
  return NextResponse.json({ tasa: null, fuente: 'Sin conexión con proveedores de tasa', fecha: new Date().toISOString(), exito: false });
}
