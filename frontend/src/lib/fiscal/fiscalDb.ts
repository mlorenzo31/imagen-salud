import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { centsToStr } from '@/lib/money';
import { leerConfigGuardada } from './configEmisor';
import type { ConfigEmisor, DocumentoFiscal, TipoDocumento } from './factura';

let listo: Promise<void> | null = null;

const TABLAS = ['secuencias_fiscales', 'documentos_fiscales', 'documentos_fiscales_cobros', 'facturacion_diferida', 'talonarios_contingencia', 'contingencias', 'retenciones_recibidas'];

/**
 * Crea (idempotente) las tablas de documentos fiscales y las columnas "Facturar a" de facturas_caja.
 * Se llama ANTES de abrir la transacción (el DDL no debe correr con filas bloqueadas).
 */
export function asegurarFiscal(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      const completas = async (q: Pick<PoolClient, 'query'>) => {
        const r = await q.query(
          `SELECT (SELECT count(*)::int FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
                   WHERE s.nspname = current_schema() AND c.relname = ANY($1::text[]) AND c.relrowsecurity) AS n,
                  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
                          AND table_name = 'documentos_fiscales' AND column_name = 'contingencia_id') AS al_dia`,
          [TABLAS]
        );
        // `al_dia`: la última columna agregada (Fase 5, contingencia) ya existe; si falta, se corre todo el DDL.
        return r.rows[0].n === TABLAS.length && r.rows[0].al_dia;
      };
      if (await completas(pool)) return;
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query("SELECT pg_advisory_xact_lock(hashtext('ddl:fiscal'))");
        if (await completas(c)) { await c.query('COMMIT'); return; }
        await c.query(`
          CREATE TABLE IF NOT EXISTS config_fiscal (
            clave VARCHAR(50) PRIMARY KEY,
            valor JSONB NOT NULL,
            actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
            usuario VARCHAR(100)
          );
          CREATE TABLE IF NOT EXISTS secuencias_fiscales (
            tipo VARCHAR(14) PRIMARY KEY,
            ultimo BIGINT NOT NULL CHECK (ultimo BETWEEN 1 AND 99999999)
          );
          CREATE TABLE IF NOT EXISTS documentos_fiscales (
            id SERIAL PRIMARY KEY,
            tipo VARCHAR(14) NOT NULL CHECK (tipo IN ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO')),
            numero VARCHAR(8) NOT NULL,
            numero_control VARCHAR(11) UNIQUE,
            fecha_asignacion_control DATE,
            factura_caja_id INTEGER REFERENCES facturas_caja(id),
            doc_referencia_id INTEGER REFERENCES documentos_fiscales(id),
            medio VARCHAR(12) NOT NULL DEFAULT 'DIGITAL' CHECK (medio IN ('DIGITAL', 'CONTINGENCIA')),
            estado VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE',
            fecha_emision DATE NOT NULL,
            hora_emision VARCHAR(8) NOT NULL,
            receptor_nombre VARCHAR(200) NOT NULL,
            receptor_documento VARCHAR(20) NOT NULL,
            total_exento_usd NUMERIC(14,2) NOT NULL,
            total_iva_usd NUMERIC(14,2) NOT NULL,
            total_igtf_usd NUMERIC(14,2) NOT NULL,
            total_usd NUMERIC(14,2) NOT NULL,
            total_exento_bs NUMERIC(16,2) NOT NULL,
            total_iva_bs NUMERIC(16,2) NOT NULL,
            total_igtf_bs NUMERIC(16,2) NOT NULL,
            total_bs NUMERIC(16,2) NOT NULL,
            tipo_cambio NUMERIC(14,4) NOT NULL CHECK (tipo_cambio > 0),
            motivo TEXT,
            payload JSONB NOT NULL,
            pdf_url TEXT,
            qr TEXT,
            respuesta_proveedor JSONB,
            usuario VARCHAR(100),
            creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (tipo, numero),
            CHECK ((tipo = 'FACTURA') = (doc_referencia_id IS NULL))
          );
          CREATE INDEX IF NOT EXISTS documentos_fiscales_factura ON documentos_fiscales (factura_caja_id);
          CREATE INDEX IF NOT EXISTS documentos_fiscales_fecha ON documentos_fiscales (fecha_emision);
          -- Fase 3: cola de envío a la imprenta digital (idempotente sobre tablas ya creadas).
          ALTER TABLE documentos_fiscales ADD COLUMN IF NOT EXISTS intentos INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE documentos_fiscales ADD COLUMN IF NOT EXISTS ultimo_error TEXT;
          ALTER TABLE documentos_fiscales ADD COLUMN IF NOT EXISTS proximo_intento TIMESTAMPTZ NOT NULL DEFAULT now();
          ALTER TABLE documentos_fiscales ADD COLUMN IF NOT EXISTS emitido_en TIMESTAMPTZ;
          ALTER TABLE documentos_fiscales DROP CONSTRAINT IF EXISTS documentos_fiscales_estado_check;
          ALTER TABLE documentos_fiscales ALTER COLUMN estado TYPE VARCHAR(12);
          ALTER TABLE documentos_fiscales ADD CONSTRAINT documentos_fiscales_estado_check
            CHECK (estado IN ('PENDIENTE', 'ENVIANDO', 'EMITIDO', 'ERROR', 'CONTINGENCIA'));
          CREATE INDEX IF NOT EXISTS documentos_fiscales_cola ON documentos_fiscales (proximo_intento) WHERE estado IN ('PENDIENTE', 'ENVIANDO');
          -- Fase 3B: qué cobros cubre cada factura (una factura por cobro; la consolidada cubre varios) y diferimientos.
          CREATE TABLE IF NOT EXISTS documentos_fiscales_cobros (
            documento_id INTEGER NOT NULL REFERENCES documentos_fiscales(id),
            factura_caja_id INTEGER NOT NULL UNIQUE REFERENCES facturas_caja(id),
            PRIMARY KEY (documento_id, factura_caja_id)
          );
          INSERT INTO documentos_fiscales_cobros (documento_id, factura_caja_id)
            SELECT id, factura_caja_id FROM documentos_fiscales WHERE tipo = 'FACTURA' AND factura_caja_id IS NOT NULL
            ON CONFLICT DO NOTHING;
          CREATE TABLE IF NOT EXISTS facturacion_diferida (
            factura_caja_id INTEGER PRIMARY KEY REFERENCES facturas_caja(id),
            motivo VARCHAR(20) NOT NULL CHECK (motivo IN ('ANTICIPO', 'ASEGURADORA', 'DATOS_EMPRESA')),
            facturar_antes_de DATE NOT NULL,
            autorizado_por VARCHAR(100) NOT NULL,
            creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
            resuelto_en TIMESTAMPTZ,
            documento_id INTEGER REFERENCES documentos_fiscales(id)
          );
          ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS receptor_razon_social VARCHAR(200);
          ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS receptor_rif VARCHAR(15);
          ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS receptor_domicilio TEXT;
          -- Fase 5: contingencia (arts. 6, 7, 11, 20 y 27). Talonarios autorizados y períodos de contingencia.
          CREATE TABLE IF NOT EXISTS talonarios_contingencia (
            id SERIAL PRIMARY KEY,
            serie VARCHAR(6) NOT NULL UNIQUE,
            imprenta_razon_social VARCHAR(200) NOT NULL,
            imprenta_rif VARCHAR(15) NOT NULL,
            imprenta_providencia VARCHAR(60) NOT NULL,
            imprenta_fecha_providencia DATE NOT NULL,
            fecha_elaboracion DATE NOT NULL,
            control_desde VARCHAR(11) NOT NULL,
            control_hasta VARCHAR(11) NOT NULL,
            factura_desde INTEGER NOT NULL,
            factura_hasta INTEGER NOT NULL,
            activo BOOLEAN NOT NULL DEFAULT true,
            usuario VARCHAR(100),
            creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
          );
          CREATE TABLE IF NOT EXISTS contingencias (
            id SERIAL PRIMARY KEY,
            motivo VARCHAR(15) NOT NULL CHECK (motivo IN ('ENERGIA', 'INTERNET', 'AVERIA', 'MANTENIMIENTO')),
            observacion TEXT,
            fecha_inicio DATE NOT NULL,
            hora_inicio VARCHAR(8) NOT NULL,
            fecha_fin DATE,
            hora_fin VARCHAR(8),
            abierta_por VARCHAR(100) NOT NULL,
            cerrada_por VARCHAR(100),
            enviada_en TIMESTAMPTZ,
            respuesta_proveedor JSONB,
            ultimo_error TEXT,
            creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
          );
          -- Una sola contingencia sin remitir a la vez: los documentos físicos se asocian a ella.
          CREATE UNIQUE INDEX IF NOT EXISTS contingencias_sin_enviar ON contingencias ((true)) WHERE enviada_en IS NULL;
          ALTER TABLE documentos_fiscales ADD COLUMN IF NOT EXISTS serie VARCHAR(6) NOT NULL DEFAULT '';
          ALTER TABLE documentos_fiscales ADD COLUMN IF NOT EXISTS talonario_id INTEGER REFERENCES talonarios_contingencia(id);
          ALTER TABLE documentos_fiscales ADD COLUMN IF NOT EXISTS contingencia_id INTEGER REFERENCES contingencias(id);
          -- Art. 20: la numeración del talonario lleva serie, así no choca con la digital.
          ALTER TABLE documentos_fiscales DROP CONSTRAINT IF EXISTS documentos_fiscales_tipo_numero_key;
          CREATE UNIQUE INDEX IF NOT EXISTS documentos_fiscales_tipo_serie_numero ON documentos_fiscales (tipo, serie, numero);
          -- Fase 6: retenciones que los clientes agentes de retención le practican a la clínica, contra su factura.
          CREATE TABLE IF NOT EXISTS retenciones_recibidas (
            id SERIAL PRIMARY KEY,
            documento_id INTEGER NOT NULL REFERENCES documentos_fiscales(id),
            agente_rif VARCHAR(15) NOT NULL,
            agente_razon_social VARCHAR(200) NOT NULL,
            numero_comprobante VARCHAR(14) NOT NULL,
            fecha_comprobante DATE NOT NULL,
            periodo VARCHAR(7) NOT NULL,
            iva_retenido NUMERIC(16,2) NOT NULL DEFAULT 0,
            islr_retenido NUMERIC(16,2) NOT NULL DEFAULT 0,
            observacion TEXT,
            usuario VARCHAR(100),
            creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
            anulada_en TIMESTAMPTZ,
            motivo_anulacion TEXT,
            UNIQUE (agente_rif, numero_comprobante)
          );
          CREATE INDEX IF NOT EXISTS retenciones_recibidas_documento ON retenciones_recibidas (documento_id);
        `);
        for (const t of [...TABLAS, 'config_fiscal']) await c.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`); // sin acceso por la API pública
        await c.query('COMMIT');
      } catch (err) {
        await c.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        c.release();
      }
    })().catch((err) => { listo = null; throw err; });
  }
  return listo;
}

export async function leerConfigEmisor(client?: Pick<PoolClient, 'query'>): Promise<ConfigEmisor> {
  const r = await (client ?? pool).query("SELECT valor FROM config_fiscal WHERE clave = 'emisor'");
  return leerConfigGuardada(r.rows[0]?.valor);
}

export async function guardarConfigEmisor(valor: ConfigEmisor, usuario: string): Promise<void> {
  await pool.query(
    `INSERT INTO config_fiscal (clave, valor, usuario, actualizado_en) VALUES ('emisor', $1, $2, now())
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, usuario = EXCLUDED.usuario, actualizado_en = now()`,
    [JSON.stringify(valor), usuario]
  );
}

/** Art. 8.2: numeración consecutiva y única de 8 dígitos. */
export function formatearNumero(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99_999_999) throw new Error(`Número de documento fuera de rango: ${n}`);
  return String(n).padStart(8, '0');
}

/**
 * Siguiente número del tipo de documento. Debe llamarse dentro de la transacción que guarda el documento:
 * el UPSERT bloquea la fila de la secuencia y, si la transacción se revierte, el número no se consume (sin huecos).
 */
export async function siguienteNumero(client: Pick<PoolClient, 'query'>, tipo: TipoDocumento): Promise<string> {
  const r = await client.query(
    `INSERT INTO secuencias_fiscales (tipo, ultimo) VALUES ($1, 1)
     ON CONFLICT (tipo) DO UPDATE SET ultimo = secuencias_fiscales.ultimo + 1 RETURNING ultimo`,
    [tipo]
  );
  return formatearNumero(Number(r.rows[0].ultimo));
}

interface Meta {
  facturaCajaId: number | null; usuario: string; fecha: string; hora: string; docReferenciaId?: number | null;
  medio?: 'DIGITAL' | 'CONTINGENCIA'; talonarioId?: number | null; contingenciaId?: number | null;
}

/** Fila de documentos_fiscales: totales consultables + el documento completo en `payload`. */
export function filaDocumento(doc: DocumentoFiscal, m: Meta) {
  const t = doc.totales;
  return {
    tipo: doc.tipo,
    numero: doc.numero,
    numero_control: doc.numeroControl,
    factura_caja_id: m.facturaCajaId,
    doc_referencia_id: m.docReferenciaId ?? null,
    medio: m.medio ?? 'DIGITAL',
    // Contingencia (Fase 5): emitida en talonario; queda en CONTINGENCIA hasta remitirla a la imprenta digital (art. 7).
    serie: doc.serie ?? '',
    estado: m.medio === 'CONTINGENCIA' ? 'CONTINGENCIA' : 'PENDIENTE',
    talonario_id: m.talonarioId ?? null,
    contingencia_id: m.contingenciaId ?? null,
    fecha_emision: m.fecha,
    hora_emision: m.hora,
    receptor_nombre: doc.receptor.nombre,
    receptor_documento: doc.receptor.documento,
    total_exento_usd: centsToStr(t.exento.usd),
    total_iva_usd: centsToStr(t.iva.usd),
    total_igtf_usd: centsToStr(t.igtf?.monto.usd ?? 0),
    total_usd: centsToStr(t.total.usd),
    total_exento_bs: centsToStr(t.exento.bs),
    total_iva_bs: centsToStr(t.iva.bs),
    total_igtf_bs: centsToStr(t.igtf?.monto.bs ?? 0),
    total_bs: centsToStr(t.total.bs),
    tipo_cambio: doc.tipoCambio,
    motivo: doc.motivo ?? null,
    payload: JSON.stringify(doc),
    usuario: m.usuario,
  };
}

/** Guarda el documento (PENDIENTE, o CONTINGENCIA si es de talonario); `emision.ts` envía los PENDIENTE a la imprenta y lo pasa a EMITIDO. */
export async function guardarDocumento(client: Pick<PoolClient, 'query'>, doc: DocumentoFiscal, m: Meta): Promise<number> {
  const f = filaDocumento(doc, m);
  const cols = Object.keys(f);
  const r = await client.query(
    `INSERT INTO documentos_fiscales (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(f)
  );
  return r.rows[0].id;
}
