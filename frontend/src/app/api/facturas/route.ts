import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';
import { obtenerTasaBcv } from '@/lib/tasaBcv';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get('fecha');
    const estado = searchParams.get('estado');
    const cedula = searchParams.get('cedula');
    const busqueda = searchParams.get('q');
    const limitParam = parseInt(searchParams.get('limit') || '500', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 500;

    let q = `
      SELECT 
        fc.*,
        COALESCE(fc.fecha_nacimiento_paciente, p.fecha_nacimiento) as fecha_nacimiento_paciente
      FROM facturas_caja fc
      LEFT JOIN (
        SELECT DISTINCT ON (regexp_replace(cedula, '[^0-9]', '', 'g'))
          regexp_replace(cedula, '[^0-9]', '', 'g') as cedula_clean,
          fecha_nacimiento
        FROM pacientes
      ) p ON regexp_replace(fc.cedula_paciente, '[^0-9]', '', 'g') = p.cedula_clean
      WHERE 1=1
    `;
    const params: string[] = [];

    if (fecha) {
      params.push(fecha);
      q += ' AND fc.fecha = $' + params.length;
    }
    if (estado) {
      params.push(estado);
      q += ' AND fc.estado = $' + params.length;
    }
    if (cedula) {
      const soloNumeros = cedula.replace(/\D/g, '');
      params.push(`%${soloNumeros}%`);
      q += ` AND regexp_replace(fc.cedula_paciente, '[^0-9]', '', 'g') LIKE $` + params.length;
    } else if (busqueda) {
      params.push(`%${busqueda}%`);
      q += ` AND (fc.cedula_paciente ILIKE $${params.length} OR fc.nombre_paciente ILIKE $${params.length} OR fc.estudio ILIKE $${params.length})`;
    }

    q += ` ORDER BY fc.id DESC LIMIT ${limit}`;
    const result = await pool.query(q, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    return errorResponse(err);
  }
}

type Raw = Record<string, unknown>;

interface Servicio {
  estudio: string;
  medico: string;
  area: string;
  sala: string;
  estado?: string;
  precio: number; // centavos USD
  honorarios: number; // centavos USD
  ganancia: number; // centavos USD
  orden: number;
  raw: Raw; // campos adicionales del cliente (se conservan en el JSON de la factura)
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const HONORARIOS_DEFECTO_PCT = 70; // % del precio si el servicio no informa honorarios

function normalizarServicios(data: Raw): Servicio[] {
  const lista: Raw[] = Array.isArray(data.servicios) && data.servicios.length > 0
    ? (data.servicios as Raw[])
    : [{
        estudio: data.estudio || 'Consulta Médica',
        medico: data.medico || 'De Guardia',
        area: data.area || 'GENERAL',
        sala: data.sala || 'SALA_ECO_GINE',
        precioUSD: data.precioUSD,
        honorariosMedico: data.honorariosMedico,
      }];
  return lista.map((s, idx) => {
    const precio = toCents(s.precioUSD ?? s.precio_usd);
    if (precio < 0) throw new ApiError(400, 'El precio de un servicio no puede ser negativo.');
    const honRaw = s.honorariosMedico ?? s.honorarios_medico;
    const honorarios = honRaw === undefined || honRaw === null || honRaw === ''
      ? Math.round((precio * HONORARIOS_DEFECTO_PCT) / 100)
      : toCents(honRaw);
    if (honorarios < 0 || honorarios > precio) throw new ApiError(400, 'Los honorarios de un servicio deben estar entre 0 y su precio.');
    return {
      estudio: str(s.estudio),
      medico: str(s.medico),
      area: str(s.area) || 'GENERAL',
      sala: str(s.sala) || 'SALA_ECO_GINE',
      estado: s.estado ? str(s.estado) : undefined,
      precio,
      honorarios,
      ganancia: precio - honorarios,
      orden: idx + 1,
      raw: s,
    };
  });
}

async function acreditar(
  client: PoolClient,
  codigo: string,
  cents: number,
  moneda: 'BS' | 'USD',
  ctx: { facturaId: number; paciente: string; fecha: string; hora: string; usuario: string },
  descripcion: string
) {
  const res = await client.query('SELECT id, saldo_actual FROM cuentas_bancarias WHERE codigo = $1 FOR UPDATE', [codigo]);
  if (res.rows.length === 0) return;
  const cuenta = res.rows[0];
  const saldoAnt = toCents(cuenta.saldo_actual);
  const saldoPost = saldoAnt + cents;
  await client.query('UPDATE cuentas_bancarias SET saldo_actual = $1, actualizado_en = NOW() WHERE id = $2', [centsToStr(saldoPost), cuenta.id]);
  await client.query(
    `INSERT INTO movimientos_tesoreria
     (cuenta_id, tipo, monto, moneda, comision, monto_neto, saldo_anterior, saldo_posterior, referencia, descripcion, factura_id, fecha, hora, usuario)
     VALUES ($1, 'INGRESO_FACTURA', $2, $3, 0, $2, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [cuenta.id, centsToStr(cents), moneda, centsToStr(saldoAnt), centsToStr(saldoPost), `FACT-${ctx.facturaId}`, descripcion, ctx.facturaId, ctx.fecha, ctx.hora, ctx.usuario]
  );
}

export async function POST(req: NextRequest) {
  try {
    let data: Raw;
    try {
      data = (await req.json()) as Raw;
    } catch {
      throw new ApiError(400, 'Cuerpo JSON inválido.');
    }
    const usuario = sesionUsuario(req);
    const esAdmin = req.headers.get('x-session-role') === 'admin';
    const ahora = fechaHoraLocal();
    // Solo el admin puede fijar una fecha distinta a la del servidor.
    const fecha = esAdmin && /^\d{4}-\d{2}-\d{2}$/.test(str(data.fecha)) ? str(data.fecha) : ahora.fecha;
    const hora = str(data.hora) || ahora.hora;

    // La tasa la gobierna el servidor: si el cliente no la envía se usa la vigente (sin intervención humana);
    // si la envía y la vigente es reciente, no puede desviarse más de 5 % (evita tasas manipuladas o pestañas obsoletas).
    const tasaCliente = Number(data.tasaBCV ?? data.tasa_bcv);
    const vigente = await obtenerTasaBcv();
    let tasaNum: number;
    if (Number.isFinite(tasaCliente) && tasaCliente > 0) {
      if (vigente?.exito && Math.abs(tasaCliente - vigente.tasa) / vigente.tasa > 0.05) {
        throw new ApiError(400, `La tasa enviada (${tasaCliente}) difiere de la tasa BCV vigente (${vigente.tasa}). Recargue la pantalla.`);
      }
      tasaNum = tasaCliente;
    } else if (vigente) {
      tasaNum = vigente.tasa;
    } else {
      throw new ApiError(503, 'No hay tasa BCV disponible (proveedores caídos y sin historial).');
    }

    const servicios = normalizarServicios(data);
    const totalPrecio = servicios.reduce((a, s) => a + s.precio, 0);
    const totalHonorarios = servicios.reduce((a, s) => a + s.honorarios, 0);
    const totalGanancia = totalPrecio - totalHonorarios;
    if (totalPrecio <= 0) throw new ApiError(400, 'El total de la factura debe ser mayor a 0.');
    if (data.precioUSD !== undefined && data.precioUSD !== null && data.precioUSD !== '' && toCents(data.precioUSD) !== totalPrecio) {
      throw new ApiError(400, 'El precio total no coincide con la suma de los servicios.');
    }

    const pagos = (data.pagos ?? {}) as Raw;
    const punto = toCents(pagos.punto ?? data.pago_punto);
    const movil = toCents(pagos.movil ?? data.pago_movil);
    const efBs = toCents(pagos.efectivoBs ?? data.pago_efectivo_bs);
    const divisas = toCents(pagos.divisasUSD ?? data.pago_divisas);
    if ([punto, movil, efBs, divisas].some((v) => v < 0)) throw new ApiError(400, 'Los montos de pago no pueden ser negativos.');

    // Cuadre: lo pagado (Bs convertidos a USD a la tasa de la factura) debe igualar el total (tolerancia 2 centavos).
    const bsToUsdCents = Math.round(((punto + movil + efBs) / tasaNum));
    const pagadoUsd = divisas + bsToUsdCents;
    if (Math.abs(pagadoUsd - totalPrecio) > 2) {
      throw new ApiError(400, `Los pagos no cuadran con el total: pagado $${centsToStr(pagadoUsd)} vs total $${centsToStr(totalPrecio)}.`);
    }

    const nombresEstudios = servicios.map((s) => s.estudio).filter(Boolean);
    const medicosUnicos = Array.from(new Set(servicios.map((s) => s.medico).filter(Boolean)));
    const estudioResumen = (nombresEstudios.join(' + ') || str(data.estudio) || 'CONSULTA MÉDICA').toUpperCase();
    const medicoResumen = (medicosUnicos.join(' / ') || str(data.medico) || 'DE GUARDIA').toUpperCase();
    const cedula = str(data.cedula || data.cedula_paciente);
    const nombre = str(data.nombre || data.nombre_paciente).trim().toUpperCase();
    const fechaNac = str(data.fecha_nacimiento || data.fecha_nacimiento_paciente) || null;

    const factura = await withTransaction(async (client) => {
      let turnoNum = parseInt(str(data.turnoNum ?? data.turno_num), 10);
      if (!Number.isFinite(turnoNum) || turnoNum <= 0) {
        // Serializa la asignación de turnos del día para evitar números duplicados.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`turno:${fecha}`]);
        const tRes = await client.query('SELECT COALESCE(MAX(turno_num), 0) + 1 as prox FROM facturas_caja WHERE fecha = $1', [fecha]);
        turnoNum = parseInt(tRes.rows[0].prox, 10) || 1;
      }

      const serviciosJson = servicios.map((s) => ({
        ...s.raw, estudio: s.estudio, medico: s.medico, area: s.area, sala: s.sala, estado: s.estado, orden: s.orden,
        precioUSD: Number(centsToStr(s.precio)), honorariosMedico: Number(centsToStr(s.honorarios)), gananciaClinica: Number(centsToStr(s.ganancia)),
      }));

      const resFactura = await client.query(
        `INSERT INTO facturas_caja
         (fecha, hora, cedula_paciente, nombre_paciente, estudio, medico, precio_usd, tasa_bcv,
          pago_punto, pago_movil, pago_efectivo_bs, pago_divisas, estado,
          servicios, total_honorarios, total_ganancia, turno_num, etapa_actual,
          telefono_paciente, estudio_principal_id, prioridad, grupo_clinico, fecha_nacimiento_paciente)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         RETURNING *`,
        [
          fecha, hora, cedula, nombre, estudioResumen, medicoResumen, centsToStr(totalPrecio), tasaNum,
          centsToStr(punto), centsToStr(movil), centsToStr(efBs), centsToStr(divisas), str(data.estado) || 'ESPERA',
          JSON.stringify(serviciosJson), centsToStr(totalHonorarios), centsToStr(totalGanancia), turnoNum,
          parseInt(str(data.etapaActual ?? data.etapa_actual), 10) || 0,
          str(data.telefono_paciente || data.telefono) || null, data.estudio_principal_id || null,
          str(data.prioridad) || 'NORMAL', str(data.grupo_clinico) || 'A', fechaNac,
        ]
      );
      const f = resFactura.rows[0];

      for (const s of servicios) {
        await client.query(
          `INSERT INTO facturas_servicios_detalle
           (factura_id, estudio, medico, area, sala, precio_usd, honorarios_medico, ganancia_clinica, estado, orden)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [f.id, s.estudio.toUpperCase(), (s.medico || 'DE GUARDIA').toUpperCase(), s.area.toUpperCase(), s.sala.toUpperCase(),
           centsToStr(s.precio), centsToStr(s.honorarios), centsToStr(s.ganancia), s.estado || 'ESPERA', s.orden]
        );
        if (s.honorarios > 0 && s.medico && s.medico !== 'De Guardia') {
          await client.query(
            `INSERT INTO honorarios_medicos_pendientes (factura_id, fecha_servicio, medico, estudio, paciente, monto_usd, estado)
             VALUES ($1,$2,$3,$4,$5,$6,'PENDIENTE')`,
            [f.id, fecha, s.medico, s.estudio, f.nombre_paciente, centsToStr(s.honorarios)]
          );
        }
      }

      if (cedula && nombre) {
        await client.query(
          `INSERT INTO pacientes (cedula, nombre, fecha_nacimiento, direccion, telefono)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (cedula) DO UPDATE
           SET nombre = EXCLUDED.nombre,
               fecha_nacimiento = COALESCE(EXCLUDED.fecha_nacimiento, pacientes.fecha_nacimiento),
               direccion = COALESCE(EXCLUDED.direccion, pacientes.direccion),
               telefono = COALESCE(EXCLUDED.telefono, pacientes.telefono)`,
          [cedula, str(data.nombre), fechaNac, str(data.direccion) || null, str(data.telefono) || null]
        );
      }

      const ctx = { facturaId: f.id as number, paciente: f.nombre_paciente as string, fecha, hora, usuario };
      if (punto > 0) {
        await client.query(
          `INSERT INTO transacciones_tarjetas_transito
           (factura_id, fecha_transaccion, hora_transaccion, cedula_paciente, nombre_paciente, monto_bruto_bs, estado)
           VALUES ($1,$2,$3,$4,$5,$6,'PENDIENTE')`,
          [f.id, fecha, hora, f.cedula_paciente, f.nombre_paciente, centsToStr(punto)]
        );
        await client.query(
          "UPDATE cuentas_bancarias SET saldo_transito = saldo_transito + $1::numeric, actualizado_en = NOW() WHERE codigo = 'PUNTO_VENTA_BS'",
          [centsToStr(punto)]
        );
      }
      if (movil > 0) await acreditar(client, 'PAGO_MOVIL_BS', movil, 'BS', ctx, `Ingreso por factura ${f.id} (${f.nombre_paciente})`);
      if (efBs > 0) await acreditar(client, 'EFECTIVO_BS', efBs, 'BS', ctx, `Ingreso efectivo Bs factura ${f.id} (${f.nombre_paciente})`);
      if (divisas > 0) await acreditar(client, 'EFECTIVO_USD', divisas, 'USD', ctx, `Ingreso efectivo USD factura ${f.id} (${f.nombre_paciente})`);
      return f;
    });

    return NextResponse.json({
      mensaje: 'Factura registrada y fondos acreditados en tesorería exitosamente.',
      factura: factura,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
