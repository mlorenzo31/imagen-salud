import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { clasificarServicio } from '@/lib/sala';
import pool from '@/lib/db';
import { ApiError, errorResponse, fechaHoraLocal, sesionUsuario, withTransaction } from '@/lib/apiHelpers';
import { centsToStr, toCents } from '@/lib/money';
import { obtenerTasaBcv } from '@/lib/tasaBcv';
import { exigirJornadaAlDia, ultimaFechaCerrada } from '@/lib/cierre';
import { asegurarMedioTransito } from '@/lib/transito';
import { listarEstudios, repartoCents, type EstudioFila } from '@/lib/catalogoDb';
import { BENEFICIARIO_PATOLOGO } from '@/lib/reparto';
import { esSexo } from '@/lib/sexo';
import { z } from 'zod';
import { DescuentoError, calcularFactura, porcentajeEfectivoBp, type DescuentoManual, type ModoReparto } from '@/lib/descuento';
import { asegurarDescuentos, promosActivas } from '@/lib/descuentosDb';
import { exigirAutorizacionDescuento } from '@/lib/autorizacionDescuento';
import { exigirPinSesion } from '@/lib/pin';
import { decidirTasa } from '@/lib/tasaFactura';
import { actorSesion, registrarBitacora } from '@/lib/bitacora';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get('fecha');
    const estado = searchParams.get('estado');
    const cedula = searchParams.get('cedula');
    const busqueda = searchParams.get('q');
    const soloAbiertas = searchParams.get('abiertas') === '1';
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

    if (soloAbiertas) {
      // Sala de espera/TV: solo la jornada abierta. Lo ya cerrado desaparece; los pacientes activos nunca se ocultan.
      const cierre = await ultimaFechaCerrada();
      if (cierre) {
        // El día en curso nunca se oculta (aunque ya tenga cierre): los culminados de hoy deben seguir visibles para enviar resultados.
        params.push(cierre, fechaHoraLocal().fecha);
        q += ` AND (fc.fecha > $${params.length - 1}::date OR fc.fecha >= $${params.length}::date OR fc.estado IN ('ESPERA', 'ATENCION'))`;
      }
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
  honorarios: number; // centavos USD (médico + patólogo)
  honMedico: number; // centavos USD
  honPatologo: number; // centavos USD
  ganancia: number; // centavos USD (imagen + eco)
  precioLista: number; // centavos USD antes de descuento (precio = neto cobrado)
  descuento: number; // centavos USD
  promoId: number | null;
  modoDescuento: ModoReparto | null;
  orden: number;
  raw: Raw; // campos adicionales del cliente (se conservan en el JSON de la factura)
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function normalizarServicios(data: Raw, catalogo: EstudioFila[]): Servicio[] {
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
  const clave = (area: string, nombre: string) => `${area}|${nombre}`.toLowerCase();
  const porClave = new Map(catalogo.map((f) => [clave(f.area, f.nombre), f]));

  return lista.map((s, idx) => {
    const precio = toCents(s.precioUSD ?? s.precio_usd);
    if (precio < 0) throw new ApiError(400, 'El precio de un servicio no puede ser negativo.');
    const nombre = str(s.estudio);
    const cat = porClave.get(clave(str(s.area), nombre));

    let honMedico: number;
    let honPatologo = 0;
    if (cat) {
      // Estudio del catálogo: el precio y el reparto los fija el catálogo, no el cliente.
      if (!cat.activo) throw new ApiError(400, `El estudio "${nombre}" está desactivado en el catálogo.`);
      const r = repartoCents(cat);
      if (precio !== r.precio) {
        throw new ApiError(400, `El precio de "${nombre}" ($${centsToStr(precio)}) no coincide con el catálogo ($${centsToStr(r.precio)}). Recargue la pantalla.`);
      }
      honMedico = r.medico;
      honPatologo = r.patologo;
    } else if (s.dist && typeof s.dist === 'object') {
      // Fuera del catálogo (p. ej. consultas con tarifa por especialista): se acepta el reparto informado si cuadra.
      const d = s.dist as Raw;
      const parte = (k: string) => toCents(d[k]);
      const suma = parte('imagen') + parte('medico') + parte('eco') + parte('patologo');
      if (Math.abs(suma - precio) > 1) throw new ApiError(400, `El reparto de "${nombre}" no suma su precio.`);
      honMedico = parte('medico');
      honPatologo = parte('patologo');
    } else {
      // Sin catálogo ni reparto: los honorarios se exigen siempre (no se asume ningún porcentaje).
      const honRaw = s.honorariosMedico ?? s.honorarios_medico;
      if (honRaw === undefined || honRaw === null || honRaw === '') throw new ApiError(400, `Indique los honorarios del servicio "${nombre}".`);
      honMedico = toCents(honRaw);
    }
    const honorarios = honMedico + honPatologo;
    if (honMedico < 0 || honPatologo < 0 || honorarios > precio) throw new ApiError(400, 'Los honorarios de un servicio deben estar entre 0 y su precio.');
    // Ganancia de la clínica = lo que no se paga como honorario (imagen + eco).
    const ganancia = precio - honorarios;

    return {
      estudio: nombre,
      medico: str(s.medico),
      area: str(s.area) || 'GENERAL',
      sala: str(s.sala) || 'SALA_ECO_GINE',
      estado: s.estado ? str(s.estado) : undefined,
      precio,
      honorarios,
      honMedico,
      honPatologo,
      ganancia,
      precioLista: precio,
      descuento: 0,
      promoId: null,
      modoDescuento: null,
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

const descuentoSchema = z.object({
  tipo: z.enum(['PCT', 'USD']),
  valor: z.number().positive('El descuento debe ser mayor a cero.'),
  modo: z.enum(['CLINICA', 'PROPORCIONAL']),
  motivo: z.string().trim().min(5, 'Indique el motivo del descuento (mínimo 5 caracteres).'),
  pin: z.string().min(1, 'Ingrese su clave para confirmar el descuento.'),
  autorizador: z.object({ usuario: z.string(), clave: z.string() }).nullish(),
});

/** Lee el descuento manual: `valor` viene en % (PCT) o en dólares (USD) y se convierte a puntos básicos / centavos. */
function leerDescuentoManual(raw: unknown) {
  if (raw === undefined || raw === null) return null;
  const r = descuentoSchema.safeParse(raw);
  if (!r.success) throw new ApiError(400, r.error.issues[0]?.message ?? 'Descuento inválido.');
  const d = r.data;
  if (d.tipo === 'PCT' && d.valor >= 100) throw new ApiError(400, 'El porcentaje de descuento debe ser menor a 100.');
  const manual: DescuentoManual = { tipo: d.tipo, modo: d.modo, valor: d.tipo === 'PCT' ? Math.round(d.valor * 100) : toCents(d.valor) };
  return { manual, motivo: d.motivo, pin: d.pin, autorizador: d.autorizador ?? null };
}

export async function POST(req: NextRequest) {
  try {
    let data: Raw;
    try {
      data = (await req.json()) as Raw;
    } catch {
      throw new ApiError(400, 'Cuerpo JSON inválido.');
    }
    const esAdmin = req.headers.get('x-session-role') === 'admin';
    await exigirJornadaAlDia(esAdmin);
    const usuario = sesionUsuario(req);
    const ahora = fechaHoraLocal();
    // Solo el admin puede fijar una fecha distinta a la del servidor.
    const fecha = esAdmin && /^\d{4}-\d{2}-\d{2}$/.test(str(data.fecha)) ? str(data.fecha) : ahora.fecha;
    const hora = str(data.hora) || ahora.hora;

    // La tasa la gobierna el servidor: la vigente por defecto; la enviada solo si coincide (±1 %); solo un admin con su clave puede fijarla a mano.
    const tasaCliente = Number(data.tasaBCV ?? data.tasa_bcv);
    const vigente = await obtenerTasaBcv();
    const tasaManualIn = data.tasa_manual && typeof data.tasa_manual === 'object' ? (data.tasa_manual as Raw) : null;
    const rolSesion = req.headers.get('x-session-role') ?? '';
    const decision = decidirTasa({ cliente: tasaCliente, vigente: vigente?.tasa ?? null, rol: rolSesion, manual: tasaManualIn !== null });
    if (decision.manual) await exigirPinSesion(req, tasaManualIn?.pin);
    const tasaNum = decision.tasa;

    const { filas: catalogo } = await listarEstudios(false);
    const serviciosLista = normalizarServicios(data, catalogo);
    const totalLista = serviciosLista.reduce((a, s) => a + s.precio, 0);
    if (data.precioUSD !== undefined && data.precioUSD !== null && data.precioUSD !== '' && toCents(data.precioUSD) !== totalLista) {
      throw new ApiError(400, 'El precio total no coincide con la suma de los servicios.');
    }

    // Descuentos: el servidor recalcula todo (promociones vigentes o descuento manual) y cobra el neto.
    await asegurarDescuentos();
    const manualIn = leerDescuentoManual(data.descuento);
    const promos = await promosActivas(fecha);
    let netos;
    try {
      netos = calcularFactura(serviciosLista.map((s) => ({ area: s.area, estudio: s.estudio, precio: s.precio, honorarios: s.honorarios, honPatologo: s.honPatologo })), promos, fecha, manualIn?.manual ?? null);
    } catch (err) {
      if (err instanceof DescuentoError) throw new ApiError(400, err.message);
      throw err;
    }
    const servicios: Servicio[] = serviciosLista.map((s, i) => ({
      ...s, precio: netos[i].precio, honorarios: netos[i].honorarios, honMedico: netos[i].honMedico, honPatologo: netos[i].honPatologo,
      ganancia: netos[i].ganancia, precioLista: netos[i].precioLista, descuento: netos[i].descuento, promoId: netos[i].promoId, modoDescuento: netos[i].modo,
    }));
    const totalPrecio = servicios.reduce((a, s) => a + s.precio, 0);
    const totalHonorarios = servicios.reduce((a, s) => a + s.honorarios, 0);
    const totalGanancia = totalPrecio - totalHonorarios;
    const totalDescuento = totalLista - totalPrecio;
    if (totalPrecio <= 0) throw new ApiError(400, 'El total de la factura debe ser mayor a 0.');
    let autorizadoPor: string | null = null;
    if (manualIn) {
      await exigirPinSesion(req, manualIn.pin);
      autorizadoPor = (await exigirAutorizacionDescuento({
        rol: req.headers.get('x-session-role') ?? '', porcentajeBp: porcentajeEfectivoBp(totalLista, totalDescuento), autorizador: manualIn.autorizador,
      })) ?? usuario;
    }
    const promosUsadas = Array.from(new Set(servicios.map((s) => s.promoId).filter((x): x is number => x !== null)));
    const descuentoOrigen = totalDescuento > 0 ? (manualIn ? 'MANUAL' : 'PROMO') : null;
    const descuentoModo = manualIn?.manual.modo ?? servicios.find((s) => s.modoDescuento)?.modoDescuento ?? null;
    const descuentoMotivo = manualIn?.motivo ?? (promosUsadas.length ? promos.filter((p) => promosUsadas.includes(p.id)).map((p) => p.nombre).join(' + ') : null);

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
    const sexo = esSexo(data.sexo) ? data.sexo : null;

    await asegurarMedioTransito(pool);
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
        precioUSD: Number(centsToStr(s.precio)), precioLista: Number(centsToStr(s.precioLista)), descuento: Number(centsToStr(s.descuento)), honorariosMedico: Number(centsToStr(s.honorarios)), gananciaClinica: Number(centsToStr(s.ganancia)),
      }));

      const resFactura = await client.query(
        `INSERT INTO facturas_caja
         (fecha, hora, cedula_paciente, nombre_paciente, estudio, medico, precio_usd, tasa_bcv,
          pago_punto, pago_movil, pago_efectivo_bs, pago_divisas, estado,
          servicios, total_honorarios, total_ganancia, turno_num, etapa_actual,
          telefono_paciente, estudio_principal_id, prioridad, grupo_clinico, fecha_nacimiento_paciente,
          precio_lista_usd, descuento_usd, descuento_modo, descuento_origen, descuento_motivo, descuento_promo_id, descuento_autorizado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
         RETURNING *`,
        [
          fecha, hora, cedula, nombre, estudioResumen, medicoResumen, centsToStr(totalPrecio), tasaNum,
          centsToStr(punto), centsToStr(movil), centsToStr(efBs), centsToStr(divisas), str(data.estado) || 'ESPERA',
          JSON.stringify(serviciosJson), centsToStr(totalHonorarios), centsToStr(totalGanancia), turnoNum,
          parseInt(str(data.etapaActual ?? data.etapa_actual), 10) || 0,
          str(data.telefono_paciente || data.telefono) || null, data.estudio_principal_id || null,
          str(data.prioridad) || 'NORMAL', str(data.grupo_clinico) || clasificarServicio(servicios[0]?.estudio ?? '', servicios[0]?.area).grupo, fechaNac,
          centsToStr(totalLista), centsToStr(totalDescuento), descuentoModo, descuentoOrigen, descuentoMotivo, promosUsadas[0] ?? null, autorizadoPor,
        ]
      );
      const f = resFactura.rows[0];

      for (const s of servicios) {
        await client.query(
          `INSERT INTO facturas_servicios_detalle
           (factura_id, estudio, medico, area, sala, precio_usd, honorarios_medico, ganancia_clinica, estado, orden, precio_lista_usd)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [f.id, s.estudio.toUpperCase(), (s.medico || 'DE GUARDIA').toUpperCase(), s.area.toUpperCase(), s.sala.toUpperCase(),
           centsToStr(s.precio), centsToStr(s.honorarios), centsToStr(s.ganancia), s.estado || 'ESPERA', s.orden, centsToStr(s.precioLista)]
        );
        if (s.honMedico > 0 && s.medico && s.medico !== 'De Guardia') {
          await client.query(
            `INSERT INTO honorarios_medicos_pendientes (factura_id, fecha_servicio, medico, estudio, paciente, monto_usd, estado)
             VALUES ($1,$2,$3,$4,$5,$6,'PENDIENTE')`,
            [f.id, fecha, s.medico, s.estudio, f.nombre_paciente, centsToStr(s.honMedico)]
          );
        }
        if (s.honPatologo > 0) {
          await client.query(
            `INSERT INTO honorarios_medicos_pendientes (factura_id, fecha_servicio, medico, estudio, paciente, monto_usd, estado)
             VALUES ($1,$2,$3,$4,$5,$6,'PENDIENTE')`,
            [f.id, fecha, BENEFICIARIO_PATOLOGO, s.estudio, f.nombre_paciente, centsToStr(s.honPatologo)]
          );
        }
      }

      if (cedula && nombre) {
        await client.query(
          `INSERT INTO pacientes (cedula, nombre, fecha_nacimiento, direccion, telefono, sexo)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (cedula) DO UPDATE
           SET nombre = COALESCE(NULLIF(EXCLUDED.nombre, ''), pacientes.nombre),
               fecha_nacimiento = COALESCE(EXCLUDED.fecha_nacimiento, pacientes.fecha_nacimiento),
               direccion = COALESCE(EXCLUDED.direccion, pacientes.direccion),
               telefono = COALESCE(EXCLUDED.telefono, pacientes.telefono),
               sexo = COALESCE(EXCLUDED.sexo, pacientes.sexo)`,
          [cedula, nombre, fechaNac, str(data.direccion || data.direccion_paciente).trim().toUpperCase() || null, str(data.telefono || data.telefono_paciente).trim() || null, sexo]
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
      if (movil > 0) {
        // Pago móvil: queda en tránsito y solo se abona a la cuenta al cerrar el día y conciliarlo con el banco.
        await client.query(
          `INSERT INTO transacciones_tarjetas_transito
           (factura_id, fecha_transaccion, hora_transaccion, cedula_paciente, nombre_paciente, monto_bruto_bs, estado, medio)
           VALUES ($1,$2,$3,$4,$5,$6,'PENDIENTE','PAGO_MOVIL')`,
          [f.id, fecha, hora, f.cedula_paciente, f.nombre_paciente, centsToStr(movil)]
        );
        await client.query(
          "UPDATE cuentas_bancarias SET saldo_transito = saldo_transito + $1::numeric, actualizado_en = NOW() WHERE codigo = 'PAGO_MOVIL_BS'",
          [centsToStr(movil)]
        );
      }
      if (efBs > 0) await acreditar(client, 'EFECTIVO_BS', efBs, 'BS', ctx, `Ingreso efectivo Bs factura ${f.id} (${f.nombre_paciente})`);
      if (divisas > 0) await acreditar(client, 'EFECTIVO_USD', divisas, 'USD', ctx, `Ingreso efectivo USD factura ${f.id} (${f.nombre_paciente})`);
      if (decision.manual) {
        await registrarBitacora(client, {
          tipo: 'TASA_MANUAL', fechaAfectada: fecha, ...actorSesion(req),
          descripcion: `Tasa BCV fijada a mano en ${tasaNum} (vigente ${vigente?.tasa ?? 'sin dato'}) para la factura ${f.id} (${f.nombre_paciente}).`,
          detalle: { factura_id: f.id, tasa_usada: tasaNum, tasa_vigente: vigente?.tasa ?? null },
        });
      }
      if (totalDescuento > 0) {
        await registrarBitacora(client, {
          tipo: 'DESCUENTO', fechaAfectada: fecha, ...actorSesion(req),
          descripcion: `Descuento de $${centsToStr(totalDescuento)} (${(porcentajeEfectivoBp(totalLista, totalDescuento) / 100).toFixed(2)} %) en la factura ${f.id} (${f.nombre_paciente}), origen ${descuentoOrigen}.`,
          detalle: { factura_id: f.id, lista: centsToStr(totalLista), descuento: centsToStr(totalDescuento), neto: centsToStr(totalPrecio), modo: descuentoModo, origen: descuentoOrigen, motivo: descuentoMotivo, autorizado_por: autorizadoPor },
        });
      }
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
