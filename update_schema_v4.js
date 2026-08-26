// ====================================================================
// MIGRATION V4: Add owners table for Multi-Owner Registration & Routing
// Run: node update_schema_v4.js
// ====================================================================

const { Client } = require('pg');

const DB_CONNECTION = process.env.DATABASE_URL || 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

async function migrate() {
  const client = new Client({
    connectionString: DB_CONNECTION,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL...');

  const sql = `
    -- Multi-Owner Table
    CREATE TABLE IF NOT EXISTS public.owners (
      id VARCHAR(50) PRIMARY KEY,
      name TEXT NOT NULL,
      telegram_chat_id VARCHAR(50) NOT NULL UNIQUE,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Seed initial owner if missing
    INSERT INTO public.owners (id, name, telegram_chat_id, active)
    VALUES ('OWN-001', 'Chief System Engineer', '1617457685', TRUE)
    ON CONFLICT (telegram_chat_id) DO NOTHING;
  `;

  try {
    await client.query(sql);
    console.log('✅ Schema V4 applied successfully! Multi-Owner table ready.');
  } catch (err) {
    console.error('Migration Error:', err.message);
  }

  await client.end();
  console.log('Migration complete.');
}

migrate();
