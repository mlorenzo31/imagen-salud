import { NextRequest, NextResponse } from 'next/server';
import { ApiError, errorResponse, fechaHoraLocal, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';

type Valor = string | number | boolean | null;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ahora = fechaHoraLocal();
    const fechaIn = String(body.fecha || body.fecha_cierre || '');
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaIn) ? fechaIn : ahora.fecha;
    const usuario = sesionUsuario(req);
    const observaciones = typeof body.observaciones === 'string' && body.observaciones ? body.observaciones : 'Cierre auditado conforme';

    const out = await withTransaction(async (client) => {
      // Un solo cierre a la vez por fecha.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cierre:${fecha}`]);

      const pend = await client.query("SELECT COUNT(*) AS cant FROM facturas_caja WHERE estado IN ('ESPERA', 'ATENCION') AND fecha = $1", [fecha]);
      if (parseInt(pend.rows[0].cant, 10) > 0) {
        throw new ApiError(400, `Aún existen pacientes pendientes de resolución para esta fecha (${pend.rows[0].cant} pendientes).`);
      }

      const tot = (await client.query(
        `SELECT COUNT(*) FILTER (WHERE estado = 'FINALIZADO') AS atendidos,
                COALESCE(SUM(precio_usd), 0) AS total_usd,
                COALESCE(SUM(precio_usd * tasa_bcv), 0) AS total_bs,
                COALESCE(SUM(pago_divisas), 0) AS total_divisas_usd,
                COALESCE(SUM(pago_efectivo_bs), 0) AS total_efectivo_bs,
                COALESCE(SUM(pago_punto), 0) AS total_punto_bs,
                COALESCE(SUM(pago_movil), 0) AS total_pago_movil_bs
         FROM facturas_caja WHERE fecha = $1 AND estado NOT IN ('ANULADA', 'ANULADA_SALA')`, [fecha])).rows[0];

      const egr = await client.query('SELECT moneda, COALESCE(SUM(total_debitado), 0) AS t FROM egresos_operativos WHERE fecha = $1 GROUP BY moneda', [fecha]).catch(() => ({ rows: [] }));
      const ing = await client.query('SELECT moneda, COALESCE(SUM(monto), 0) AS t FROM ingresos_extraordinarios WHERE fecha = $1 GROUP BY moneda', [fecha]).catch(() => ({ rows: [] }));
      const porMoneda = (rows: { moneda: string; t: string }[], m: string) => centsToStr(toCents(rows.find((r) => r.moneda === m)?.t));
      const saldos = await client.query('SELECT codigo, saldo_actual FROM cuentas_bancarias');
      const saldo = (codigo: string) => centsToStr(toCents(saldos.rows.find((r) => r.codigo === codigo)?.saldo_actual));

      // Valores que se escriben en las columnas que existan en la tabla (soporta ambas variantes de esquema).
      const candidatos: Record<string, Valor> = {
        fecha_cierre: fecha,
        fecha,
        hora_cierre: ahora.hora,
        usuario,
        observaciones,
        notas: observaciones,
        consolidado: true,
        estado: 'CERRADO',
        total_facturado_usd: centsToStr(toCents(tot.total_usd)),
        total_facturado_bs: centsToStr(toCents(tot.total_bs)),
        total_punto_bs: centsToStr(toCents(tot.total_punto_bs)),
        total_movil_bs: centsToStr(toCents(tot.total_pago_movil_bs)),
        total_efectivo_bs: centsToStr(toCents(tot.total_efectivo_bs)),
        total_divisas_usd: centsToStr(toCents(tot.total_divisas_usd)),
        total_egresos_bs: porMoneda(egr.rows, 'BS'),
        total_egresos_usd: porMoneda(egr.rows, 'USD'),
        total_ingresos_extra_bs: porMoneda(ing.rows, 'BS'),
        total_ingresos_extra_usd: porMoneda(ing.rows, 'USD'),
        saldo_cierre_efectivo_usd: saldo('EFECTIVO_USD'),
        saldo_cierre_efectivo_bs: saldo('EFECTIVO_BS'),
        saldo_cierre_punto_bs: saldo('PUNTO_VENTA_BS'),
        saldo_cierre_movil_bs: saldo('PAGO_MOVIL_BS'),
        pacientes_atendidos: parseInt(tot.atendidos, 10) || 0,
        metadata_auditoria: JSON.stringify({ cerrado_por: usuario, cerrado_en: new Date().toISOString() }),
      };

      const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'cierres_diarios'");
      const existentes = new Set<string>(cols.rows.map((r) => r.column_name));
      if (existentes.size === 0) throw new ApiError(500, 'La tabla cierres_diarios no existe.');
      const colFecha = existentes.has('fecha_cierre') ? 'fecha_cierre' : 'fecha';
      const datos = Object.entries(candidatos).filter(([k]) => existentes.has(k));

      const previo = await client.query(`SELECT id FROM cierres_diarios WHERE ${colFecha} = $1 LIMIT 1`, [fecha]);
      let fila: Record<string, unknown>;
      if (previo.rows.length > 0) {
        const sets = datos.filter(([k]) => k !== colFecha).map(([k], i) => `${k} = $${i + 1}`);
        if (existentes.has('actualizado_en')) sets.push('actualizado_en = CURRENT_TIMESTAMP');
        const vals = datos.filter(([k]) => k !== colFecha).map(([, v]) => v);
        const r = await client.query(`UPDATE cierres_diarios SET ${sets.join(', ')} WHERE id = $${vals.length + 1} RETURNING *`, [...vals, previo.rows[0].id]);
        fila = r.rows[0];
      } else {
        const r = await client.query(
          `INSERT INTO cierres_diarios (${datos.map(([k]) => k).join(', ')}) VALUES (${datos.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
          datos.map(([, v]) => v)
        );
        fila = r.rows[0];
      }
      return { fila, tot };
    });

    return NextResponse.json({
      mensaje: 'Cierre diario consolidado exitosamente.',
      fecha_cierre: fecha,
      cierre: { ...out.fila, ...out.tot, usuario_responsable: usuario },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
