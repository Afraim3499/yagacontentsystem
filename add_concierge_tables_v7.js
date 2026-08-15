// ====================================================================
// MIGRATION V7: Add public.concierge_user_states
// Run: node add_concierge_tables_v7.js
// ====================================================================

const { Client } = require('pg');

const DB_CONNECTION = process.env.DATABASE_URL || 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

async function migrate() {
  const client = new Client({
    connectionString: DB_CONNECTION,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL for Concierge State Schema Migration...');

  const sql = `
    -- CONCIERGE USER STATE TABLE
    CREATE TABLE IF NOT EXISTS public.concierge_user_states (
      telegram_id TEXT PRIMARY KEY,
      first_name TEXT,
      username TEXT,
      current_stage VARCHAR(50) DEFAULT 'WELCOME', -- WELCOME, DECONSTRUCT_NOISE, CUSTOMIZATION_LAYER, PROOF_SHOWN, CLOSE_INITIATED, COMPLETED
      loss_pain BOOLEAN DEFAULT FALSE,
      professional_structure BOOLEAN DEFAULT FALSE,
      risk_segment VARCHAR(30) DEFAULT 'UNKNOWN', -- SPOT, LEVERAGE, BEGINNER
      reengagement_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await client.query(sql);
    console.log('✅ Schema V7 applied successfully! public.concierge_user_states ready.');
  } catch (err) {
    console.error('Migration Error:', err.message);
  }

  await client.end();
  console.log('Migration complete.');
}

migrate();
