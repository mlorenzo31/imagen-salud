import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse } from '@/lib/apiHelpers';
import { leerHojaComoObjetos } from '@/lib/excel';
import { normalizarFila } from '@/lib/cargaMasiva';
import { centsToNumber } from '@/lib/money';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILAS = 2000;

/** Simulación (sin escribir en BD) de la carga masiva de atenciones históricas. */
export async function POST(req: NextRequest) {
  try {
    const file = (await req.formData()).get('file');
    if (!(file instanceof File)) throw new ApiError(400, 'No se envió ningún archivo Excel.');
    if (file.size > MAX_BYTES) throw new ApiError(400, 'El archivo supera el máximo de 5 MB.');

    let rawData;
    try {
      rawData = await leerHojaComoObjetos(await file.arrayBuffer(), file.name || 'archivo.xlsx');
    } catch {
      throw new ApiError(400, 'No se pudo leer el archivo. Verifique que sea un .xlsx o .csv válido.');
    }
    if (rawData.length === 0) throw new ApiError(400, 'La hoja de Excel está vacía.');
    if (rawData.length > MAX_FILAS) throw new ApiError(400, `Máximo ${MAX_FILAS} filas por carga.`);

    const medicos = (await pool.query('SELECT nombre FROM medicos')).rows.map((r) => String(r.nombre));
    const normalizadas = rawData.map((r) => normalizarFila(r, medicos));

    // Duplicados contra la BD y dentro del propio archivo (hace idempotente la recarga del mismo archivo).
    const fechas = Array.from(new Set(normalizadas.map((n) => n.registro?.fecha).filter(Boolean) as string[]));
    const existentes = new Set<string>();
    if (fechas.length > 0) {
      const ex = await pool.query(
        "SELECT to_char(fecha,'YYYY-MM-DD') AS f, cedula_paciente AS c, estudio AS e, precio_usd::text AS p FROM facturas_caja WHERE fecha = ANY($1::date[])",
        [fechas]
      );
      ex.rows.forEach((r) => existentes.add(`${r.f}|${String(r.c).toUpperCase()}|${String(r.e).toUpperCase()}|${centsToNumber(Math.round(Number(r.p) * 100))}`));
    }
    const vistos = new Set<string>();

    let validas = 0, invalidas = 0, totalUsd = 0, totalBs = 0;
    const filas = normalizadas.map((n, i) => {
      const errores = [...n.errores];
      const r = n.registro;
      if (r) {
        const k = `${r.fecha}|${r.cedula}|${r.servicio.toUpperCase()}|${centsToNumber(r.precio)}`;
        if (existentes.has(k)) errores.push('Atención ya registrada en el sistema (misma fecha, cédula, estudio y monto).');
        else if (vistos.has(k)) errores.push('Fila repetida dentro del archivo.');
        vistos.add(k);
      }
      const valido = errores.length === 0 && !!r;
      if (valido && r) {
        validas++;
        totalUsd += r.anulada ? 0 : r.precio;
        totalBs += r.anulada ? 0 : Math.round(r.precio * r.tasa);
      } else invalidas++;
      return {
        fila: i + 2,
        paciente: r?.nombre || 'DESCONOCIDO',
        cedula: r?.cedula || '',
        servicio: r?.servicio || '',
        medico: r?.medico || 'Sin asignar',
        monto_usd: r ? centsToNumber(r.precio) : 0,
        monto_bs: r ? centsToNumber(Math.round(r.precio * r.tasa)) : 0,
        metodo_pago: r ? (r.divisas > 0 ? 'DIVISAS' : r.punto > 0 ? 'PUNTO' : r.movil > 0 ? 'PAGO_MOVIL' : 'EFECTIVO_BS') : '',
        valido,
        observaciones: [...errores, ...n.advertencias],
        registro: valido ? r : null,
      };
    });

    return NextResponse.json({
      total_filas: rawData.length,
      filas_validas: validas,
      filas_invalidas: invalidas,
      monto_total_usd: centsToNumber(totalUsd),
      monto_total_bs: centsToNumber(totalBs),
      filas,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
