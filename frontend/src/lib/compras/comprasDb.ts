import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { CONFIG_FISCAL_DEFECTO, type ConfigFiscal } from './calculos';

let listo: Promise<void> | null = null;

const TABLAS = ['proveedores', 'productos_compra', 'facturas_compra', 'facturas_compra_lineas', 'pagos_compra', 'config_fiscal', 'retenciones_compra'];

/**
 * Crea (idempotente) las tablas de compras. Se llama ANTES de abrir la transacción (el DDL no debe correr con filas
 * bloqueadas). Si todas existen con RLS (el último paso), no ejecuta DDL.
 */
export function asegurarCompras(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      const ya = await pool.query(
        `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
         WHERE s.nspname = current_schema() AND c.relname = ANY($1::text[]) AND c.relrowsecurity`,
        [TABLAS]
      );
      if (ya.rows[0].n === TABLAS.length) return;
      await pool.query(`
        CREATE TABLE IF NOT EXISTS proveedores (
          id SERIAL PRIMARY KEY,
          rif VARCHAR(15) NOT NULL UNIQUE,
          razon_social VARCHAR(200) NOT NULL,
          direccion TEXT,
          telefono VARCHAR(30),
          tipo_persona VARCHAR(10) NOT NULL DEFAULT 'JURIDICA' CHECK (tipo_persona IN ('NATURAL', 'JURIDICA')),
          contribuyente_especial BOOLEAN NOT NULL DEFAULT false,
          activo BOOLEAN NOT NULL DEFAULT true,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS productos_compra (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(200) NOT NULL,
          categoria VARCHAR(100) NOT NULL DEFAULT 'General',
          alicuota_defecto INTEGER NOT NULL DEFAULT 16,
          proveedor_id INTEGER REFERENCES proveedores(id),
          activo BOOLEAN NOT NULL DEFAULT true,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS facturas_compra (
          id SERIAL PRIMARY KEY,
          proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
          numero_factura VARCHAR(50) NOT NULL,
          numero_control VARCHAR(50),
          fecha DATE NOT NULL,
          moneda VARCHAR(3) NOT NULL CHECK (moneda IN ('BS', 'USD')),
          tasa NUMERIC(14,4) NOT NULL CHECK (tasa > 0),
          base_exenta NUMERIC(14,2) NOT NULL DEFAULT 0,
          total_base NUMERIC(14,2) NOT NULL,
          total_iva NUMERIC(14,2) NOT NULL,
          total NUMERIC(14,2) NOT NULL,
          iva_retenido NUMERIC(14,2) NOT NULL DEFAULT 0,
          islr_retenido NUMERIC(14,2) NOT NULL DEFAULT 0,
          neto_a_pagar NUMERIC(14,2) NOT NULL,
          detalle_iva JSONB NOT NULL DEFAULT '[]',
          condicion VARCHAR(8) NOT NULL CHECK (condicion IN ('CONTADO', 'CREDITO')),
          vencimiento DATE,
          estado VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PARCIAL', 'PAGADA', 'ANULADA')),
          comprobante_retencion VARCHAR(20),
          notas TEXT,
          usuario VARCHAR(100),
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (proveedor_id, numero_factura)
        );
        CREATE TABLE IF NOT EXISTS facturas_compra_lineas (
          id SERIAL PRIMARY KEY,
          factura_id INTEGER NOT NULL REFERENCES facturas_compra(id),
          producto_id INTEGER REFERENCES productos_compra(id),
          descripcion VARCHAR(255) NOT NULL,
          cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
          precio_unitario NUMERIC(14,2) NOT NULL CHECK (precio_unitario > 0),
          alicuota INTEGER NOT NULL,
          subtotal NUMERIC(14,2) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pagos_compra (
          id SERIAL PRIMARY KEY,
          factura_id INTEGER NOT NULL REFERENCES facturas_compra(id),
          cuenta_id INTEGER NOT NULL,
          monto_cuenta NUMERIC(14,2) NOT NULL CHECK (monto_cuenta > 0),
          tasa NUMERIC(14,4),
          monto_aplicado NUMERIC(14,2) NOT NULL CHECK (monto_aplicado > 0),
          fecha DATE NOT NULL,
          referencia VARCHAR(100),
          reversado BOOLEAN NOT NULL DEFAULT false,
          usuario VARCHAR(100),
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS config_fiscal (
          clave VARCHAR(50) PRIMARY KEY,
          valor JSONB NOT NULL,
          actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
          usuario VARCHAR(100)
        );
        CREATE TABLE IF NOT EXISTS retenciones_compra (
          id SERIAL PRIMARY KEY,
          factura_id INTEGER NOT NULL REFERENCES facturas_compra(id),
          numero VARCHAR(20) NOT NULL UNIQUE,
          periodo VARCHAR(6) NOT NULL,
          iva_retenido NUMERIC(14,2) NOT NULL DEFAULT 0,
          islr_retenido NUMERIC(14,2) NOT NULL DEFAULT 0,
          fecha DATE NOT NULL,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS facturas_compra_fecha ON facturas_compra (fecha);
        CREATE INDEX IF NOT EXISTS pagos_compra_factura ON pagos_compra (factura_id);
      `);
      await pool.query("INSERT INTO config_fiscal (clave, valor) VALUES ('fiscal', $1) ON CONFLICT (clave) DO NOTHING", [JSON.stringify(CONFIG_FISCAL_DEFECTO)]);
      for (const t of TABLAS) await pool.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`); // sin acceso por la API pública de Supabase
    })().catch((err) => { listo = null; throw err; });
  }
  return listo;
}

/** Configuración fiscal vigente (si falta alguna clave se completa con la de defecto). */
export async function leerConfigFiscal(client?: PoolClient): Promise<ConfigFiscal> {
  const r = await (client ?? pool).query("SELECT valor FROM config_fiscal WHERE clave = 'fiscal'");
  return { ...CONFIG_FISCAL_DEFECTO, ...(r.rows[0]?.valor ?? {}) };
}
