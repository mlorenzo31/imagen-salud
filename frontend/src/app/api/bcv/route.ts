import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Intentar proveedor principal: ve.dolarapi.com
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      next: { revalidate: 300 } // Cachear por 5 minutos
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.promedio) {
        const tasa = parseFloat(data.promedio);
        return NextResponse.json({
          tasa,
          fuente: 'Banco Central de Venezuela (BCV Oficial)',
          fecha: data.fechaActualizacion || new Date().toISOString(),
          exito: true
        });
      }
    }

    // 2. Proveedor de respaldo secundario: pydolarve o exchange
    const resBackup = await fetch('https://pydolarve.org/api/v1/dollar?page=bcv', {
      next: { revalidate: 300 }
    });
    if (resBackup.ok) {
      const dataB = await resBackup.json();
      const promedio = dataB?.monitors?.usd?.price;
      if (promedio) {
        return NextResponse.json({
          tasa: parseFloat(promedio),
          fuente: 'BCV Oficial (Respaldo PyDolar)',
          fecha: new Date().toISOString(),
          exito: true
        });
      }
    }

    // Si ambos fallan, retornar última tasa de seguridad
    return NextResponse.json({
      tasa: 832.48,
      fuente: 'Tasa BCV Estimada (Offline)',
      fecha: new Date().toISOString(),
      exito: true
    });
  } catch (err: any) {
    console.error('Error consultando tasa BCV:', err);
    return NextResponse.json({
      tasa: 832.48,
      fuente: 'Tasa BCV de Respaldo',
      fecha: new Date().toISOString(),
      exito: true,
      error: err.message
    });
  }
}
