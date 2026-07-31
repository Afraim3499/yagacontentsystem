// ====================================================================
// MIGRATION V3: Add Headline, Subheadline, Body Content & SLA columns
// Run: node update_schema_v3.js
// ====================================================================

const { Client } = require('pg');

const DB_CONNECTION = 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

async function migrate() {
  const client = new Client({
    connectionString: DB_CONNECTION,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL...');

  const sql = `
    -- Add headline, subheadline, body_content to base_content
    DO $$ BEGIN
      ALTER TABLE public.base_content ADD COLUMN IF NOT EXISTS headline TEXT;
      ALTER TABLE public.base_content ADD COLUMN IF NOT EXISTS subheadline TEXT;
      ALTER TABLE public.base_content ADD COLUMN IF NOT EXISTS body_content TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;

    -- Add headline, subheadline to creator_captions
    DO $$ BEGIN
      ALTER TABLE public.creator_captions ADD COLUMN IF NOT EXISTS headline TEXT;
      ALTER TABLE public.creator_captions ADD COLUMN IF NOT EXISTS subheadline TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;

    -- Add SLA tracking columns to assignment_queue
    DO $$ BEGIN
      ALTER TABLE public.assignment_queue ADD COLUMN IF NOT EXISTS sla_nudge_sent BOOLEAN DEFAULT FALSE;
      ALTER TABLE public.assignment_queue ADD COLUMN IF NOT EXISTS sla_ticketed BOOLEAN DEFAULT FALSE;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;

    -- Ensure system_settings table exists for Owner Chat ID & config
    CREATE TABLE IF NOT EXISTS public.system_config (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO public.system_config (key, value)
    VALUES ('owner_chat_id', '1617457685')
    ON CONFLICT (key) DO NOTHING;
  `;

  try {
    await client.query(sql);
    console.log('✅ Schema V3 applied successfully!');
  } catch (err) {
    console.error('Migration Error:', err.message);
  }

  await client.end();
  console.log('Migration complete.');
}

migrate();
