// ====================================================================
// MIGRATION V9: Add indexes for the columns the CRM actually filters/
// sorts on. None of these tables have any CREATE INDEX statements
// anywhere in version control (only primary keys) despite several of
// them being fetched with paginated .range() loops in the CRM — this
// is exactly the kind of gap that turns into silent slow-desk-load
// complaints as the tables grow.
//
// Columns below were taken directly from the .eq()/.order()/.or()
// calls actually present in yaga-content-system/crm-app/src (grepped,
// not guessed) — see PR/commit description for the exact query list.
// .eq('id', ...) filters are skipped since primary keys are already
// indexed automatically.
//
// Run: DATABASE_URL="postgresql://...” node add_performance_indexes_v9.js
//
// Deliberately does NOT hardcode a connection string (several other
// migration scripts in this folder do — that's a separate, already-
// flagged leak; don't copy that pattern into new files). This script
// refuses to run without DATABASE_URL set explicitly.
// ====================================================================

const { Client } = require('pg');

const DB_CONNECTION = process.env.DATABASE_URL;

if (!DB_CONNECTION) {
  console.error('DATABASE_URL is not set. Refusing to run without an explicit connection string.');
  console.error('Usage: DATABASE_URL="postgresql://..." node add_performance_indexes_v9.js');
  process.exit(1);
}

// CREATE INDEX CONCURRENTLY can't run inside a transaction block, and
// can't run inside a multi-statement string passed to client.query() in
// one call either — each statement is executed separately below.
const statements = [
  // community_members_log — the heaviest table in the CRM (paginated
  // fetch in MemberTrackingDeskView/VipMembersDeskView loads it in
  // 1000-row pages, always ordered by created_at; VipMembersDeskView
  // additionally filters with .or('member_tier.eq.PAID_VIP,...')).
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_members_log_created_at
     ON public.community_members_log (created_at DESC);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_members_log_member_tier
     ON public.community_members_log (member_tier);`,

  // trade_signals_log — TradeSignalsDeskView pages through this ordered
  // by created_at.
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_signals_log_created_at
     ON public.trade_signals_log (created_at DESC);`,

  // vip_packages — sorted by price on every Member Tracking / VIP load.
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vip_packages_price
     ON public.vip_packages (price);`,

  // associates — sorted by created_at (Member Tracking) and by name
  // (VIP Members).
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_associates_created_at
     ON public.associates (created_at DESC);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_associates_name
     ON public.associates (name);`,

  // affiliate_referrals — AffiliatesDeskView pages through this ordered
  // by created_at (same "can silently grow past a single page" shape as
  // community_members_log).
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_affiliate_referrals_created_at
     ON public.affiliate_referrals (created_at DESC);`,

  // content_days — Content Studio sorts the date picker by date.
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_days_date
     ON public.content_days (date DESC);`,

  // base_content — every Content Studio load does
  // .eq('day_id', dayId), i.e. "give me all content for this date".
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_base_content_day_id
     ON public.base_content (day_id);`,

  // creator_captions — filtered/joined by content_id (.in() and .eq())
  // and by creator_id (.eq()) on every Content Studio load and every
  // per-creator assign/unassign action.
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_captions_content_id
     ON public.creator_captions (content_id);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_captions_creator_id
     ON public.creator_captions (creator_id);`,

  // owners — Settings/Creators desks sort by created_at.
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_owners_created_at
     ON public.owners (created_at DESC);`,

  // issue_tickets — Dashboard/Issue Desk sorts by created_at.
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_issue_tickets_created_at
     ON public.issue_tickets (created_at DESC);`,

  // assignment_queue — Dashboard filters by day_id and sorts by
  // created_at.
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_queue_day_id
     ON public.assignment_queue (day_id);`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_queue_created_at
     ON public.assignment_queue (created_at DESC);`,

  // reviews — Review Moderation desk sorts by created_at.
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_created_at
     ON public.reviews (created_at DESC);`,

  // system_logs — Activity Logs desk sorts by created_at (already
  // capped at .limit(100), but the ORDER BY still has to scan/sort
  // without an index as the table grows).
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_logs_created_at
     ON public.system_logs (created_at DESC);`,
];

// NOTE on affiliates/all_partners_view: AffiliatesDeskView sorts the
// roster by total_earned, but it reads from all_partners_view, not the
// affiliates table directly. This script doesn't index that because the
// view's underlying definition isn't in version control anywhere in
// this repo — pull the view definition from the Supabase dashboard
// first (`select definition from pg_views where viewname =
// 'all_partners_view';`) and index whichever base table(s)/columns it
// actually selects total_earned from.

async function migrate() {
  const client = new Client({
    connectionString: DB_CONNECTION,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL for performance index migration (V9)...');

  let succeeded = 0;
  let failed = 0;

  for (const statement of statements) {
    const label = statement.match(/idx_\w+/)?.[0] ?? statement.slice(0, 40);
    try {
      await client.query(statement);
      console.log(`✅ ${label}`);
      succeeded++;
    } catch (err) {
      console.error(`❌ ${label}: ${err.message}`);
      failed++;
    }
  }

  await client.end();
  console.log(`\nMigration complete: ${succeeded} succeeded, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

migrate();
