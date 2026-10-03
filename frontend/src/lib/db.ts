import { Pool, type PoolConfig } from 'pg';

declare global {
  var _pgPool: Pool | undefined;
}

function buildConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida. Configúrala en .env.local (ver .env.example).');
  }

  // Verificación de certificado activa si se aporta la CA; si no, se mantiene el modo previo con aviso.
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n');
  // DATABASE_SSL=false desactiva SSL (solo para una BD local de desarrollo).
  const ssl = process.env.DATABASE_SSL === 'false'
    ? false
    : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };

  return {
    connectionString,
    ssl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

// Pool perezoso: no exige DATABASE_URL al importar (p. ej. durante `next build`), solo al primer uso.
function getPool(): Pool {
  if (!global._pgPool) {
    global._pgPool = new Pool(buildConfig());
  }
  return global._pgPool;
}

const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool();
    const value = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export default pool;
