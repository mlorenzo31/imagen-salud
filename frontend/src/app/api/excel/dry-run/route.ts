import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo Excel.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (rawData.length === 0) {
      return NextResponse.json({ error: 'La hoja de Excel está vacía.' }, { status: 400 });
    }

    // Médicos y servicios válidos para cross-check
    const medicosValidos = ['Dra. María González', 'Dr. Carlos Mendoza', 'Dra. Carmen Rodríguez', 'Dr. Juan Pérez'];
    const metodosValidos = ['PAGO_MOVIL', 'EFECTIVO_BS', 'EFECTIVO_USD', 'PUNTO_VENTA'];

    const filasSimuladas: any[] = [];
    let montoTotalUsd = 0;
    let montoTotalBs = 0;
    let validas = 0;
    let invalidas = 0;

    rawData.forEach((row, idx) => {
      const filaNum = idx + 2; // considerando encabezado
      const paciente = (row.Paciente || row.paciente || row.PACIENTE || '').toString().trim();
      const cedula = (row.Cedula || row.cedula || row.CEDULA || '').toString().trim();
      const servicio = (row.Servicio || row.servicio || row.Estudio || '').toString().trim();
      const medico = (row.Medico || row.medico || row.Doctor || '').toString().trim();
      const montoUsd = parseFloat(row.Monto_USD || row.monto_usd || row.USD || 0) || 0;
      const montoBs = parseFloat(row.Monto_BS || row.monto_bs || row.BS || 0) || 0;
      const metodoPago = (row.Metodo_Pago || row.metodo_pago || 'PAGO_MOVIL').toString().trim().toUpperCase();

      const observaciones: string[] = [];

      if (!paciente) observaciones.push('Nombre de paciente requerido.');
      if (!servicio) observaciones.push('Servicio / Estudio no especificado.');
      if (montoUsd <= 0 && montoBs <= 0) observaciones.push('Monto total en cero o inválido.');
      if (medico && !medicosValidos.some(m => m.toLowerCase().includes(medico.toLowerCase()))) {
        observaciones.push(`Médico "${medico}" no registrado en el catálogo oficial.`);
      }

      const esValido = observaciones.length === 0;
      if (esValido) {
        validas++;
        montoTotalUsd += montoUsd;
        montoTotalBs += montoBs;
      } else {
        invalidas++;
      }

      filasSimuladas.push({
        fila: filaNum,
        paciente: paciente || 'DESCONOCIDO',
        cedula,
        servicio: servicio || 'GENERAL',
        medico: medico || 'Sin asignar',
        monto_usd: montoUsd,
        monto_bs: montoBs,
        metodo_pago: metodoPago,
        valido: esValido,
        observaciones
      });
    });

    return NextResponse.json({
      total_filas: rawData.length,
      filas_validas: validas,
      filas_invalidas: invalidas,
      monto_total_usd: montoTotalUsd,
      monto_total_bs: montoTotalBs,
      filas: filasSimuladas
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
