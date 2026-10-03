if (!process.env.DATABASE_URL) { console.error('Define DATABASE_URL'); process.exit(1); }
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'facturas_caja' ORDER BY ordinal_position");
  console.log('Columns in facturas_caja:');
  res.rows.forEach(r => console.log(' - ' + r.column_name + ' (' + r.data_type + ')'));
  await pool.end();
}
main().catch(console.error);
