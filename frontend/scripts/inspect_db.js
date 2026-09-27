const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.zjboatbvefmtuvnabowf:JJ6qoD8kU0ucagpS@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'facturas_caja' ORDER BY ordinal_position");
  console.log('Columns in facturas_caja:');
  res.rows.forEach(r => console.log(' - ' + r.column_name + ' (' + r.data_type + ')'));
  await pool.end();
}
main().catch(console.error);
