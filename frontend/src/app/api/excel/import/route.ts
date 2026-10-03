import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, errorResponse, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToStr } from '@/lib/money';
import type { RegistroAtencion } from '@/lib/cargaMasiva';

const cents = z.number().int().min(0);
const registro = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hora: z.string().max(20), cedula: z.string().min(1).max(30), nombre: z.string().min(1).max(200),
  telefono: z.string().max(30).nullable(), servicio: z.string().min(1).max(255), area: z.string().max(100), grupo: z.string().max(5),
  medico: z.string().max(200), precio: cents.positive(), tasa: z.number().positive(), divisas: cents, punto: cents, movil: cents, efectivoBs: cents,
  referencia: z.string().max(100).nullable(), honorarios: cents, ganancia: cents, anulada: z.boolean(),
});
const schema = z.object({ filas: z.array(z.object({ registro: registro.nullable() })).min(1, 'No se recibieron filas válidas para procesar.').max(2000) });

/**
 * Carga definitiva de atenciones históricas en facturas_caja (+ detalle y catálogo de pacientes).
 * Es una carga de HISTORIAL: no mueve saldos de tesorería ni genera honorarios pendientes (ya fueron cobrados/pagados).
 */
export async function POST(req: NextRequest) {
  try {
    const { filas } = await parseBody(req, schema);
    const usuario = sesionUsuario(req);
    const registros = filas.map((f) => f.registro).filter((r): r is RegistroAtencion => r !== null);
    if (registros.length === 0) throw new ApiError(400, 'No hay filas válidas para importar.');

    const insertados = await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['carga-masiva']);
      const turnos = new Map<string, number>();
      let n = 0;
      for (const r of registros) {
        const dup = await client.query(
          'SELECT 1 FROM facturas_caja WHERE fecha = $1 AND UPPER(cedula_paciente) = $2 AND UPPER(estudio) = $3 AND precio_usd = $4::numeric LIMIT 1',
          [r.fecha, r.cedula, r.servicio.toUpperCase(), centsToStr(r.precio)]
        );
        if (dup.rows.length > 0) continue; // ya cargada: el reintento es idempotente

        if (!turnos.has(r.fecha)) {
          const t = await client.query('SELECT COALESCE(MAX(turno_num), 0) AS m FROM facturas_caja WHERE fecha = $1', [r.fecha]);
          turnos.set(r.fecha, Number(t.rows[0].m));
        }
        const turno = (turnos.get(r.fecha) ?? 0) + 1;
        turnos.set(r.fecha, turno);

        const f = await client.query(
          `INSERT INTO facturas_caja
           (fecha, hora, cedula_paciente, nombre_paciente, estudio, medico, precio_usd, tasa_bcv, pago_punto, pago_movil, pago_efectivo_bs, pago_divisas,
            estado, servicios, total_honorarios, total_ganancia, turno_num, etapa_actual, telefono_paciente, grupo_clinico)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,2,$18,$19) RETURNING id`,
          [r.fecha, r.hora, r.cedula, r.nombre, r.servicio.toUpperCase(), r.medico.toUpperCase(), centsToStr(r.precio), r.tasa,
           centsToStr(r.punto), centsToStr(r.movil), centsToStr(r.efectivoBs), centsToStr(r.divisas),
           r.anulada ? 'ANULADA' : 'FINALIZADO',
           JSON.stringify([{ estudio: r.servicio, medico: r.medico, area: r.area, precioUSD: r.precio / 100, honorariosMedico: r.honorarios / 100, gananciaClinica: r.ganancia / 100, orden: 1 }]),
           centsToStr(r.honorarios), centsToStr(r.ganancia), turno, r.telefono, r.grupo]
        );
        await client.query(
          `INSERT INTO facturas_servicios_detalle (factura_id, estudio, medico, area, sala, precio_usd, honorarios_medico, ganancia_clinica, estado, orden)
           VALUES ($1,$2,$3,$4,'SALA_ECO_GINE',$5,$6,$7,'FINALIZADO',1)`,
          [f.rows[0].id, r.servicio.toUpperCase(), r.medico.toUpperCase(), r.area.toUpperCase(), centsToStr(r.precio), centsToStr(r.honorarios), centsToStr(r.ganancia)]
        );
        await client.query(
          `INSERT INTO pacientes (cedula, nombre, telefono) VALUES ($1,$2,$3)
           ON CONFLICT (cedula) DO UPDATE SET telefono = COALESCE(EXCLUDED.telefono, pacientes.telefono)`,
          [r.cedula, r.nombre, r.telefono]
        );
        n++;
      }
      return n;
    });

    return NextResponse.json({
      mensaje: `Carga masiva completada. Se registraron ${insertados} atenciones históricas por ${usuario}.`,
      registros_insertados: insertados,
      omitidas_por_duplicado: registros.length - insertados,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
