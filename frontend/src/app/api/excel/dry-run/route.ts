import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { errorResponse } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';

const cell = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return String(v).trim();
  }
  return '';
};

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
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    if (rawData.length === 0) {
      return NextResponse.json({ error: 'La hoja de Excel está vacía.' }, { status: 400 });
    }

    // Médicos y servicios válidos para cross-check
    const medicosValidos = ['Dra. María González', 'Dr. Carlos Mendoza', 'Dra. Carmen Rodríguez', 'Dr. Juan Pérez'];

    const filasSimuladas: unknown[] = [];
    let montoTotalUsd = 0;
    let montoTotalBs = 0;
    let validas = 0;
    let invalidas = 0;

    rawData.forEach((row, idx) => {
      const filaNum = idx + 2; // considerando encabezado
      const paciente = cell(row, 'Paciente', 'paciente', 'PACIENTE');
      const cedula = cell(row, 'Cedula', 'cedula', 'CEDULA');
      const servicio = cell(row, 'Servicio', 'servicio', 'Estudio');
      const medico = cell(row, 'Medico', 'medico', 'Doctor');
      const montoUsd = toCents(cell(row, 'Monto_USD', 'monto_usd', 'USD') || 0) / 100;
      const montoBs = toCents(cell(row, 'Monto_BS', 'monto_bs', 'BS') || 0) / 100;
      const metodoPago = (cell(row, 'Metodo_Pago', 'metodo_pago') || 'PAGO_MOVIL').toUpperCase();

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
  } catch (err) {
    return errorResponse(err);
  }
}
