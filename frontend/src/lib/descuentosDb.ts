import pool from '@/lib/db';
import type { Promo, TipoPromo } from '@/lib/descuento';
import type { PromoEntrada } from '@/lib/promociones';

export interface PromoFila {
  id: number; nombre: string; tipo: TipoPromo; valor: string; modo: 'CLINICA' | 'PROPORCIONAL';
  areas: string[]; estudios: string[]; requiere: string[]; fecha_desde: string; fecha_hasta: string; activa: boolean;
  creado_por: string | null; creado_en: string;
}

let listo: Promise<void> | null = null;

/** Crea (idempotente) las columnas de descuento de las facturas y la tabla de promociones. */
export function asegurarDescuentos(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      await pool.query('ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS precio_lista_usd NUMERIC(12,2)');
      await pool.query('ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS descuento_usd NUMERIC(12,2) NOT NULL DEFAULT 0');
      await pool.query('ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS descuento_modo VARCHAR(12)');
      await pool.query('ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS descuento_origen VARCHAR(10)');
      await pool.query('ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS descuento_motivo TEXT');
      await pool.query('ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS descuento_promo_id INT');
      await pool.query('ALTER TABLE facturas_caja ADD COLUMN IF NOT EXISTS descuento_autorizado_por VARCHAR(100)');
      await pool.query('ALTER TABLE facturas_servicios_detalle ADD COLUMN IF NOT EXISTS precio_lista_usd NUMERIC(12,2)');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS promociones (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(80) NOT NULL,
          porcentaje NUMERIC(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
          modo VARCHAR(12) NOT NULL CHECK (modo IN ('CLINICA','PROPORCIONAL')),
          areas TEXT[] NOT NULL DEFAULT '{}',
          estudios TEXT[] NOT NULL DEFAULT '{}',
          fecha_desde DATE NOT NULL,
          fecha_hasta DATE NOT NULL,
          activa BOOLEAN NOT NULL DEFAULT TRUE,
          creado_por VARCHAR(100),
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
          CHECK (fecha_desde <= fecha_hasta)
        )`);
      // Promociones en $ y con servicios requeridos: `valor` reemplaza a `porcentaje` (que queda nulo salvo en PCT).
      await pool.query("ALTER TABLE promociones ADD COLUMN IF NOT EXISTS tipo VARCHAR(5) NOT NULL DEFAULT 'PCT'");
      await pool.query('ALTER TABLE promociones ADD COLUMN IF NOT EXISTS valor NUMERIC(12,2)');
      await pool.query("ALTER TABLE promociones ADD COLUMN IF NOT EXISTS requiere TEXT[] NOT NULL DEFAULT '{}'");
      await pool.query('ALTER TABLE promociones ALTER COLUMN porcentaje DROP NOT NULL');
      await pool.query('UPDATE promociones SET valor = porcentaje WHERE valor IS NULL');
      await pool.query('ALTER TABLE promociones ENABLE ROW LEVEL SECURITY'); // sin acceso por la API pública de Supabase
    })().catch((err) => { listo = null; throw err; });
  }
  return listo;
}

const aPromo = (f: PromoFila): Promo => ({
  id: f.id, nombre: f.nombre, tipo: f.tipo, valor: Math.round(Number(f.valor) * 100), modo: f.modo,
  areas: f.areas, estudios: f.estudios, requiere: f.requiere, desde: f.fecha_desde, hasta: f.fecha_hasta, activa: f.activa,
});

const COLUMNAS = `id, nombre, tipo, COALESCE(valor, porcentaje)::text AS valor, modo, areas, estudios, requiere, fecha_desde, fecha_hasta, activa, creado_por, creado_en::text AS creado_en`;

/** Promociones vigentes en `fecha` (activas y dentro de su rango). */
export async function promosActivas(fecha: string, db: Pick<typeof pool, 'query'> = pool): Promise<Promo[]> {
  await asegurarDescuentos();
  const r = await db.query<PromoFila>(`SELECT ${COLUMNAS} FROM promociones WHERE activa AND $1::date BETWEEN fecha_desde AND fecha_hasta ORDER BY id`, [fecha]);
  return r.rows.map(aPromo);
}

export async function listarPromos(): Promise<PromoFila[]> {
  await asegurarDescuentos();
  return (await pool.query<PromoFila>(`SELECT ${COLUMNAS} FROM promociones ORDER BY activa DESC, fecha_hasta DESC, id DESC`)).rows;
}

/** Crea una promoción o, si se indica `id`, la actualiza. */
export async function guardarPromo(p: PromoEntrada, usuario: string, id?: number): Promise<PromoFila | null> {
  await asegurarDescuentos();
  const valores = [p.nombre, p.tipo === 'PCT' ? p.valor : null, p.modo, p.areas, p.estudios, p.fechaDesde, p.fechaHasta, p.activa, p.tipo, p.valor, p.requiere];
  const r = id
    ? await pool.query<PromoFila>(
        `UPDATE promociones SET nombre=$1, porcentaje=$2, modo=$3, areas=$4, estudios=$5, fecha_desde=$6, fecha_hasta=$7, activa=$8, tipo=$9, valor=$10, requiere=$11
         WHERE id=$12 RETURNING ${COLUMNAS}`, [...valores, id])
    : await pool.query<PromoFila>(
        `INSERT INTO promociones (nombre, porcentaje, modo, areas, estudios, fecha_desde, fecha_hasta, activa, tipo, valor, requiere, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${COLUMNAS}`, [...valores, usuario]);
  return r.rows[0] ?? null;
}
