import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { errorResponse } from '@/lib/apiHelpers';
import { centsToNumber, toCents } from '@/lib/money';
import { obtenerTasaBcv } from '@/lib/tasaBcv';
import type { HonorarioMedico } from '@/types';

type Acum = HonorarioMedico & { _cents: number; _facturas: Set<number>; _desglose: [number, number, number, number] };

/** Honorarios pendientes agrupados por médico, con trazabilidad por forma de cobro de las facturas de origen. */
export async function GET() {
  try {
    const res = await pool.query(`
      SELECT h.id, h.medico, h.factura_id, h.monto_usd,
             f.precio_usd, f.tasa_bcv, f.pago_punto, f.pago_movil, f.pago_efectivo_bs, f.pago_divisas,
             COALESCE(m.especialidad, CASE WHEN UPPER(h.medico) = 'PATOLOGO' THEN 'Patología y Citología' ELSE 'General' END) AS especialidad
      FROM honorarios_medicos_pendientes h
      JOIN facturas_caja f ON f.id = h.factura_id
      LEFT JOIN medicos m ON LOWER(m.nombre) = LOWER(h.medico)
      WHERE h.estado = 'PENDIENTE'
      ORDER BY h.medico ASC, h.id ASC`);

    const tasaVigente = (await obtenerTasaBcv())?.tasa ?? 0;
    const porMedico = new Map<string, Acum>();

    for (const r of res.rows) {
      const clave = String(r.medico).toLowerCase();
      let a = porMedico.get(clave);
      if (!a) {
        a = {
          id: porMedico.size + 1, medico: r.medico, especialidad: r.especialidad, pacientes_atendidos: 0, total_usd: 0,
          tasa_bcv: tasaVigente || Number(r.tasa_bcv) || 0, honorarios_ids: [],
          _cents: 0, _facturas: new Set<number>(), _desglose: [0, 0, 0, 0],
        };
        porMedico.set(clave, a);
      }
      const monto = toCents(r.monto_usd);
      const precio = toCents(r.precio_usd);
      const tasa = Number(r.tasa_bcv) > 0 ? Number(r.tasa_bcv) : tasaVigente;
      a._cents += monto;
      a._facturas.add(r.factura_id);
      a.honorarios_ids.push(r.id);
      if (precio > 0 && tasa > 0) {
        // Parte de cada medio de cobro (en USD) que corresponde a este honorario: proporcional a monto/precio.
        const partes = [toCents(r.pago_punto) / tasa, toCents(r.pago_movil) / tasa, toCents(r.pago_efectivo_bs) / tasa, toCents(r.pago_divisas)];
        partes.forEach((p, i) => { a._desglose[i] += Math.round((p * monto) / precio); });
      }
    }

    const out: HonorarioMedico[] = Array.from(porMedico.values()).map((a) => ({
      id: a.id, medico: a.medico, especialidad: a.especialidad, pacientes_atendidos: a._facturas.size,
      total_usd: centsToNumber(a._cents), tasa_bcv: a.tasa_bcv, honorarios_ids: a.honorarios_ids,
      desglose_pagos: {
        punto_de_venta_usd: centsToNumber(a._desglose[0]), pago_movil_usd: centsToNumber(a._desglose[1]),
        efectivo_bs_usd: centsToNumber(a._desglose[2]), divisas_usd: centsToNumber(a._desglose[3]),
      },
    }));
    return NextResponse.json(out);
  } catch (err) {
    return errorResponse(err);
  }
}
