import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { ApiError, fechaHoraLocal } from '@/lib/apiHelpers';
import { sumarDias } from '@/lib/date';
import { centsToStr, toCents } from '@/lib/money';

type Db = Pick<PoolClient, 'query'>;
type Valor = string | number | boolean | null;

/** Días anteriores sin cierre que aún obligan a cerrar (más antiguos se consideran historial heredado). */
export const VENTANA_DIAS_CIERRE = 7;

/** Medios de pago que se cuentan al cerrar: clave del arqueo y columna de totales del sistema. */
export const METODOS_ARQUEO = [
  { clave: 'divisas_usd', campo: 'total_divisas_usd', etiqueta: 'Efectivo divisas ($)' },
  { clave: 'efectivo_bs', campo: 'total_efectivo_bs', etiqueta: 'Efectivo bolívares (Bs)' },
  { clave: 'punto_bs', campo: 'total_punto_bs', etiqueta: 'Punto de venta (Bs)' },
  { clave: 'pago_movil_bs', campo: 'total_pago_movil_bs', etiqueta: 'Pago móvil (Bs)' },
] as const;

export interface LineaArqueo { metodo: string; esperado: number; contado: number; diferencia: number }

/** Compara lo contado con lo esperado por método (centavos). diferencia > 0 = sobrante, < 0 = faltante. */
export function calcularArqueo(esperado: Record<string, number>, contado: Record<string, number>): LineaArqueo[] {
  return METODOS_ARQUEO.map((m) => ({
    metodo: m.clave, esperado: esperado[m.clave] ?? 0, contado: contado[m.clave] ?? 0, diferencia: (contado[m.clave] ?? 0) - (esperado[m.clave] ?? 0),
  }));
}

/** Valida y convierte a centavos lo contado por método; todos son obligatorios (0 es un valor válido). */
export function leerConteo(raw: unknown): Record<string, number> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const m of METODOS_ARQUEO) {
    const v = String(o[m.clave] ?? '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(v)) throw new ApiError(400, `Indique el monto contado de «${m.etiqueta}» (0 si no hubo).`);
    out[m.clave] = toCents(v);
  }
  return out;
}

export interface FilaActividad { f: string; n: number; pend: number }

/**
 * Elige el día más antiguo que debe cerrarse antes de operar. Función pura (testeable):
 *  - cualquier día anterior con pacientes en espera/atención obliga, aunque ya tenga cierre;
 *  - un día anterior con facturación y sin cierre obliga si está dentro de la ventana de días.
 */
export function elegirJornadaPendiente(filas: FilaActividad[], cerradas: Set<string>, hoy: string, ventana = VENTANA_DIAS_CIERRE): string | null {
  const limite = sumarDias(hoy, -ventana);
  for (const r of [...filas].sort((a, b) => a.f.localeCompare(b.f))) {
    if (r.f >= hoy) continue;
    if (r.pend > 0) return r.f;
    if (r.n > 0 && !cerradas.has(r.f) && r.f >= limite) return r.f;
  }
  return null;
}

async function columnasCierre(db: Db): Promise<Set<string>> {
  const r = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'cierres_diarios'");
  return new Set<string>(r.rows.map((x) => x.column_name));
}

/** Fechas con cierre consolidado (soporta ambas variantes del esquema de cierres_diarios). */
export async function fechasCerradas(db: Db = pool): Promise<Set<string>> {
  const cols = await columnasCierre(db);
  if (cols.size === 0) return new Set();
  const colFecha = cols.has('fecha_cierre') ? 'fecha_cierre' : 'fecha';
  let filtro = '';
  if (cols.has('consolidado')) filtro = ' WHERE consolidado = TRUE';
  else if (cols.has('estado')) filtro = " WHERE estado = 'CERRADO'";
  const r = await db.query(`SELECT to_char(${colFecha}, 'YYYY-MM-DD') AS f FROM cierres_diarios${filtro}`);
  return new Set<string>(r.rows.map((x) => x.f));
}

export async function ultimaFechaCerrada(db: Db = pool): Promise<string | null> {
  const c = Array.from(await fechasCerradas(db)).sort();
  return c.length ? c[c.length - 1] : null;
}

/** Día anterior que debe cerrarse antes de continuar, o null si la caja está al día. */
export async function jornadaPendiente(): Promise<string | null> {
  const hoy = fechaHoraLocal().fecha;
  const [cerradas, act] = await Promise.all([
    fechasCerradas(),
    pool.query(`SELECT to_char(fecha, 'YYYY-MM-DD') AS f,
                       COUNT(*) FILTER (WHERE estado NOT IN ('ANULADA', 'ANULADA_SALA')) AS n,
                       COUNT(*) FILTER (WHERE estado IN ('ESPERA', 'ATENCION')) AS pend
                FROM facturas_caja WHERE fecha < $1 GROUP BY 1`, [hoy]),
  ]);
  return elegirJornadaPendiente(act.rows.map((r) => ({ f: r.f, n: Number(r.n), pend: Number(r.pend) })), cerradas, hoy);
}

/** Bloquea operaciones de caja mientras exista un día anterior sin cerrar (el administrador no se bloquea). */
export async function exigirJornadaAlDia(esAdmin = false): Promise<void> {
  if (esAdmin) return;
  const fecha = await jornadaPendiente();
  if (fecha) {
    throw new ApiError(409, `Debe cerrar la caja del día ${fecha} antes de continuar operando. Solicite al administrador el cierre diario.`, 'CIERRE_PENDIENTE', { fecha });
  }
}

/** Pacientes en espera/atención y resultados sin enviar por WhatsApp de un día (o de todos si fecha es null). */
export async function evaluarDia(fecha: string | null) {
  const where = fecha ? ' AND fecha = $1' : '';
  const params = fecha ? [fecha] : [];
  const sala = await pool.query(`
    SELECT id, COALESCE(turno_num, id) AS numero_turno, COALESCE(nombre_paciente, 'Paciente #' || id) AS paciente_nombre,
           COALESCE(medico, 'De Guardia') AS doctor_nombre, COALESCE(estudio, 'Estudio Clínico') AS especialidad,
           COALESCE(precio_usd, 0) AS total_usd, COALESCE(telefono_paciente, '') AS telefono_paciente, estado, fecha,
           'SALA_ESPERA' AS tipo_bloqueo
    FROM facturas_caja WHERE estado IN ('ESPERA', 'ATENCION')${where} ORDER BY id ASC`, params);
  const whatsapp = await pool.query(`
    SELECT id, COALESCE(turno_num, id) AS numero_turno, COALESCE(nombre_paciente, 'Paciente #' || id) AS paciente_nombre,
           COALESCE(telefono_paciente, '') AS telefono_paciente, COALESCE(adjunto_nombre, '') AS adjunto_nombre,
           COALESCE(medico, 'De Guardia') AS doctor_nombre, COALESCE(estudio, 'Estudio Clínico') AS especialidad,
           COALESCE(precio_usd, 0) AS total_usd, estado, fecha, 'WHATSAPP_PENDIENTE' AS tipo_bloqueo
    FROM facturas_caja
    WHERE (estado IN ('FINALIZADO', 'COMPLETADO') OR etapa_actual = 2)
      AND (whatsapp_enviado = FALSE OR whatsapp_enviado IS NULL)
      AND adjunto_nombre IS NOT NULL AND TRIM(adjunto_nombre) != ''${where} ORDER BY id ASC`, params);
  const resumen = await pool.query(`
    SELECT COUNT(*) AS total_facturas, COALESCE(SUM(precio_usd), 0) AS total_usd,
           COALESCE(SUM(pago_divisas), 0) AS "totalDivisasUSD", COALESCE(SUM(pago_efectivo_bs), 0) AS "totalEfectivoBs",
           COALESCE(SUM(pago_punto), 0) AS "totalPuntoBs", COALESCE(SUM(pago_movil), 0) AS "totalPagoMovilBs"
    FROM facturas_caja WHERE estado NOT IN ('ANULADA', 'ANULADA_SALA')${where}`, params);
  return {
    pacientesPendientes: sala.rows,
    pacientesWhatsAppPendientes: whatsapp.rows,
    puedeCerrar: sala.rows.length === 0 && whatsapp.rows.length === 0,
    resumen: resumen.rows[0] || {},
  };
}

/** Escribe (o actualiza) el cierre de un día con totales completos. Compatible con ambas variantes del esquema. */
export async function consolidarCierre(client: PoolClient, fecha: string, usuario: string, observaciones: string, conteo?: Record<string, number>) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cierre:${fecha}`]);
  const ahora = fechaHoraLocal();

  const tot = (await client.query(
    `SELECT COUNT(*) FILTER (WHERE estado = 'FINALIZADO') AS atendidos,
            COALESCE(SUM(precio_usd), 0) AS total_usd, COALESCE(SUM(precio_usd * tasa_bcv), 0) AS total_bs,
            COALESCE(SUM(pago_divisas), 0) AS total_divisas_usd, COALESCE(SUM(pago_efectivo_bs), 0) AS total_efectivo_bs,
            COALESCE(SUM(pago_punto), 0) AS total_punto_bs, COALESCE(SUM(pago_movil), 0) AS total_pago_movil_bs
     FROM facturas_caja WHERE fecha = $1 AND estado NOT IN ('ANULADA', 'ANULADA_SALA')`, [fecha])).rows[0];

  const egr = await client.query('SELECT moneda, COALESCE(SUM(total_debitado), 0) AS t FROM egresos_operativos WHERE fecha = $1 GROUP BY moneda', [fecha]).catch(() => ({ rows: [] }));
  const ing = await client.query('SELECT moneda, COALESCE(SUM(monto), 0) AS t FROM ingresos_extraordinarios WHERE fecha = $1 GROUP BY moneda', [fecha]).catch(() => ({ rows: [] }));
  const porMoneda = (rows: { moneda: string; t: string }[], m: string) => centsToStr(toCents(rows.find((r) => r.moneda === m)?.t));
  const saldos = await client.query('SELECT codigo, saldo_actual FROM cuentas_bancarias');
  const saldo = (codigo: string) => centsToStr(toCents(saldos.rows.find((r) => r.codigo === codigo)?.saldo_actual));

  const candidatos: Record<string, Valor> = {
    fecha_cierre: fecha, fecha, hora_cierre: ahora.hora, usuario, observaciones, notas: observaciones, consolidado: true, estado: 'CERRADO',
    total_facturado_usd: centsToStr(toCents(tot.total_usd)), total_facturado_bs: centsToStr(toCents(tot.total_bs)),
    total_punto_bs: centsToStr(toCents(tot.total_punto_bs)), total_movil_bs: centsToStr(toCents(tot.total_pago_movil_bs)),
    total_efectivo_bs: centsToStr(toCents(tot.total_efectivo_bs)), total_divisas_usd: centsToStr(toCents(tot.total_divisas_usd)),
    total_egresos_bs: porMoneda(egr.rows, 'BS'), total_egresos_usd: porMoneda(egr.rows, 'USD'),
    total_ingresos_extra_bs: porMoneda(ing.rows, 'BS'), total_ingresos_extra_usd: porMoneda(ing.rows, 'USD'),
    saldo_cierre_efectivo_usd: saldo('EFECTIVO_USD'), saldo_cierre_efectivo_bs: saldo('EFECTIVO_BS'),
    saldo_cierre_punto_bs: saldo('PUNTO_VENTA_BS'), saldo_cierre_movil_bs: saldo('PAGO_MOVIL_BS'),
    pacientes_atendidos: parseInt(tot.atendidos, 10) || 0,
    metadata_auditoria: JSON.stringify({ cerrado_por: usuario, cerrado_en: new Date().toISOString() }),
  };

  const existentes = await columnasCierre(client);
  if (existentes.size === 0) throw new ApiError(500, 'La tabla cierres_diarios no existe.');
  const colFecha = existentes.has('fecha_cierre') ? 'fecha_cierre' : 'fecha';
  const datos = Object.entries(candidatos).filter(([k]) => existentes.has(k));

  const previo = await client.query(`SELECT id FROM cierres_diarios WHERE ${colFecha} = $1 LIMIT 1`, [fecha]);
  let fila: Record<string, unknown>;
  if (previo.rows.length > 0) {
    const resto = datos.filter(([k]) => k !== colFecha);
    const sets = resto.map(([k], i) => `${k} = $${i + 1}`);
    if (existentes.has('actualizado_en')) sets.push('actualizado_en = CURRENT_TIMESTAMP');
    const r = await client.query(`UPDATE cierres_diarios SET ${sets.join(', ')} WHERE id = $${resto.length + 1} RETURNING *`, [...resto.map(([, v]) => v), previo.rows[0].id]);
    fila = r.rows[0];
  } else {
    const r = await client.query(
      `INSERT INTO cierres_diarios (${datos.map(([k]) => k).join(', ')}) VALUES (${datos.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      datos.map(([, v]) => v)
    );
    fila = r.rows[0];
  }

  // Arqueo: lo contado por método frente a lo esperado según las facturas del día; queda registrado el sobrante/faltante.
  let arqueo: LineaArqueo[] = [];
  if (conteo) {
    // Esperado = lo cobrado en las facturas del día por medio de pago (egresos e ingresos extraordinarios no intervienen).
    arqueo = calcularArqueo(Object.fromEntries(METODOS_ARQUEO.map((m) => [m.clave, toCents(tot[m.campo])])), conteo);
    await client.query(`CREATE TABLE IF NOT EXISTS cierre_arqueos (
      fecha DATE NOT NULL, metodo VARCHAR(30) NOT NULL, esperado_cents BIGINT NOT NULL, contado_cents BIGINT NOT NULL,
      diferencia_cents BIGINT NOT NULL, usuario VARCHAR(100), creado_en TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (fecha, metodo))`);
    for (const l of arqueo) {
      await client.query(
        `INSERT INTO cierre_arqueos (fecha, metodo, esperado_cents, contado_cents, diferencia_cents, usuario) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (fecha, metodo) DO UPDATE SET esperado_cents = $3, contado_cents = $4, diferencia_cents = $5, usuario = $6, creado_en = now()`,
        [fecha, l.metodo, l.esperado, l.contado, l.diferencia, usuario],
      );
    }
  }
  return { fila, tot, arqueo };
}

/**
 * Una operación de tesorería se registró en un día ya cerrado: actualiza los totales de egresos e ingresos extraordinarios
 * del cierre (los saldos de cierre quedan como estaban) y deja constancia en las observaciones. No toca el arqueo.
 */
export async function marcarCierreModificado(client: PoolClient, fecha: string, motivo: string, usuario: string): Promise<void> {
  const cols = await columnasCierre(client);
  const colFecha = cols.has('fecha_cierre') ? 'fecha_cierre' : 'fecha';
  const previo = await client.query(`SELECT id FROM cierres_diarios WHERE ${colFecha} = $1 LIMIT 1`, [fecha]);
  if (previo.rows.length === 0) return;

  const egr = await client.query('SELECT moneda, COALESCE(SUM(total_debitado), 0) AS t FROM egresos_operativos WHERE fecha = $1 GROUP BY moneda', [fecha]).catch(() => ({ rows: [] }));
  const ing = await client.query('SELECT moneda, COALESCE(SUM(monto), 0) AS t FROM ingresos_extraordinarios WHERE fecha = $1 GROUP BY moneda', [fecha]).catch(() => ({ rows: [] }));
  const porMoneda = (rows: { moneda: string; t: string }[], m: string) => centsToStr(toCents(rows.find((r) => r.moneda === m)?.t));
  const nota = ` | Modificado el ${fechaHoraLocal().fecha} por ${usuario}: ${motivo}`;

  const sets: [string, Valor][] = [
    ['total_egresos_bs', porMoneda(egr.rows, 'BS')], ['total_egresos_usd', porMoneda(egr.rows, 'USD')],
    ['total_ingresos_extra_bs', porMoneda(ing.rows, 'BS')], ['total_ingresos_extra_usd', porMoneda(ing.rows, 'USD')],
  ].filter(([k]) => cols.has(k as string)) as [string, Valor][];
  const textos = ['observaciones', 'notas'].filter((c) => cols.has(c));
  const params: Valor[] = sets.map(([, v]) => v);
  const asign = sets.map(([k], i) => `${k} = $${i + 1}`);
  for (const c of textos) asign.push(`${c} = COALESCE(${c}, '') || $${params.length + 1}`);
  if (textos.length) params.push(nota);
  if (cols.has('actualizado_en')) asign.push('actualizado_en = CURRENT_TIMESTAMP');
  if (asign.length === 0) return;
  await client.query(`UPDATE cierres_diarios SET ${asign.join(', ')} WHERE id = $${params.length + 1}`, [...params, previo.rows[0].id]);
}

/**
 * Reabre un día cerrado (solo admin): guarda una copia íntegra del cierre y de su arqueo en `cierres_reabiertos`
 * y quita el cierre vigente, de modo que la jornada vuelve a quedar pendiente y debe cerrarse de nuevo.
 */
export async function reabrirCierre(client: PoolClient, fecha: string, motivo: string, usuario: string) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cierre:${fecha}`]);
  await client.query(`CREATE TABLE IF NOT EXISTS cierres_reabiertos (
    id SERIAL PRIMARY KEY, fecha DATE NOT NULL, cierre JSONB NOT NULL, arqueo JSONB, motivo TEXT NOT NULL,
    usuario VARCHAR(100), reabierto_en TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await client.query('ALTER TABLE cierres_reabiertos ENABLE ROW LEVEL SECURITY');

  const cols = await columnasCierre(client);
  if (cols.size === 0) throw new ApiError(500, 'La tabla cierres_diarios no existe.');
  const colFecha = cols.has('fecha_cierre') ? 'fecha_cierre' : 'fecha';
  const previo = await client.query(`SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) AS filas, COUNT(*)::int AS n FROM cierres_diarios c WHERE ${colFecha} = $1`, [fecha]);
  if (previo.rows[0].n === 0) throw new ApiError(409, `La caja del ${fecha} no está cerrada.`, 'CIERRE_NO_EXISTE');

  const hayArqueos = (await client.query("SELECT to_regclass('cierre_arqueos') AS t")).rows[0].t !== null;
  const arqueo = hayArqueos
    ? (await client.query("SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) AS filas FROM cierre_arqueos a WHERE fecha = $1", [fecha])).rows[0].filas
    : [];

  await client.query(
    'INSERT INTO cierres_reabiertos (fecha, cierre, arqueo, motivo, usuario) VALUES ($1, $2, $3, $4, $5)',
    [fecha, JSON.stringify(previo.rows[0].filas), JSON.stringify(arqueo), motivo, usuario],
  );
  if (hayArqueos) await client.query('DELETE FROM cierre_arqueos WHERE fecha = $1', [fecha]);
  await client.query(`DELETE FROM cierres_diarios WHERE ${colFecha} = $1`, [fecha]);
}
