// ====================================================================
// MIGRATION: Add registration_codes table for CRM-managed bot onboarding
// Run: node add_registration_codes_table.js
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
    -- Registration Codes table (CRM-managed, used by Telegram bot for /start onboarding)
    CREATE TABLE IF NOT EXISTS public.registration_codes (
      code VARCHAR(50) PRIMARY KEY,           -- e.g. ALEX-2026, ELENA-2026
      creator_id VARCHAR(20) NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
      label TEXT,                              -- Human-friendly label for CRM display
      active BOOLEAN DEFAULT TRUE,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Seed initial registration codes
    INSERT INTO public.registration_codes (code, creator_id, label, active)
    VALUES 
      ('ALEX-2026', 'CR-001', 'Alex Vance Registration Code', TRUE),
      ('ELENA-2026', 'CR-002', 'Elena Rostova Registration Code', TRUE),
      ('MARCUS-2026', 'CR-003', 'Marcus Thorne Registration Code', TRUE)
    ON CONFLICT (code) DO NOTHING;

    -- Also add scheduled_time column to assignment_queue if missing
    DO $$ BEGIN
      ALTER TABLE public.assignment_queue ADD COLUMN IF NOT EXISTS scheduled_time TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;
  `;

  try {
    await client.query(sql);
    console.log('✅ registration_codes table created and seeded!');
    console.log('✅ scheduled_time column ensured on assignment_queue!');
  } catch (err) {
    console.error('Migration Error:', err.message);
  }

  await client.end();
  console.log('Migration complete.');
}

migrate();
