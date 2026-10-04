import type { Pool, PoolClient } from 'pg';
import { clasificarServicio, type FilaSala } from '@/lib/sala';

export { aTarea } from '@/lib/sala';
export type { FilaSala } from '@/lib/sala';

type Db = Pick<Pool | PoolClient, 'query'>;

export async function asegurarTablaSala(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sala_servicios (
      id SERIAL PRIMARY KEY,
      factura_id INT NOT NULL,
      idx INT NOT NULL,
      estudio TEXT NOT NULL,
      medico TEXT,
      grupo CHAR(1) NOT NULL,
      recurso TEXT NOT NULL,
      box TEXT,
      estado TEXT NOT NULL DEFAULT 'ESPERA',
      ausencias INT NOT NULL DEFAULT 0,
      retorno BOOLEAN NOT NULL DEFAULT FALSE,
      orden_cola TIMESTAMPTZ NOT NULL DEFAULT now(),
      llamado_en TIMESTAMPTZ,
      finalizado_en TIMESTAMPTZ,
      UNIQUE (factura_id, idx)
    )`);
  await db.query(`CREATE INDEX IF NOT EXISTS sala_servicios_estado_idx ON sala_servicios (estado)`);
}

interface ServicioJson { estudio?: string; nombre?: string; area?: string; medico?: string }

/** Crea los turnos por servicio de las facturas abiertas que aún no los tienen (idempotente). */
export async function sincronizarSala(db: Db): Promise<void> {
  await asegurarTablaSala(db);
  const { rows } = await db.query(
    `SELECT f.id, f.estudio, f.medico, f.estado, f.servicios FROM facturas_caja f
      WHERE f.estado IN ('ESPERA','ATENCION')
        AND NOT EXISTS (SELECT 1 FROM sala_servicios s WHERE s.factura_id = f.id)`,
  );
  for (const f of rows as { id: number; estudio: string | null; medico: string | null; estado: string; servicios: unknown }[]) {
    const lista: ServicioJson[] = Array.isArray(f.servicios) && f.servicios.length > 0
      ? (f.servicios as ServicioJson[])
      : (f.estudio ?? '').split('+').map((n) => ({ estudio: n.trim() })).filter((s) => s.estudio);
    for (let i = 0; i < lista.length; i++) {
      const s = lista[i];
      const nombre = (s.estudio || s.nombre || f.estudio || 'Estudio').trim();
      const { recurso, grupo } = clasificarServicio(nombre, s.area);
      await db.query(
        `INSERT INTO sala_servicios (factura_id, idx, estudio, medico, grupo, recurso, estado, box)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (factura_id, idx) DO NOTHING`,
        [f.id, i, nombre, s.medico || f.medico, grupo, recurso, f.estado === 'ATENCION' ? 'ATENCION' : 'ESPERA', null],
      );
    }
  }
}

export const SELECT_SALA = `
  SELECT s.id, s.factura_id, s.idx, s.estudio, s.medico, s.grupo, s.recurso, s.box, s.estado, s.ausencias, s.retorno, s.orden_cola,
         f.turno_num, f.nombre_paciente, f.cedula_paciente, f.telefono_paciente, f.fecha_nacimiento_paciente, f.prioridad, f.fecha, f.hora
    FROM sala_servicios s JOIN facturas_caja f ON f.id = s.factura_id
   WHERE f.estado IN ('ESPERA','ATENCION') AND s.estado IN ('ESPERA','ATENCION')`;

/** Mantiene el estado de la factura (ESPERA/ATENCION/FINALIZADO) coherente con el de sus turnos. */
export async function recalcularFacturas(db: Db, facturaIds: number[]): Promise<void> {
  for (const id of new Set(facturaIds)) {
    const r = await db.query(`SELECT estado, COUNT(*)::int AS n FROM sala_servicios WHERE factura_id = $1 GROUP BY estado`, [id]);
    const c: Record<string, number> = {};
    for (const x of r.rows as { estado: string; n: number }[]) c[x.estado] = x.n;
    const estado = c.ATENCION ? 'ATENCION' : c.ESPERA ? 'ESPERA' : 'FINALIZADO';
    const etapa = estado === 'ATENCION' ? 1 : estado === 'ESPERA' ? 0 : 2;
    await db.query(
      `UPDATE facturas_caja SET estado = $2, etapa_actual = $3 WHERE id = $1 AND estado IN ('ESPERA','ATENCION','FINALIZADO')`,
      [id, estado, etapa],
    );
  }
}
