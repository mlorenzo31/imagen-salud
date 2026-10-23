/**
 * Contingencia en BD (Fase 5): talonarios autorizados, la contingencia vigente (una sola sin remitir a la vez),
 * el registro de cada factura física y su remisión en PDF a la imprenta digital (art. 7).
 */
import type { PoolClient } from 'pg';
import { toCents } from '@/lib/money';
import type { DocumentoFiscal } from './factura';
import { fechaFiscal } from './formato';
import { conTiempo, entradaDesdeCobro, guardarFactura, type Cobro } from './emision';
import {
  estadoContingencia, numeroFacturaContingencia, rangosSeSolapan, type EstadoContingencia, type MotivoContingencia, type Talonario,
} from './contingencia';
import { pdfRelacionContingencia } from './relacionPdf';
import type { ProveedorFiscal } from './proveedor';

type Db = Pick<PoolClient, 'query'>;

export type TalonarioGuardado = Talonario & { id: number; activo: boolean; usados: number };

const COLS_TALONARIO = `t.id, t.serie, t.imprenta_razon_social, t.imprenta_rif, t.imprenta_providencia,
  t.imprenta_fecha_providencia::text AS imprenta_fecha_providencia, t.fecha_elaboracion::text AS fecha_elaboracion,
  t.control_desde, t.control_hasta, t.factura_desde, t.factura_hasta, t.activo`;

function filaTalonario(x: Record<string, unknown>): TalonarioGuardado {
  return {
    id: Number(x.id), serie: String(x.serie), imprentaRazonSocial: String(x.imprenta_razon_social), imprentaRif: String(x.imprenta_rif),
    imprentaProvidencia: String(x.imprenta_providencia), imprentaFechaProvidencia: String(x.imprenta_fecha_providencia),
    fechaElaboracion: String(x.fecha_elaboracion), controlDesde: String(x.control_desde), controlHasta: String(x.control_hasta),
    facturaDesde: Number(x.factura_desde), facturaHasta: Number(x.factura_hasta), activo: Boolean(x.activo), usados: Number(x.usados ?? 0),
  };
}

export async function listarTalonarios(db: Db): Promise<TalonarioGuardado[]> {
  const r = await db.query(
    `SELECT ${COLS_TALONARIO}, (SELECT count(*)::int FROM documentos_fiscales d WHERE d.talonario_id = t.id) AS usados
     FROM talonarios_contingencia t ORDER BY t.activo DESC, t.id DESC`
  );
  return r.rows.map(filaTalonario);
}

/** Registra un talonario. Sus N° de control no pueden repetir los de otro talonario (art. 27). Dentro de una transacción. */
export async function crearTalonario(client: Db, t: Talonario, usuario: string): Promise<number> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('fiscal:talonarios'))");
  for (const otro of await listarTalonarios(client)) {
    if (otro.serie === t.serie) throw new Error(`Ya existe un talonario con la serie ${t.serie}.`);
    if (rangosSeSolapan(otro, t)) throw new Error(`Los N° de control se cruzan con el talonario serie ${otro.serie} (${otro.controlDesde} a ${otro.controlHasta}).`);
  }
  const r = await client.query(
    `INSERT INTO talonarios_contingencia (serie, imprenta_razon_social, imprenta_rif, imprenta_providencia, imprenta_fecha_providencia,
       fecha_elaboracion, control_desde, control_hasta, factura_desde, factura_hasta, usuario)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [t.serie, t.imprentaRazonSocial, t.imprentaRif, t.imprentaProvidencia, t.imprentaFechaProvidencia, t.fechaElaboracion,
      t.controlDesde, t.controlHasta, t.facturaDesde, t.facturaHasta, usuario]
  );
  return r.rows[0].id;
}

export async function activarTalonario(db: Db, id: number, activo: boolean): Promise<void> {
  const r = await db.query('UPDATE talonarios_contingencia SET activo = $2 WHERE id = $1', [id, activo]);
  if (r.rowCount === 0) throw new Error('Talonario no encontrado.');
}

export interface ContingenciaVigente {
  id: number;
  motivo: MotivoContingencia;
  observacion: string | null;
  fechaInicio: string;
  horaInicio: string;
  fechaFin: string | null;
  horaFin: string | null;
  abiertaPor: string;
  ultimoError: string | null;
  documentos: number;
  estado: EstadoContingencia;
}

/** La contingencia aún no remitida (activa o cerrada pendiente de envío), o null. */
export async function contingenciaVigente(db: Db, hoy: string, bloquear = false): Promise<ContingenciaVigente | null> {
  const r = await db.query(
    `SELECT c.id, c.motivo, c.observacion, c.fecha_inicio::text AS fecha_inicio, c.hora_inicio, c.fecha_fin::text AS fecha_fin, c.hora_fin,
            c.abierta_por, c.ultimo_error,
            (SELECT count(*)::int FROM documentos_fiscales d WHERE d.contingencia_id = c.id AND d.estado = 'CONTINGENCIA') AS documentos
     FROM contingencias c WHERE c.enviada_en IS NULL ${bloquear ? 'FOR UPDATE' : ''}`
  );
  const x = r.rows[0];
  if (!x) return null;
  return {
    id: x.id, motivo: x.motivo, observacion: x.observacion, fechaInicio: x.fecha_inicio, horaInicio: x.hora_inicio,
    fechaFin: x.fecha_fin, horaFin: x.hora_fin, abiertaPor: x.abierta_por, ultimoError: x.ultimo_error, documentos: x.documentos,
    estado: estadoContingencia({ fechaFin: x.fecha_fin, enviada: false }, hoy),
  };
}

/**
 * Activa la contingencia. Si hay una cerrada que aún no se remitió, la reabre (la falla volvió): así todos los
 * documentos físicos del episodio van en una sola relación. Dentro de una transacción.
 */
export async function activarContingencia(
  client: Db, p: { motivo: MotivoContingencia; observacion: string | null; usuario: string; fecha: string; hora: string },
): Promise<{ id: number; reabierta: boolean }> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('fiscal:contingencia'))");
  const v = await contingenciaVigente(client, p.fecha, true);
  if (v && v.fechaFin === null) throw new Error('Ya hay una contingencia activa.');
  if (v) {
    await client.query('UPDATE contingencias SET fecha_fin = NULL, hora_fin = NULL, cerrada_por = NULL WHERE id = $1', [v.id]);
    return { id: v.id, reabierta: true };
  }
  const r = await client.query(
    'INSERT INTO contingencias (motivo, observacion, fecha_inicio, hora_inicio, abierta_por) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [p.motivo, p.observacion, p.fecha, p.hora, p.usuario]
  );
  return { id: r.rows[0].id, reabierta: false };
}

/** Cesa la contingencia: desde aquí corre el plazo del art. 7 (remitir al día siguiente). */
export async function cerrarContingencia(client: Db, p: { usuario: string; fecha: string; hora: string }): Promise<ContingenciaVigente> {
  const v = await contingenciaVigente(client, p.fecha, true);
  if (!v || v.fechaFin !== null) throw new Error('No hay una contingencia activa.');
  await client.query('UPDATE contingencias SET fecha_fin = $2, hora_fin = $3, cerrada_por = $4 WHERE id = $1', [v.id, p.fecha, p.hora, p.usuario]);
  return { ...v, fechaFin: p.fecha, horaFin: p.hora, estado: estadoContingencia({ fechaFin: p.fecha, enviada: false }, p.fecha) };
}

/**
 * Registra la factura física de un cobro con el N° de control preimpreso del talonario. Valida que el número
 * pertenezca a un talonario activo y que no se haya usado. Dentro de la transacción del cobro.
 */
export async function registrarFacturaContingencia(
  client: Db, cobro: Omit<Cobro, 'numero'>, meta: { facturaCajaId: number; usuario: string; numeroControl: string },
): Promise<{ id: number; documento: DocumentoFiscal }> {
  // FOR SHARE: no se remite la contingencia mientras se le agrega un documento.
  const c = await client.query('SELECT id FROM contingencias WHERE enviada_en IS NULL FOR SHARE');
  if (!c.rows[0]) throw new Error('No hay una contingencia abierta: la factura se emite por la imprenta digital.');
  const talonarios = (await client.query(`SELECT ${COLS_TALONARIO} FROM talonarios_contingencia t WHERE t.activo`)).rows.map(filaTalonario);
  const talonario = talonarios.find((t) => numeroFacturaContingencia(t, meta.numeroControl) !== null);
  if (!talonario) throw new Error(`El N° de control ${meta.numeroControl} no pertenece a ningún talonario activo.`);
  const usado = await client.query('SELECT 1 FROM documentos_fiscales WHERE numero_control = $1', [meta.numeroControl]);
  if (usado.rows.length) throw new Error(`El N° de control ${meta.numeroControl} ya fue usado.`);
  const numero = String(numeroFacturaContingencia(talonario, meta.numeroControl)).padStart(8, '0');
  return guardarFactura(client, { ...entradaDesdeCobro({ ...cobro, numero }), numeroControl: meta.numeroControl }, {
    cobros: [meta.facturaCajaId], usuario: meta.usuario, contingencia: { talonario, contingenciaId: c.rows[0].id },
  });
}

export type ResultadoEnvioContingencia =
  | { estado: 'ENVIADA'; documentos: number; pendientes: number }
  | { estado: 'ERROR'; error: string };

/**
 * Art. 7: remite a la imprenta digital todos los documentos físicos de la contingencia cerrada, con su relación
 * en PDF. La llamada externa va fuera de transacción; luego se marcan como EMITIDO en una transacción corta.
 */
export async function enviarContingencia(
  pool: { query: Db['query']; connect(): Promise<PoolClient> }, proveedor: ProveedorFiscal,
  p: { emisor: { razonSocial: string; rif: string }; hoy: string; timeoutMs?: number },
): Promise<ResultadoEnvioContingencia> {
  const v = await contingenciaVigente(pool, p.hoy);
  if (!v) throw new Error('No hay una contingencia pendiente de envío.');
  if (v.fechaFin === null) throw new Error('Primero cierre la contingencia (art. 7: se remite una vez cesada).');
  const docs = await pool.query(
    `SELECT id, tipo, serie, numero, numero_control, fecha_emision::text AS fecha, receptor_nombre, receptor_documento, total_usd, total_bs, payload
     FROM documentos_fiscales WHERE contingencia_id = $1 AND estado = 'CONTINGENCIA' ORDER BY serie, numero`,
    [v.id]
  );
  const ids: number[] = docs.rows.map((d) => d.id);
  let crudo: unknown = null;
  if (ids.length) {
    const pdf = pdfRelacionContingencia({
      emisor: p.emisor,
      contingencia: { id: v.id, motivo: v.motivo, inicio: `${fechaFiscal(v.fechaInicio)} ${v.horaInicio}`, fin: `${fechaFiscal(v.fechaFin)} ${v.horaFin ?? ''}`.trim() },
      documentos: docs.rows.map((d) => ({
        tipo: d.tipo, serie: d.serie, numero: d.numero, numeroControl: d.numero_control, fecha: fechaFiscal(d.fecha),
        receptor: `${d.receptor_nombre} · ${d.receptor_documento}`, totalUsd: toCents(d.total_usd), totalBs: toCents(d.total_bs),
      })),
    });
    try {
      const r = await conTiempo(proveedor.registrarContingencia({ contingenciaId: v.id, documentos: docs.rows.map((d) => d.payload as DocumentoFiscal), pdf, hoy: p.hoy }), p.timeoutMs ?? 15000);
      crudo = r.crudo ?? null;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await pool.query('UPDATE contingencias SET ultimo_error = $2 WHERE id = $1', [v.id, error]);
      return { estado: 'ERROR', error };
    }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT 1 FROM contingencias WHERE id = $1 FOR UPDATE', [v.id]);
    await client.query(
      `UPDATE documentos_fiscales SET estado = 'EMITIDO', emitido_en = now(), ultimo_error = NULL, respuesta_proveedor = $2
       WHERE id = ANY($1::int[]) AND estado = 'CONTINGENCIA'`,
      [ids, JSON.stringify(crudo)]
    );
    // Si se registró otro documento físico durante el envío, la contingencia sigue abierta para remitirlo.
    const resto = await client.query("SELECT count(*)::int AS n FROM documentos_fiscales WHERE contingencia_id = $1 AND estado = 'CONTINGENCIA'", [v.id]);
    const pendientes: number = resto.rows[0].n;
    if (pendientes === 0) {
      await client.query('UPDATE contingencias SET enviada_en = now(), ultimo_error = NULL, respuesta_proveedor = $2 WHERE id = $1', [v.id, JSON.stringify(crudo)]);
    }
    await client.query('COMMIT');
    return { estado: 'ENVIADA', documentos: ids.length, pendientes };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
