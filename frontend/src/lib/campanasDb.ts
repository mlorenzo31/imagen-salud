import type { Pool, PoolClient } from 'pg';
import { ApiError } from '@/lib/apiHelpers';
import { asegurarCatalogo } from '@/lib/catalogoDb';
import { toCents } from '@/lib/money';
import { asegurarTablasWhatsapp, normalizarTelefono } from '@/lib/whatsapp';
import { MAX_DESTINATARIOS, personalizarMensaje, type Filtros, type PacienteSegmento } from '@/lib/segmentos';

type Db = Pick<Pool | PoolClient, 'query'>;

/** Versión mínima del worker que sabe enviar campañas (espaciado, tope diario y bajas). */
export const VERSION_WORKER_CAMPANAS = 2;

export async function asegurarTablasCampanas(db: Db): Promise<void> {
  await asegurarTablasWhatsapp(db);
  await db.query(`
    CREATE TABLE IF NOT EXISTS wa_campanas (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
      total INT NOT NULL DEFAULT 0,
      usuario TEXT,
      creado TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await db.query(`CREATE TABLE IF NOT EXISTS wa_baja (telefono TEXT PRIMARY KEY, creado TIMESTAMPTZ NOT NULL DEFAULT now())`);
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

interface FilaSegmento {
  cedula: string; nombre: string; telefono: string | null; fecha_nacimiento: string | null; edad: number | null;
  visitas: number; gasto_cents: string | number; ultima_visita: string | null;
  estudios: string[] | null; medicos: string[] | null; areas: string[] | null; baja: boolean;
}

/** Pacientes que cumplen los filtros (visitas/gasto/última visita se calculan sobre todas sus atenciones no anuladas). */
export async function consultarSegmento(db: Db, f: Filtros): Promise<{ pacientes: PacienteSegmento[]; conBaja: number }> {
  await asegurarTablasCampanas(db);
  try { await asegurarCatalogo(); } catch { /* sin columna activo: se asume activo */ }
  const tieneActivo = (await db.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'activo'`,
  )).rowCount! > 0;

  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  const donde: string[] = [];
  if (f.edadMin != null) donde.push(`s.edad >= ${p(f.edadMin)}`);
  if (f.edadMax != null) donde.push(`s.edad <= ${p(f.edadMax)}`);
  if (f.estudios.length) donde.push(`EXISTS (SELECT 1 FROM unnest(s.estudios) e WHERE e ILIKE ANY(${p(f.estudios.map((e) => `%${escapeLike(e)}%`))}::text[]))`);
  if (f.areas.length) donde.push(`s.areas && ${p(f.areas)}::text[]`);
  if (f.medicos.length) donde.push(`s.medicos && ${p(f.medicos)}::text[]`);
  if (f.ultimaVisitaDesde) donde.push(`s.ultima_visita >= ${p(f.ultimaVisitaDesde)}::date`);
  if (f.ultimaVisitaHasta) donde.push(`s.ultima_visita <= ${p(f.ultimaVisitaHasta)}::date`);
  if (f.inactivoDias != null) donde.push(`s.ultima_visita IS NOT NULL AND s.ultima_visita <= s.hoy - ${p(f.inactivoDias)}::int`);
  if (f.visitasMin != null) donde.push(`s.visitas >= ${p(f.visitasMin)}`);
  if (f.visitasMax != null) donde.push(`s.visitas <= ${p(f.visitasMax)}`);
  if (f.gastoMinUsd != null) donde.push(`s.gasto_cents >= ${p(toCents(f.gastoMinUsd))}`);
  if (f.gastoMaxUsd != null) donde.push(`s.gasto_cents <= ${p(toCents(f.gastoMaxUsd))}`);
  if (f.busqueda) {
    const dig = f.busqueda.replace(/\D/g, '');
    donde.push(dig
      ? `(s.nombre ILIKE ${p(`%${escapeLike(f.busqueda)}%`)} OR s.ced LIKE ${p(`%${dig}%`)})`
      : `s.nombre ILIKE ${p(`%${escapeLike(f.busqueda)}%`)}`);
  }

  const { rows } = await db.query<FilaSegmento>(`
    WITH hoy AS (SELECT (now() AT TIME ZONE 'America/Caracas')::date AS d),
    fac AS (
      SELECT regexp_replace(f.cedula_paciente, '[^0-9]', '', 'g') AS ced, f.id, f.fecha, f.estudio, f.medico, f.precio_usd,
             NULLIF(f.telefono_paciente, '') AS tel, f.fecha_nacimiento_paciente AS fnac, f.nombre_paciente
        FROM facturas_caja f
       WHERE f.estado NOT IN ('ANULADA', 'ANULADA_SALA') AND COALESCE(f.cedula_paciente, '') <> ''
    ),
    agg AS (
      SELECT ced, COUNT(*)::int AS visitas,
             COALESCE(SUM(ROUND(COALESCE(precio_usd, 0) * 100)), 0)::bigint AS gasto_cents,
             MAX(fecha) AS ultima,
             array_remove(array_agg(DISTINCT estudio), NULL) AS estudios,
             array_remove(array_agg(DISTINCT medico), NULL) AS medicos,
             (array_agg(tel ORDER BY id DESC) FILTER (WHERE tel IS NOT NULL))[1] AS tel,
             (array_agg(fnac ORDER BY id DESC) FILTER (WHERE fnac IS NOT NULL))[1] AS fnac,
             (array_agg(nombre_paciente ORDER BY id DESC))[1] AS nombre
        FROM fac GROUP BY ced
    ),
    areas AS (
      SELECT fac.ced, array_agg(DISTINCT d.area) FILTER (WHERE d.area IS NOT NULL) AS areas
        FROM fac JOIN facturas_servicios_detalle d ON d.factura_id = fac.id GROUP BY fac.ced
    ),
    pac AS (
      SELECT DISTINCT ON (regexp_replace(p.cedula, '[^0-9]', '', 'g'))
             regexp_replace(p.cedula, '[^0-9]', '', 'g') AS ced, p.cedula, p.nombre, p.telefono, p.fecha_nacimiento,
             ${tieneActivo ? 'COALESCE(p.activo, TRUE)' : 'TRUE'} AS activo
        FROM pacientes p ORDER BY 1, p.id DESC
    ),
    s AS (
      SELECT COALESCE(pac.ced, agg.ced) AS ced,
             COALESCE(pac.cedula, agg.ced) AS cedula,
             COALESCE(NULLIF(pac.nombre, ''), agg.nombre, '') AS nombre,
             COALESCE(NULLIF(pac.telefono, ''), agg.tel) AS telefono,
             COALESCE(pac.fecha_nacimiento, agg.fnac) AS fnac,
             COALESCE(agg.visitas, 0) AS visitas,
             COALESCE(agg.gasto_cents, 0) AS gasto_cents,
             agg.ultima AS ultima_visita,
             COALESCE(agg.estudios, '{}') AS estudios,
             COALESCE(agg.medicos, '{}') AS medicos,
             COALESCE(areas.areas, '{}') AS areas,
             (SELECT d FROM hoy) AS hoy
        FROM pac FULL JOIN agg ON agg.ced = pac.ced
        LEFT JOIN areas ON areas.ced = COALESCE(pac.ced, agg.ced)
       WHERE COALESCE(pac.activo, TRUE)
    )
    SELECT s.cedula, s.nombre, s.telefono, to_char(s.fnac, 'YYYY-MM-DD') AS fecha_nacimiento,
           s.visitas, s.gasto_cents, to_char(s.ultima_visita, 'YYYY-MM-DD') AS ultima_visita,
           s.estudios, s.medicos, s.areas,
           EXISTS (SELECT 1 FROM wa_baja b WHERE b.telefono = right(regexp_replace(COALESCE(s.telefono, ''), '[^0-9]', '', 'g'), 10)) AS baja,
           s.edad
      FROM (SELECT s.*, CASE WHEN s.fnac IS NULL THEN NULL ELSE date_part('year', age(s.hoy, s.fnac))::int END AS edad FROM s) s
     ${donde.length ? 'WHERE ' + donde.join(' AND ') : ''}
     ORDER BY s.nombre
     LIMIT 5000`, params);

  let conBaja = 0;
  const pacientes = rows.map((r): PacienteSegmento => {
    if (r.baja) conBaja++;
    const edad = r.edad !== null && r.edad >= 0 && r.edad <= 120 ? r.edad : null;
    return {
      cedula: r.cedula, nombre: r.nombre, telefono: r.telefono, fecha_nacimiento: r.fecha_nacimiento, edad,
      visitas: r.visitas, gasto_cents: Number(r.gasto_cents), ultima_visita: r.ultima_visita,
      estudios: r.estudios ?? [], medicos: r.medicos ?? [], areas: r.areas ?? [],
      contactable: !r.baja && normalizarTelefono(r.telefono) !== null,
    };
  });
  return { pacientes, conBaja };
}

/** Valores disponibles para los filtros (áreas, médicos y estudios con atenciones). */
export async function opcionesFiltros(db: Db): Promise<{ areas: string[]; medicos: string[]; estudios: string[] }> {
  const q = async (sql: string) => (await db.query<{ v: string }>(sql)).rows.map((r) => r.v);
  return {
    areas: await q(`SELECT DISTINCT area AS v FROM facturas_servicios_detalle WHERE COALESCE(area, '') <> '' ORDER BY 1`),
    medicos: await q(`SELECT DISTINCT medico AS v FROM facturas_caja WHERE COALESCE(medico, '') <> '' ORDER BY 1`),
    estudios: await q(`SELECT estudio AS v FROM facturas_caja WHERE COALESCE(estudio, '') <> '' GROUP BY estudio ORDER BY COUNT(*) DESC LIMIT 60`),
  };
}

/** Crea la campaña y encola un mensaje por paciente contactable (el servidor vuelve a calcular el segmento). */
export async function crearCampana(
  client: PoolClient,
  a: { nombre: string; mensaje: string; filtros: Filtros; excluir: string[]; usuario: string },
): Promise<{ campanaId: number; encolados: number; omitidos: number }> {
  const bot = await client.query<{ version: number | null; vivo: boolean; estado: string }>(
    `SELECT version, estado, (latido IS NOT NULL AND latido > now() - interval '90 seconds') AS vivo FROM wa_estado WHERE id = 1`,
  );
  const b = bot.rows[0];
  if (!b?.vivo || b.estado !== 'CONECTADO') throw new ApiError(409, 'El bot de WhatsApp no está conectado. Vincúlelo e inténtelo de nuevo.', 'BOT_APAGADO');
  if ((b.version ?? 1) < VERSION_WORKER_CAMPANAS) {
    throw new ApiError(409, 'El bot de la clínica es una versión anterior: actualice whatsapp-worker (worker.mjs) y reinícielo antes de enviar campañas.', 'BOT_DESACTUALIZADO');
  }

  const { pacientes } = await consultarSegmento(client, a.filtros);
  const fuera = new Set(a.excluir.map((c) => c.replace(/\D/g, '')));
  const vistos = new Set<string>();
  const destinos: { nombre: string; tel: string }[] = [];
  for (const p of pacientes) {
    if (!p.contactable || fuera.has(p.cedula.replace(/\D/g, ''))) continue;
    const tel = normalizarTelefono(p.telefono)!;
    if (vistos.has(tel)) continue; // familiares con el mismo número: un solo mensaje
    vistos.add(tel);
    destinos.push({ nombre: p.nombre, tel });
  }
  if (destinos.length === 0) throw new ApiError(400, 'No hay pacientes contactables en el segmento.');
  if (destinos.length > MAX_DESTINATARIOS) throw new ApiError(400, `Máximo ${MAX_DESTINATARIOS} destinatarios por campaña (el segmento tiene ${destinos.length}). Afine los filtros o divida la campaña.`);

  const c = await client.query<{ id: number }>(
    `INSERT INTO wa_campanas (nombre, mensaje, filtros, total, usuario) VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING id`,
    [a.nombre, a.mensaje, JSON.stringify(a.filtros), destinos.length, a.usuario],
  );
  const campanaId = c.rows[0].id;
  for (const d of destinos) {
    await client.query(
      `INSERT INTO wa_outbox (factura_id, telefono, mensaje, campana_id) VALUES (NULL, $1, $2, $3)`,
      [d.tel, personalizarMensaje(a.mensaje, d.nombre), campanaId],
    );
  }
  return { campanaId, encolados: destinos.length, omitidos: pacientes.length - destinos.length };
}

export interface ResumenCampana {
  id: number; nombre: string; mensaje: string; total: number; usuario: string | null; creado: string;
  pendientes: number; enviados: number; fallidos: number;
}

export async function listarCampanas(db: Db): Promise<ResumenCampana[]> {
  await asegurarTablasCampanas(db);
  const { rows } = await db.query<ResumenCampana>(`
    SELECT c.id, c.nombre, c.mensaje, c.total, c.usuario, c.creado::text AS creado,
           COUNT(o.*) FILTER (WHERE o.estado IN ('PENDIENTE','ENVIANDO'))::int AS pendientes,
           COUNT(o.*) FILTER (WHERE o.estado = 'ENVIADO')::int AS enviados,
           COUNT(o.*) FILTER (WHERE o.estado = 'FALLIDO')::int AS fallidos
      FROM wa_campanas c LEFT JOIN wa_outbox o ON o.campana_id = c.id
     GROUP BY c.id ORDER BY c.id DESC LIMIT 50`);
  return rows;
}

/** Cancela los mensajes aún pendientes de una campaña. */
export async function cancelarCampana(db: Db, id: number): Promise<number> {
  const r = await db.query(
    `UPDATE wa_outbox SET estado = 'FALLIDO', error = 'Cancelada por el administrador' WHERE campana_id = $1 AND estado = 'PENDIENTE'`,
    [id],
  );
  return r.rowCount ?? 0;
}
