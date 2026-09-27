import { Pool } from 'pg';

const connectionString = 
  process.env.DATABASE_URL || 
  'postgresql://postgres.zjboatbvefmtuvnabowf:JJ6qoD8kU0ucagpS@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

// Singleton pool pattern for Next.js App Router to avoid connection exhaustion in development
declare global {
  var _pgPool: Pool | undefined;
}

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
} else {
  if (!global._pgPool) {
    global._pgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  pool = global._pgPool;
}

export default pool;
