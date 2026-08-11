// ====================================================================
// MIGRATION V6: Add public.affiliates and public.affiliate_referrals
// Run: node add_affiliate_tables_v6.js
// ====================================================================

const { Client } = require('pg');

const DB_CONNECTION = 'postgresql://postgres.ghwvwtwktnveqdqivxmy:Rizwan99636%3F@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

async function migrate() {
  const client = new Client({
    connectionString: DB_CONNECTION,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL for Affiliate Schema Migration...');

  const sql = `
    -- 1. AFFILIATES MASTER TABLE
    CREATE TABLE IF NOT EXISTS public.affiliates (
      id VARCHAR(50) PRIMARY KEY, -- e.g. AFF-001 or AFF_1001
      telegram_id TEXT UNIQUE NOT NULL,
      telegram_handle TEXT,
      first_name TEXT,
      wallet_address TEXT,
      payout_currency VARCHAR(20) DEFAULT 'USDT',
      invite_link TEXT UNIQUE,
      commission_rate NUMERIC(5,2) DEFAULT 15.00,
      total_free_joins INT DEFAULT 0,
      total_conversions INT DEFAULT 0,
      total_earned NUMERIC(10,2) DEFAULT 0.00,
      total_paid NUMERIC(10,2) DEFAULT 0.00,
      unpaid_balance NUMERIC(10,2) DEFAULT 0.00,
      status VARCHAR(20) DEFAULT 'Active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. AFFILIATE REFERRALS DETAIL TABLE
    CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
      id VARCHAR(50) PRIMARY KEY, -- e.g. REF-20260811-001
      affiliate_id VARCHAR(50) NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
      joined_telegram_id TEXT NOT NULL,
      joined_username TEXT,
      joined_first_name TEXT,
      status VARCHAR(30) DEFAULT 'FREE_MEMBER', -- FREE_MEMBER, CONVERTED_PREMIUM
      converted_plan VARCHAR(50), -- Quarterly, Half-Yearly, Yearly
      converted_amount NUMERIC(10,2) DEFAULT 0.00,
      earned_commission NUMERIC(10,2) DEFAULT 0.00,
      payout_status VARCHAR(20) DEFAULT 'UNPAID', -- UNPAID, PAID
      payout_txhash TEXT,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Seed sample affiliate data if empty
    INSERT INTO public.affiliates (id, telegram_id, telegram_handle, first_name, wallet_address, payout_currency, invite_link, commission_rate, total_free_joins, total_conversions, total_earned, total_paid, unpaid_balance)
    VALUES
      ('AFF-101', '891023', '@crypto_alpha_partner', 'Dan Trade', 'TR7NHqJeo42nZ115wX8TfUt2rK6f8j9XYZ', 'USDT', 'https://t.me/+SampleAffiliateLink1', 15.00, 48, 6, 448.50, 200.00, 248.50),
      ('AFF-102', '991044', '@macro_insider', 'Sarah Bull', '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 'USDT', 'https://t.me/+SampleAffiliateLink2', 20.00, 112, 14, 1397.20, 1000.00, 397.20)
    ON CONFLICT (id) DO NOTHING;

    -- Seed sample referral conversions
    INSERT INTO public.affiliate_referrals (id, affiliate_id, joined_telegram_id, joined_username, joined_first_name, status, converted_plan, converted_amount, earned_commission, payout_status)
    VALUES
      ('REF-SAMPLE-01', 'AFF-101', '551920', '@john_trader9', 'John', 'CONVERTED_PREMIUM', 'Quarterly VIP ($299)', 299.00, 44.85, 'UNPAID'),
      ('REF-SAMPLE-02', 'AFF-102', '771822', '@crypto_whale_99', 'Marcus', 'CONVERTED_PREMIUM', 'Yearly VIP ($799)', 799.00, 159.80, 'UNPAID')
    ON CONFLICT (id) DO NOTHING;
  `;

  try {
    await client.query(sql);
    console.log('✅ Schema V6 applied successfully! public.affiliates and public.affiliate_referrals ready.');
  } catch (err) {
    console.error('Migration Error:', err.message);
  }

  await client.end();
  console.log('Migration complete.');
}

migrate();
