// ====================================================================
// MIGRATION V5: Add system_logs table for Live Activity Stream & Audit UI
// Run: node update_schema_v5.js
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
    -- System Activity Logs Table
    CREATE TABLE IF NOT EXISTS public.system_logs (
      id VARCHAR(50) PRIMARY KEY,
      event_type VARCHAR(50) NOT NULL,
      creator_id VARCHAR(50),
      creator_name TEXT,
      platform_id VARCHAR(50),
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Seed initial logs if empty
    INSERT INTO public.system_logs (id, event_type, creator_name, message, created_at)
    VALUES 
      ('LOG-001', 'SYSTEM_INIT', 'System', '🚀 Yaga Operations Command Center initialized.', NOW() - INTERVAL '2 hours'),
      ('LOG-002', 'ONBOARDING', 'Alex Crypto', '⚡ Alex Crypto onboarded on Telegram and created voice profile.', NOW() - INTERVAL '1 hour'),
      ('LOG-003', 'PLATFORM_ONBOARD', 'Elena Trades', '✅ Elena Trades completed onboarding for X (Twitter).', NOW() - INTERVAL '45 mins'),
      ('LOG-004', 'DISPATCH', 'System', '📢 Batch 1 dispatched to 3 creators across 6 platforms.', NOW() - INTERVAL '30 mins')
    ON CONFLICT (id) DO NOTHING;
  `;

  try {
    await client.query(sql);
    console.log('✅ Schema V5 applied successfully! system_logs table ready.');
  } catch (err) {
    console.error('Migration Error:', err.message);
  }

  await client.end();
  console.log('Migration complete.');
}

migrate();
