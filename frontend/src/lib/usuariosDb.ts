import pool from '@/lib/db';
import { hashClave } from '@/lib/clave';
import type { UserRole } from '@/types';

export interface UsuarioFila {
  id: number;
  usuario: string;
  nombre: string;
  rol: UserRole;
  password_hash: string;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
}

/** Variable de entorno con la clave inicial de cada rol (solo para sembrar los usuarios iniciales). */
const PIN_ENV: Record<UserRole, string> = {
  admin: 'AUTH_PIN_ADMIN',
  asistente: 'AUTH_PIN_ASISTENTE',
  cajero: 'AUTH_PIN_CAJERO',
};

const NOMBRES_INICIALES: Record<UserRole, string> = {
  admin: 'Dr. Director Médico',
  asistente: 'Lcda. Asistente Administrativo',
  cajero: 'Cajero(a) de Turno',
};

let listo: Promise<void> | null = null;

/**
 * Crea las tablas de usuarios y recuperación (idempotente) y siembra los 3 usuarios iniciales
 * (admin, asistente, cajero) usando las claves actuales de AUTH_PIN_* como contraseña inicial.
 */
export function asegurarUsuarios(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id SERIAL PRIMARY KEY,
          usuario VARCHAR(40) NOT NULL UNIQUE,
          nombre VARCHAR(100) NOT NULL,
          rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin','asistente','cajero')),
          password_hash TEXT NOT NULL,
          telefono VARCHAR(20),
          email VARCHAR(120),
          activo BOOLEAN NOT NULL DEFAULT TRUE,
          intentos_fallidos INT NOT NULL DEFAULT 0,
          bloqueado_hasta TIMESTAMPTZ,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS recuperacion_clave (
          id SERIAL PRIMARY KEY,
          usuario_id INT NOT NULL REFERENCES usuarios(id),
          codigo_hash TEXT NOT NULL,
          expira TIMESTAMPTZ NOT NULL,
          intentos INT NOT NULL DEFAULT 0,
          usado BOOLEAN NOT NULL DEFAULT FALSE,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      await pool.query('CREATE INDEX IF NOT EXISTS ix_recuperacion_usuario ON recuperacion_clave (usuario_id, creado_en DESC)');
      await pool.query('ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY'); // el hash nunca debe ser legible por la API pública de Supabase
      await pool.query('ALTER TABLE recuperacion_clave ENABLE ROW LEVEL SECURITY');
      for (const rol of Object.keys(PIN_ENV) as UserRole[]) {
        const pin = process.env[PIN_ENV[rol]];
        if (!pin) continue;
        await pool.query(
          `INSERT INTO usuarios (usuario, nombre, rol, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (usuario) DO NOTHING`,
          [rol, NOMBRES_INICIALES[rol], rol, hashClave(pin)],
        );
      }
    })().catch((err) => { listo = null; throw err; });
  }
  return listo;
}

export async function buscarUsuario(usuario: string): Promise<UsuarioFila | null> {
  await asegurarUsuarios();
  const { rows } = await pool.query<UsuarioFila>('SELECT * FROM usuarios WHERE usuario = $1', [usuario.trim().toLowerCase()]);
  return rows[0] ?? null;
}

export async function buscarUsuarioPorId(id: number): Promise<UsuarioFila | null> {
  await asegurarUsuarios();
  const { rows } = await pool.query<UsuarioFila>('SELECT * FROM usuarios WHERE id = $1', [id]);
  return rows[0] ?? null;
}
