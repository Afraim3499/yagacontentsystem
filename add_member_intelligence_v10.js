// ====================================================================
// MIGRATION V10: Member intelligence backbone
//
// Additive only — no DROP, no DELETE, no type changes — so it is safe to
// run while the Telegram bot and the CRM are live. Idempotent: every
// statement uses IF NOT EXISTS / DROP POLICY IF EXISTS, so re-running is a
// no-op.
//
// Adds:
//   1. public.member_events         — append-only lifecycle log
//   2. public.member_payments       — one row per money-in event
//   3. new columns on public.community_members_log (contact + denormalised
//      lifetime fields + soft-delete)
//   4. Row Level Security on the two new tables: SELECT + INSERT for the
//      anon/authenticated roles, NO UPDATE / DELETE (append-only). The
//      existing community_members_log keeps its current full access so the
//      bot and the un-migrated views keep working.
//
// Run: DATABASE_URL="postgresql://...:5432/postgres" node add_member_intelligence_v10.js
//
// Does NOT hardcode a connection string (matches add_performance_indexes_v9.js).
// ====================================================================

const { Client } = require('pg');

const DB_CONNECTION = process.env.DATABASE_URL;

if (!DB_CONNECTION) {
  console.error('DATABASE_URL is not set. Refusing to run without an explicit connection string.');
  console.error('Usage: DATABASE_URL="postgresql://..." node add_member_intelligence_v10.js');
  process.exit(1);
}

const SQL = `
-- ── 1. member_events : append-only lifecycle log ─────────────────────
CREATE TABLE IF NOT EXISTS public.member_events (
  id                TEXT PRIMARY KEY DEFAULT ('EVT-' || replace(gen_random_uuid()::text, '-', '')),
  member_id         TEXT NOT NULL REFERENCES public.community_members_log(id) ON DELETE CASCADE,
  telegram_user_id  TEXT,
  member_name       TEXT,                              -- denormalised, survives member edits
  event_type        TEXT NOT NULL,
      -- enrolled | renewed | upgraded | edited | tier_changed | status_changed
      -- | approved | expiring_soon | expired | left | rejoined | deleted | restored
      -- | payment | note_added | concierge_linked
  note              TEXT,
  detail            JSONB NOT NULL DEFAULT '{}'::jsonb, -- { before, after, diff, meta }
  actor             TEXT DEFAULT 'system',              -- owner id | 'bot' | 'daemon' | 'system'
  source            TEXT,                               -- CRM_VIP_DESK | CRM_MEMBER_DESK | BOT | BACKFILL
  payment_id        TEXT,                               -- soft link to member_payments.id
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_events_member    ON public.member_events (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_events_type      ON public.member_events (event_type);
CREATE INDEX IF NOT EXISTS idx_member_events_created   ON public.member_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_events_tg_user   ON public.member_events (telegram_user_id);

-- ── 2. member_payments : one row per money-in ────────────────────────
CREATE TABLE IF NOT EXISTS public.member_payments (
  id                    TEXT PRIMARY KEY DEFAULT ('MPY-' || replace(gen_random_uuid()::text, '-', '')),
  member_id             TEXT NOT NULL REFERENCES public.community_members_log(id) ON DELETE CASCADE,
  telegram_user_id      TEXT,
  member_name           TEXT,
  payment_type          TEXT NOT NULL DEFAULT 'new',   -- new | renewal | upgrade | adjustment
  amount                NUMERIC(12,2) NOT NULL DEFAULT 0,  -- may be negative for 'adjustment'
  currency              TEXT NOT NULL DEFAULT 'USD',
  duration_months       INTEGER,
  term_start            TIMESTAMPTZ,
  term_end              TIMESTAMPTZ,
  previous_term_end     TIMESTAMPTZ,                    -- prior expiry, preserved across renewals
  package_id            TEXT,
  package_name          TEXT,
  associate_id          TEXT,
  associate_name        TEXT,
  associate_commission  NUMERIC(12,2) DEFAULT 0,
  kabidul_commission    NUMERIC(12,2) DEFAULT 0,
  commission_snapshot   JSONB NOT NULL DEFAULT '{}'::jsonb, -- rates used, for auditability
  recorded_by           TEXT DEFAULT 'system',
  source                TEXT,
  note                  TEXT,
  is_backfilled         BOOLEAN NOT NULL DEFAULT FALSE,
  voided_at             TIMESTAMPTZ,
  voided_by             TEXT,
  void_reason           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_payments_member   ON public.member_payments (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_payments_type     ON public.member_payments (payment_type);
CREATE INDEX IF NOT EXISTS idx_member_payments_tg_user  ON public.member_payments (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_member_payments_created  ON public.member_payments (created_at DESC);

-- ── 3. new columns on community_members_log (all nullable / defaulted) ─
ALTER TABLE public.community_members_log
  ADD COLUMN IF NOT EXISTS email               TEXT,
  ADD COLUMN IF NOT EXISTS country             TEXT,
  ADD COLUMN IF NOT EXISTS timezone            TEXT,
  ADD COLUMN IF NOT EXISTS language            TEXT,
  ADD COLUMN IF NOT EXISTS notes               TEXT,
  ADD COLUMN IF NOT EXISTS renewal_count       INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_value      NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_converted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_renewed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS left_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by          TEXT,
  ADD COLUMN IF NOT EXISTS concierge_telegram_id TEXT;

CREATE INDEX IF NOT EXISTS idx_cml_deleted_at ON public.community_members_log (deleted_at);

-- ── 4. Row Level Security : append-only on the two new tables ─────────
ALTER TABLE public.member_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_payments ENABLE ROW LEVEL SECURITY;

-- Supabase's default privileges auto-grant ALL to anon/authenticated on
-- new public tables, so an explicit GRANT is not enough — REVOKE the
-- mutating privileges so the append-only guarantee holds at the grant
-- level too, not only via the (absent) RLS policies.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.member_events, public.member_payments
  FROM anon, authenticated;
GRANT SELECT, INSERT ON public.member_events   TO anon, authenticated;
GRANT SELECT, INSERT ON public.member_payments TO anon, authenticated;

DROP POLICY IF EXISTS member_events_select   ON public.member_events;
DROP POLICY IF EXISTS member_events_insert   ON public.member_events;
DROP POLICY IF EXISTS member_payments_select ON public.member_payments;
DROP POLICY IF EXISTS member_payments_insert ON public.member_payments;

CREATE POLICY member_events_select   ON public.member_events   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY member_events_insert   ON public.member_events   FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY member_payments_select ON public.member_payments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY member_payments_insert ON public.member_payments FOR INSERT TO anon, authenticated WITH CHECK (true);
-- no UPDATE / DELETE policy => those commands are denied for these roles.
-- Corrections go through member_payments.voided_* / an 'adjustment' row.

-- ── refresh PostgREST's schema cache so the SPA sees the new tables ──
NOTIFY pgrst, 'reload schema';
`;

async function migrate() {
  const client = new Client({ connectionString: DB_CONNECTION, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL (V10 member-intelligence migration)...');

  try {
    await client.query(SQL);
    console.log('✅ V10 applied: member_events, member_payments, community_members_log columns, RLS.');

    // quick verification
    const { rows } = await client.query(`
      SELECT
        (SELECT count(*) FROM information_schema.tables
           WHERE table_schema='public' AND table_name IN ('member_events','member_payments')) AS new_tables,
        (SELECT count(*) FROM information_schema.columns
           WHERE table_schema='public' AND table_name='community_members_log'
             AND column_name IN ('notes','email','renewal_count','lifetime_value','deleted_at')) AS new_columns,
        (SELECT count(*) FROM pg_policies
           WHERE schemaname='public' AND tablename IN ('member_events','member_payments')) AS policies
    `);
    console.log('   verification:', rows[0]);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate();
