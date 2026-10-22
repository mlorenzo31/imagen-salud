import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { centsToStr } from '@/lib/money';
import { leerConfigGuardada } from './configEmisor';
import type { ConfigEmisor, DocumentoFiscal, TipoDocumento } from './factura';

let listo: Promise<void> | null = null;

const TABLAS = ['secuencias_fiscales', 'documentos_fiscales'];

/**
 * Crea (idempotente) las tablas de documentos fiscales y las columnas "Facturar a" de facturas_caja.
 * Se llama ANTES de abrir la transacción (el DDL no debe correr con filas bloqueadas).
 */
export function asegurarFiscal(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      const completas = async (q: Pick<PoolClient, 'query'>) => {
        const r = await q.query(
          `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
           WHERE s.nspname = current_schema() AND c.relname = ANY($1::text[]) AND c.relrowsecurity`,
          [TABLAS]
        );
        return r.rows[0].n === TABLAS.length;
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
            estado VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EMITIDO', 'ERROR')),
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
          ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS receptor_razon_social VARCHAR(200);
          ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS receptor_rif VARCHAR(15);
          ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS receptor_domicilio TEXT;
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

interface Meta { facturaCajaId: number | null; usuario: string; fecha: string; hora: string; docReferenciaId?: number | null; medio?: 'DIGITAL' | 'CONTINGENCIA' }

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

/** Guarda el documento en estado PENDIENTE (lo pasa a EMITIDO la integración con la imprenta, Fase 3). */
export async function guardarDocumento(client: Pick<PoolClient, 'query'>, doc: DocumentoFiscal, m: Meta): Promise<number> {
  const f = filaDocumento(doc, m);
  const cols = Object.keys(f);
  const r = await client.query(
    `INSERT INTO documentos_fiscales (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(f)
  );
  return r.rows[0].id;
}
