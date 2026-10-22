/**
 * Emisión de la factura fiscal al cobrar (Fase 3).
 * 1. Dentro de la transacción del cobro se numera y guarda el documento como PENDIENTE (si el cobro se revierte, no queda nada).
 * 2. Tras confirmar, se envía a la imprenta digital: un solo envío a la vez por documento (estado ENVIANDO con plazo),
 *    con el id del documento como clave de idempotencia y reintentos con espera creciente.
 * El cobro nunca se bloquea por la imprenta: lo no emitido queda pendiente y visible.
 */
import type { PoolClient } from 'pg';
import { construirFactura, type ConfigEmisor, type DocumentoFiscal, type EntradaFactura, type LineaEntrada } from './factura';
import { fechaFiscal } from './formato';
import { guardarDocumento, siguienteNumero } from './fiscalDb';
import { ErrorRechazo, validarRespuesta, type ProveedorFiscal } from './proveedor';
import type { ReceptorAlterno } from './configEmisor';

type Db = Pick<PoolClient, 'query'>;

export interface ServicioCobrado {
  codigo: string | null;
  estudio: string;
  area: string;
  /** Centavos USD antes del descuento. */
  precioLista: number;
  /** Centavos USD. */
  descuento: number;
}

export interface Cobro {
  numero: string;
  fecha: string;
  hora: string;
  tasa: string | number;
  pagoDivisasUsd: number;
  emisor: ConfigEmisor;
  paciente: { nombre: string; cedula: string; direccion: string };
  facturarA: ReceptorAlterno | null;
  servicios: ServicioCobrado[];
}

/**
 * Datos del cobro → factura. Los servicios médicos son exentos de IVA (alícuota 0). Si el estudio no tiene
 * código de operación en el catálogo se usa su área.
 */
export function entradaDesdeCobro(c: Cobro): EntradaFactura {
  const receptor = c.facturarA
    ? { nombre: c.facturarA.razonSocial, documento: c.facturarA.rif, domicilio: c.facturarA.domicilio }
    : { nombre: c.paciente.nombre, documento: c.paciente.cedula, domicilio: c.paciente.direccion };
  return {
    numero: c.numero, numeroControl: null, fechaAsignacionControl: null, fecha: c.fecha, hora: c.hora,
    receptor: receptor.domicilio ? receptor : { nombre: receptor.nombre, documento: receptor.documento },
    lineas: c.servicios.map((s) => lineaDeServicio(s, s.estudio)), tasa: c.tasa, pagoDivisasUsd: c.pagoDivisasUsd, emisor: c.emisor,
  };
}

/** Servicio médico → línea de factura (exento, alícuota 0); sin código de operación en el catálogo se usa el área. */
function lineaDeServicio(s: ServicioCobrado, descripcion: string): LineaEntrada {
  return { codigo: s.codigo?.trim() || s.area, descripcion, cantidad: 1, precioUnitarioUsd: s.precioLista, descuentoUsd: s.descuento, alicuota: 0 };
}

export interface CobroDiferido {
  id: number;
  paciente: Cobro['paciente'];
  facturarA: ReceptorAlterno | null;
  pagoDivisasUsd: number;
  servicios: ServicioCobrado[];
}

/**
 * Factura de cobros diferidos. Un cobro: igual que al cobrar (paciente o su "Facturar a").
 * Varios: factura consolidada a un receptor (aseguradora o empresa) con una línea por servicio y paciente.
 */
export function entradaParaCobros(p: {
  numero: string; fecha: string; hora: string; tasa: string | number; emisor: ConfigEmisor;
  cobros: CobroDiferido[]; receptor: ReceptorAlterno | null;
}): EntradaFactura {
  if (p.cobros.length === 0) throw new Error('Seleccione al menos un cobro.');
  const pagoDivisasUsd = p.cobros.reduce((a, c) => a + c.pagoDivisasUsd, 0);
  if (p.cobros.length === 1) {
    const c = p.cobros[0];
    return entradaDesdeCobro({ numero: p.numero, fecha: p.fecha, hora: p.hora, tasa: p.tasa, emisor: p.emisor, pagoDivisasUsd,
      paciente: c.paciente, facturarA: p.receptor ?? c.facturarA, servicios: c.servicios });
  }
  if (!p.receptor) throw new Error('La factura consolidada necesita el receptor (razón social y RIF).');
  const base = entradaDesdeCobro({ numero: p.numero, fecha: p.fecha, hora: p.hora, tasa: p.tasa, emisor: p.emisor, pagoDivisasUsd,
    paciente: { nombre: '', cedula: '', direccion: '' }, facturarA: p.receptor, servicios: [] });
  const lineas = p.cobros.flatMap((c) => c.servicios.map((s) => lineaDeServicio(s, `${s.estudio} — ${c.paciente.nombre} (${c.paciente.cedula})`)));
  return { ...base, lineas };
}

/**
 * Arma y guarda la factura PENDIENTE, la enlaza a sus cobros (UNIQUE: un cobro no puede quedar en dos facturas)
 * y cierra los diferimientos que cubre. Dentro de una transacción.
 */
export async function guardarFactura(client: Db, entrada: EntradaFactura, meta: { cobros: number[]; usuario: string }): Promise<{ id: number; documento: DocumentoFiscal }> {
  const documento = construirFactura(entrada);
  const id = await guardarDocumento(client, documento, {
    facturaCajaId: meta.cobros.length === 1 ? meta.cobros[0] : null, usuario: meta.usuario, fecha: entrada.fecha, hora: entrada.hora,
  });
  for (const c of meta.cobros) await client.query('INSERT INTO documentos_fiscales_cobros (documento_id, factura_caja_id) VALUES ($1, $2)', [id, c]);
  await client.query('UPDATE facturacion_diferida SET resuelto_en = now(), documento_id = $1 WHERE factura_caja_id = ANY($2) AND resuelto_en IS NULL', [id, meta.cobros]);
  return { id, documento };
}

/** Numera, arma y guarda la factura fiscal como PENDIENTE dentro de la transacción del cobro. */
export async function registrarFacturaFiscal(
  client: Db, cobro: Omit<Cobro, 'numero'>, meta: { facturaCajaId: number; usuario: string },
): Promise<{ id: number; documento: DocumentoFiscal }> {
  const numero = await siguienteNumero(client, 'FACTURA');
  return guardarFactura(client, entradaDesdeCobro({ ...cobro, numero }), { cobros: [meta.facturaCajaId], usuario: meta.usuario });
}

/** Segundos de espera antes del reintento N (30 s, 1 min, 2 min, … hasta 30 min). */
export function esperaReintento(intentos: number): number {
  return Math.min(30 * 2 ** Math.max(0, intentos - 1), 1800);
}

export type ResultadoEmision =
  | { estado: 'EMITIDO'; numeroControl: string; pdfUrl: string | null }
  | { estado: 'PENDIENTE' | 'ERROR'; error: string }
  | { estado: 'OMITIDO' };

function conTiempo<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`La imprenta no respondió en ${ms / 1000} s.`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * Envía un documento PENDIENTE (o con plazo de envío vencido) a la imprenta y guarda el resultado.
 * Se ejecuta fuera de la transacción del cobro: la llamada externa no debe retener bloqueos.
 */
export async function emitirDocumento(db: Db, proveedor: ProveedorFiscal, id: number, hoy: string, timeoutMs = 8000): Promise<ResultadoEmision> {
  // Tomar el documento: solo uno a la vez; si el proceso muere, a los 2 minutos otro puede retomarlo.
  const tomado = await db.query(
    `UPDATE documentos_fiscales SET estado = 'ENVIANDO', intentos = intentos + 1, proximo_intento = now() + interval '2 minutes'
     WHERE id = $1 AND estado IN ('PENDIENTE', 'ENVIANDO') AND proximo_intento <= now()
     RETURNING payload, intentos`,
    [id]
  );
  if (tomado.rows.length === 0) return { estado: 'OMITIDO' };
  const documento = tomado.rows[0].payload as DocumentoFiscal;
  const intentos = Number(tomado.rows[0].intentos);
  try {
    const r = validarRespuesta(await conTiempo(proveedor.emitir({ id, documento, hoy }), timeoutMs));
    await db.query(
      `UPDATE documentos_fiscales SET estado = 'EMITIDO', numero_control = $2, fecha_asignacion_control = $3, pdf_url = $4, qr = $5,
         respuesta_proveedor = $6, emitido_en = now(), ultimo_error = NULL,
         payload = payload || jsonb_build_object('numeroControl', $8::text, 'fechaAsignacionControl', $7::text)
       WHERE id = $1`,
      // $8 repite el N° de control como texto: Postgres no admite un mismo parámetro con dos tipos ($2 es VARCHAR).
      [id, r.numeroControl, r.fechaAsignacion, r.pdfUrl ?? null, r.qr ?? null, JSON.stringify(r.crudo ?? null), fechaFiscal(r.fechaAsignacion), r.numeroControl]
    );
    return { estado: 'EMITIDO', numeroControl: r.numeroControl, pdfUrl: r.pdfUrl ?? null };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    if (err instanceof ErrorRechazo) {
      await db.query(`UPDATE documentos_fiscales SET estado = 'ERROR', ultimo_error = $2 WHERE id = $1`, [id, mensaje]);
      return { estado: 'ERROR', error: mensaje };
    }
    await db.query(
      `UPDATE documentos_fiscales SET estado = 'PENDIENTE', ultimo_error = $2, proximo_intento = now() + make_interval(secs => $3) WHERE id = $1`,
      [id, mensaje, esperaReintento(intentos)]
    );
    return { estado: 'PENDIENTE', error: mensaje };
  }
}

/** Reintenta los documentos pendientes cuyo plazo ya venció (los más antiguos primero). */
export async function procesarPendientes(db: Db, proveedor: ProveedorFiscal, hoy: string, limite = 20): Promise<Record<string, number>> {
  const r = await db.query(
    `SELECT id FROM documentos_fiscales WHERE estado IN ('PENDIENTE', 'ENVIANDO') AND proximo_intento <= now() ORDER BY id LIMIT $1`,
    [limite]
  );
  const cuenta: Record<string, number> = { EMITIDO: 0, PENDIENTE: 0, ERROR: 0, OMITIDO: 0 };
  for (const { id } of r.rows) cuenta[(await emitirDocumento(db, proveedor, id, hoy)).estado]++;
  return cuenta;
}
