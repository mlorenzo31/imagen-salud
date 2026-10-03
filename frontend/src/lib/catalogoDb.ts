import pool from '@/lib/db';
import { ESTUDIOS_CLINICOS, type EstudioItem } from '@/lib/catalogos';
import { centsToNumber, centsToStr, toCents } from '@/lib/money';

/** Grupo clínico (A: eco y ginecología, B: rayos X y mamografía, C: consultas) según el área. */
export const GRUPO_POR_AREA: Record<string, 'A' | 'B' | 'C'> = {
  ECOGRAFIA_AM: 'A', ECOGRAFIA_PM: 'A', GINECOLOGIA: 'A', RADIOLOGIA: 'B', MAMOGRAFIA: 'B', CONSULTAS: 'C',
};
export const grupoDeArea = (area: string): 'A' | 'B' | 'C' => GRUPO_POR_AREA[area] ?? 'A';

export interface EstudioFila {
  id: number;
  codigo: string | null;
  area: string;
  nombre: string;
  precio_usd: string;
  sala: string;
  dist_imagen: string;
  dist_medico: string;
  dist_eco: string;
  dist_patologo: string;
  activo: boolean;
}

let listo: Promise<void> | null = null;

/**
 * Crea (si no existe) el catálogo de estudios y lo siembra una sola vez con el catálogo oficial vigente,
 * de modo que el despliegue no requiere ningún paso manual y los precios actuales se conservan.
 */
export function asegurarCatalogo(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      // Columnas auxiliares (idempotente): estado del paciente y áreas de atención del especialista.
      await pool.query('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE');
      await pool.query('ALTER TABLE medicos ADD COLUMN IF NOT EXISTS areas TEXT');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS catalogo_estudios (
          id SERIAL PRIMARY KEY,
          codigo VARCHAR(40),
          area VARCHAR(40) NOT NULL,
          nombre VARCHAR(255) NOT NULL,
          precio_usd NUMERIC(12,2) NOT NULL CHECK (precio_usd > 0),
          sala VARCHAR(80) NOT NULL DEFAULT 'SALA_ECO_GINE',
          dist_imagen NUMERIC(12,2) NOT NULL DEFAULT 0,
          dist_medico NUMERIC(12,2) NOT NULL DEFAULT 0,
          dist_eco NUMERIC(12,2) NOT NULL DEFAULT 0,
          dist_patologo NUMERIC(12,2) NOT NULL DEFAULT 0,
          activo BOOLEAN NOT NULL DEFAULT TRUE,
          creado_en TIMESTAMPTZ DEFAULT now(),
          actualizado_en TIMESTAMPTZ DEFAULT now(),
          CHECK (dist_imagen + dist_medico + dist_eco + dist_patologo = precio_usd)
        )`);
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS ux_catalogo_estudios_area_nombre ON catalogo_estudios (area, LOWER(nombre))');
      const n = await pool.query('SELECT COUNT(*)::int AS n FROM catalogo_estudios');
      if (n.rows[0].n === 0) {
        // Siembra atómica: o entra todo el catálogo oficial o nada (nunca un catálogo a medias).
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('LOCK TABLE catalogo_estudios IN EXCLUSIVE MODE');
          const otra = await client.query('SELECT COUNT(*)::int AS n FROM catalogo_estudios');
          if (otra.rows[0].n === 0) {
            for (const [area, lista] of Object.entries(ESTUDIOS_CLINICOS)) {
              for (const e of lista) {
                await client.query(
                  `INSERT INTO catalogo_estudios (area, nombre, precio_usd, sala, dist_imagen, dist_medico, dist_eco, dist_patologo)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                  [area, e.nombre, centsToStr(toCents(e.precio)), e.sala, centsToStr(toCents(e.dist.imagen)), centsToStr(toCents(e.dist.medico)), centsToStr(toCents(e.dist.eco)), centsToStr(toCents(e.dist.patologo))]
                );
              }
            }
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      }
    })().catch((err) => {
      listo = null; // reintentar en la próxima petición
      throw err;
    });
  }
  return listo;
}

export const filaAEstudio = (f: EstudioFila): EstudioItem => ({
  nombre: f.nombre,
  precio: Number(f.precio_usd),
  area: f.area,
  sala: f.sala,
  dist: { imagen: Number(f.dist_imagen), medico: Number(f.dist_medico), eco: Number(f.dist_eco), patologo: Number(f.dist_patologo) },
});

/** Catálogo oficial incorporado: respaldo cuando la tabla no está disponible (nunca deja la facturación sin precios). */
export function catalogoIncorporado(): EstudioFila[] {
  let id = -1;
  return Object.entries(ESTUDIOS_CLINICOS).flatMap(([area, lista]) =>
    lista.map((e) => ({
      id: id--, codigo: null, area, nombre: e.nombre, precio_usd: centsToStr(toCents(e.precio)), sala: e.sala,
      dist_imagen: centsToStr(toCents(e.dist.imagen)), dist_medico: centsToStr(toCents(e.dist.medico)),
      dist_eco: centsToStr(toCents(e.dist.eco)), dist_patologo: centsToStr(toCents(e.dist.patologo)), activo: true,
    }))
  );
}

export async function listarEstudios(soloActivos: boolean): Promise<{ filas: EstudioFila[]; respaldo: boolean }> {
  try {
    await asegurarCatalogo();
    const r = await pool.query(`SELECT * FROM catalogo_estudios ${soloActivos ? 'WHERE activo = TRUE' : ''} ORDER BY area, id`);
    return { filas: r.rows as EstudioFila[], respaldo: false };
  } catch (err) {
    console.error('Catálogo en BD no disponible; se usa el catálogo incorporado:', err);
    return { filas: catalogoIncorporado(), respaldo: true };
  }
}

/** Reparto en centavos de una fila del catálogo. */
export const repartoCents = (f: EstudioFila) => ({
  precio: toCents(f.precio_usd),
  imagen: toCents(f.dist_imagen),
  medico: toCents(f.dist_medico),
  eco: toCents(f.dist_eco),
  patologo: toCents(f.dist_patologo),
});

export { centsToNumber };
