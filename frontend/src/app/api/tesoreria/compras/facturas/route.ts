import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { ApiError, errorResponse, parseBody, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';
import { exigirJornadaAlDia, marcarCierreModificado } from '@/lib/cierre';
import { camposFechaOperacion, resolverFechaOperacion } from '@/lib/fechaOperacion';
import { calcularTotales, type ConfigFiscal, type TotalesFactura } from '@/lib/compras/calculos';
import { asegurarCompras, leerConfigFiscal } from '@/lib/compras/comprasDb';
import { duplicadoA409 } from '@/lib/compras/validaciones';
import { registrarPagoCompra } from '@/lib/compras/registrarPago';
import { emitirComprobante } from '@/lib/compras/retencionesDb';

const num = z.union([z.string(), z.number()]);
const schema = z.object({
  proveedor_id: z.number().int().positive(),
  numero_factura: z.string().trim().min(1).max(50),
  numero_control: z.string().trim().max(50).nullish(),
  fecha_factura: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moneda: z.enum(['BS', 'USD']),
  tasa: num,
  lineas: z.array(z.object({
    producto_id: z.number().int().positive().nullish(),
    descripcion: z.string().trim().min(1).max(255),
    cantidad: num,
    precio: num,
    alicuota: z.number().int(),
  })).min(1, 'La factura debe tener al menos una línea.'),
  condicion: z.enum(['CONTADO', 'CREDITO']),
  vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  concepto_islr: z.string().max(100).nullish(),
  pago: z.object({ cuenta_id: z.number().int().positive(), monto: num, tasa: num.optional(), referencia: z.string().max(100).nullish() }).nullish(),
  notas: z.string().max(500).nullish(),
  ...camposFechaOperacion,
});

/** El sustraendo del ISLR está en Bs: para una factura en $ se lleva a $ con la tasa de la factura. */
function configEnMoneda(cfg: ConfigFiscal, moneda: 'BS' | 'USD', tasa: number): ConfigFiscal {
  if (moneda === 'BS') return cfg;
  return { ...cfg, islr: cfg.islr.map((r) => ({ ...r, sustraendo: Math.round(r.sustraendo / tasa) })) };
}

/** Facturas de compra con lo pagado y lo pendiente (?desde, ?hasta por fecha de factura; ?estado; ?proveedor_id). */
export async function GET(req: NextRequest) {
  try {
    await asegurarCompras();
    const q = new URL(req.url).searchParams;
    const where: string[] = [];
    const vals: unknown[] = [];
    const add = (cond: string, v: unknown) => { vals.push(v); where.push(cond.replace('?', `$${vals.length}`)); };
    if (q.get('desde')) add('f.fecha >= ?', q.get('desde'));
    if (q.get('hasta')) add('f.fecha <= ?', q.get('hasta'));
    if (q.get('estado') === 'POR_PAGAR') where.push("f.estado IN ('PENDIENTE', 'PARCIAL')");
    else if (q.get('estado')) add('f.estado = ?', q.get('estado'));
    if (q.get('proveedor_id')) add('f.proveedor_id = ?', Number(q.get('proveedor_id')));
    const r = await pool.query(
      `SELECT f.*, to_char(f.fecha, 'YYYY-MM-DD') AS fecha, to_char(f.vencimiento, 'YYYY-MM-DD') AS vencimiento, pr.rif, pr.razon_social,
              COALESCE((SELECT SUM(monto_aplicado) FROM pagos_compra p WHERE p.factura_id = f.id AND NOT p.reversado), 0)::text AS pagado
       FROM facturas_compra f JOIN proveedores pr ON pr.id = f.proveedor_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY f.fecha DESC, f.id DESC LIMIT 500`,
      vals
    );
    return NextResponse.json(r.rows.map((f) => ({ ...f, pendiente: centsToStr(f.estado === 'ANULADA' ? 0 : toCents(f.neto_a_pagar) - toCents(f.pagado)) })));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const esAdmin = req.headers.get('x-session-role') === 'admin';
    await exigirJornadaAlDia(esAdmin);
    const b = await parseBody(req, schema);
    const usuario = sesionUsuario(req);
    const { fecha, hora, nota, diaCerrado, motivo } = await resolverFechaOperacion(b, esAdmin);
    const tasa = Number(String(b.tasa).replace(',', '.'));
    if (!(tasa > 0)) throw new ApiError(400, 'Indique la tasa de la factura.');
    if (b.condicion === 'CONTADO' && !b.pago) throw new ApiError(400, 'Una compra de contado necesita la cuenta y el monto del pago.');
    const lineas = b.lineas.map((l) => ({ ...l, cantidadMil: Math.round(Number(String(l.cantidad).replace(',', '.')) * 1000), precioC: toCents(l.precio) }));
    if (lineas.some((l) => !(l.cantidadMil > 0) || !(l.precioC > 0))) throw new ApiError(400, 'Cantidad y precio deben ser mayores que cero.');

    await asegurarCompras();
    const out = await withTransaction(async (client) => {
      const pr = await client.query('SELECT * FROM proveedores WHERE id = $1', [b.proveedor_id]);
      if (pr.rows.length === 0) throw new ApiError(404, 'Proveedor no encontrado.');
      const prov = pr.rows[0];
      const cfg = configEnMoneda(await leerConfigFiscal(client), b.moneda, tasa);
      let t: TotalesFactura;
      try {
        t = calcularTotales(lineas.map((l) => ({ cantidad: l.cantidadMil, precio: l.precioC, alicuota: l.alicuota })), cfg,
          { contribuyenteEspecial: prov.contribuyente_especial, tipoPersona: prov.tipo_persona, conceptoIslr: b.concepto_islr ?? undefined });
      } catch (e) {
        throw new ApiError(400, (e as Error).message);
      }

      const fr = await client.query(
        `INSERT INTO facturas_compra (proveedor_id, numero_factura, numero_control, fecha, moneda, tasa, base_exenta, total_base, total_iva, total,
           iva_retenido, islr_retenido, neto_a_pagar, detalle_iva, condicion, vencimiento, notas, usuario)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
        [prov.id, b.numero_factura, b.numero_control || null, b.fecha_factura, b.moneda, tasa, centsToStr(t.exento), centsToStr(t.totalBase),
         centsToStr(t.totalIva), centsToStr(t.total), centsToStr(t.ivaRetenido), centsToStr(t.islrRetenido), centsToStr(t.netoAPagar),
         JSON.stringify(t.porAlicuota), b.condicion, b.condicion === 'CREDITO' ? b.vencimiento || null : null, (b.notas || '') + nota || null, usuario]
      ).catch((e) => { throw duplicadoA409(e, `La factura N° ${b.numero_factura} de ${prov.razon_social} ya está registrada.`); });
      const facturaId: number = fr.rows[0].id;
      for (const l of lineas) {
        await client.query(
          `INSERT INTO facturas_compra_lineas (factura_id, producto_id, descripcion, cantidad, precio_unitario, alicuota, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [facturaId, l.producto_id ?? null, l.descripcion, (l.cantidadMil / 1000).toFixed(3), centsToStr(l.precioC), l.alicuota,
           centsToStr(Math.round((l.cantidadMil * l.precioC) / 1000))]
        );
      }

      // Comprobante de retención (art. 18), solo si hubo retención: AAAAMM de emisión + secuencial continuo.
      let comprobante: string | null = null;
      if (t.ivaRetenido + t.islrRetenido > 0) {
        if (!b.numero_control?.trim()) throw new ApiError(400, 'Indique el N° de control de la factura: el comprobante de retención lo exige (art. 18.5).');
        comprobante = await emitirComprobante(client, { facturaId, fechaEmision: fecha, ivaRetenido: t.ivaRetenido, islrRetenido: t.islrRetenido });
      }

      let estado = 'PENDIENTE';
      if (b.pago) {
        const pago = await registrarPagoCompra(client, {
          facturaId, cuentaId: b.pago.cuenta_id, montoCuenta: toCents(b.pago.monto), tasa: Number(String(b.pago.tasa ?? tasa).replace(',', '.')),
          fecha, hora, referencia: b.pago.referencia, usuario,
        });
        estado = pago.estado;
        if (b.condicion === 'CONTADO' && estado !== 'PAGADA') {
          throw new ApiError(400, `El pago de contado debe cubrir el neto a pagar (${b.moneda === 'USD' ? '$' : 'Bs. '}${centsToStr(t.netoAPagar)}).`);
        }
        if (diaCerrado) await marcarCierreModificado(client, fecha, motivo, usuario);
      }
      return { facturaId, estado, comprobante, t };
    });

    return NextResponse.json({
      mensaje: `Factura registrada (${out.estado === 'PAGADA' ? 'pagada' : 'por pagar'}).`,
      id: out.facturaId, estado: out.estado, comprobante_retencion: out.comprobante,
      total: centsToStr(out.t.total), neto_a_pagar: centsToStr(out.t.netoAPagar),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
