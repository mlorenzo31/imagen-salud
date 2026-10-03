if (!process.env.DATABASE_URL) { console.error('Define DATABASE_URL'); process.exit(1); }
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Aplicando migracion a Supabase/PostgreSQL...');
  await pool.query(`
    ALTER TABLE facturas_caja 
    ADD COLUMN IF NOT EXISTS telefono_paciente VARCHAR(50),
    ADD COLUMN IF NOT EXISTS estudio_principal_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS prioridad VARCHAR(20) DEFAULT 'NORMAL',
    ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
    ADD COLUMN IF NOT EXISTS adjunto_nombre VARCHAR(255),
    ADD COLUMN IF NOT EXISTS adjunto_url TEXT,
    ADD COLUMN IF NOT EXISTS adjunto_tipo VARCHAR(50),
    ADD COLUMN IF NOT EXISTS whatsapp_enviado BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS whatsapp_fecha_envio TIMESTAMP,
    ADD COLUMN IF NOT EXISTS retorno_sala BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sala_anterior VARCHAR(100),
    ADD COLUMN IF NOT EXISTS grupo_clinico VARCHAR(10) DEFAULT 'A';
  `);

  console.log('Columnas migradas exitosamente.');
  
  // Verificar
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'facturas_caja' ORDER BY ordinal_position");
  console.log('Total columnas en facturas_caja:', res.rows.length);
  await pool.end();
}
main().catch(console.error);
