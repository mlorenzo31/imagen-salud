import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal } from '@/lib/apiHelpers';
import { toCents } from '@/lib/money';
import { rangoValido } from '@/lib/resumenPeriodo';
import { construirHojaCierre, type FacturaHoja } from '@/lib/hojaCierre';

/** Hoja de cierre diario (una fila por día y total) del período Desde–Hasta. Solo admin y asistente. */
export async function GET(req: NextRequest) {
  try {
    if (req.headers.get('x-session-role') === 'cajero') throw new ApiError(403, 'No tiene permiso para ver la hoja de cierre.');
    const q = new URL(req.url).searchParams;
    const desde = q.get('desde') || fechaHoraLocal().fecha;
    const hasta = q.get('hasta') || desde;
    const error = rangoValido(desde, hasta);
    if (error) throw new ApiError(400, error);

    const r = await pool.query(
      `SELECT to_char(f.fecha, 'YYYY-MM-DD') AS fecha, f.cedula_paciente, f.tasa_bcv::text AS tasa, f.precio_usd::text AS precio,
              COALESCE(f.total_honorarios, 0)::text AS honorarios, COALESCE(f.pago_punto, 0)::text AS punto, COALESCE(f.pago_movil, 0)::text AS movil,
              COALESCE(f.pago_efectivo_bs, 0)::text AS efectivo, COALESCE(f.pago_divisas, 0)::text AS divisas,
              COALESCE(json_agg(json_build_object('area', d.area, 'ganancia', COALESCE(d.ganancia_clinica, 0)::text, 'orden', d.orden, 'ecoCatalogo', c.dist_eco::text))
                FILTER (WHERE d.id IS NOT NULL AND COALESCE(d.estado, '') NOT IN ('ANULADA', 'ANULADA_SALA')), '[]') AS detalle,
              f.servicios
       FROM facturas_caja f LEFT JOIN facturas_servicios_detalle d ON d.factura_id = f.id
         LEFT JOIN catalogo_estudios c ON c.area = 'GINECOLOGIA' AND d.area = 'GINECOLOGIA' AND lower(c.nombre) = lower(d.estudio)
       WHERE f.fecha BETWEEN $1 AND $2 AND f.estado NOT IN ('ANULADA', 'ANULADA_SALA')
       GROUP BY f.id ORDER BY f.fecha, f.id`,
      [desde, hasta]
    );

    const facturas: FacturaHoja[] = r.rows.map((f) => {
      const json: { orden?: number; dist?: { imagen?: unknown; eco?: unknown } }[] = Array.isArray(f.servicios) ? f.servicios : [];
      const detalle: { area: string | null; ganancia: string; orden: number | null; ecoCatalogo: string | null }[] = f.detalle;
      return {
        fecha: f.fecha, cedula: String(f.cedula_paciente ?? ''), tasa: Number(f.tasa),
        precio: toCents(f.precio), honorarios: toCents(f.honorarios),
        pagos: { punto: toCents(f.punto), movil: toCents(f.movil), efectivoBs: toCents(f.efectivo), divisas: toCents(f.divisas) },
        servicios: detalle.map((d, i) => {
          // Reparto imagen/eco de ginecología: el guardado en la factura (servicio del mismo orden) o, si falta, el del catálogo.
          const dist = (json.find((s) => s.orden === d.orden) ?? json[i])?.dist;
          const eco = dist?.eco !== undefined ? dist.eco : d.ecoCatalogo;
          return { area: String(d.area ?? 'GENERAL').toUpperCase(), ganancia: toCents(d.ganancia), eco: eco == null ? undefined : toCents(eco) };
        }),
      };
    });

    return NextResponse.json({ desde, hasta, ...construirHojaCierre(facturas, desde, hasta) });
  } catch (err) {
    return errorResponse(err);
  }
}
