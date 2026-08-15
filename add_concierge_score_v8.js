// ====================================================================
// MIGRATION V8: Add archetype_score to concierge_user_states
// Run: node add_concierge_score_v8.js
// ====================================================================

const { Client } = require('pg');

const DB_CONNECTION = process.env.DATABASE_URL || 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

async function migrate() {
  const client = new Client({
    connectionString: DB_CONNECTION,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL for Adding Score Column...');

  const sql = `
    ALTER TABLE public.concierge_user_states 
    ADD COLUMN IF NOT EXISTS archetype_score INT DEFAULT 0;
  `;

  try {
    await client.query(sql);
    console.log('✅ Schema V8 applied successfully! archetype_score column ready.');
  } catch (err) {
    console.error('Migration Error:', err.message);
  }

  await client.end();
  console.log('Migration complete.');
}

migrate();
