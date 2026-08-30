// ====================================================================
// MIGRATION V11: team_performance_view + team_growth_view
//
// Powers the rebuilt Command Center ("Team Performance Center"). The team
// = the associates (they carry all member attribution). Read-only views;
// re-runnable (CREATE OR REPLACE).
//
// Run: DATABASE_URL="postgresql://..." node add_team_performance_view_v11.js
// ====================================================================

const { Client } = require('pg');

const DB_CONNECTION = process.env.DATABASE_URL;
if (!DB_CONNECTION) {
  console.error('DATABASE_URL is not set. Refusing to run without an explicit connection string.');
  process.exit(1);
}

const SQL = `
-- ── team_performance_view : one row per associate ────────────────────
-- Attribution is 100% via associate_id (verified: 0 name-only rows), so a
-- plain join is safe. Member join date = first of paid/free/created.
-- DROP first so column set changes on re-run (CREATE OR REPLACE can't reorder).
DROP VIEW IF EXISTS public.team_performance_view;
CREATE VIEW public.team_performance_view AS
WITH mem AS (
  SELECT
    c.associate_id,
    c.member_tier,
    c.paid_subscription_value,
    c.free_commission,
    c.paid_commission,
    c.paid_group_joined_at,
    COALESCE(c.paid_group_joined_at, c.free_group_joined_at, c.created_at) AS joined_at
  FROM public.community_members_log c
  WHERE c.deleted_at IS NULL
    AND c.associate_id IS NOT NULL
)
SELECT
  a.id                                            AS associate_id,
  a.name                                          AS team_member,
  a.status,
  a.created_at                                    AS joined_team_at,
  COALESCE(a.paid_commission_pct, 5.00)           AS commission_pct,
  COALESCE(a.total_paid, 0)::numeric(12,2)        AS commission_paid,

  -- all-time
  count(*) FILTER (WHERE m.member_tier <> 'PAID_VIP' OR m.member_tier IS NULL)::int AS free_joins,
  count(*) FILTER (WHERE m.member_tier = 'PAID_VIP')::int                            AS vip_conversions,
  count(*)::int                                                                     AS total_members,
  round(100.0 * count(*) FILTER (WHERE m.member_tier = 'PAID_VIP')
        / NULLIF(count(*), 0), 1)                                                    AS conversion_rate_pct,
  COALESCE(sum(m.paid_subscription_value), 0)::numeric(12,2)                         AS revenue_driven,
  COALESCE(sum(m.free_commission + m.paid_commission), 0)::numeric(12,2)             AS commission_earned,
  GREATEST(0, COALESCE(sum(m.free_commission + m.paid_commission), 0)
              - COALESCE(a.total_paid, 0))::numeric(12,2)                            AS commission_owed,

  -- month to date
  count(*) FILTER (WHERE m.joined_at >= date_trunc('month', now())
                     AND (m.member_tier <> 'PAID_VIP' OR m.member_tier IS NULL))::int AS free_joins_mtd,
  count(*) FILTER (WHERE m.joined_at >= date_trunc('month', now())
                     AND m.member_tier = 'PAID_VIP')::int                             AS vip_conversions_mtd,
  COALESCE(sum(m.paid_subscription_value)
           FILTER (WHERE m.paid_group_joined_at >= date_trunc('month', now())), 0)::numeric(12,2) AS revenue_mtd,

  -- last 7 days
  count(*) FILTER (WHERE m.joined_at >= now() - interval '7 days'
                     AND (m.member_tier <> 'PAID_VIP' OR m.member_tier IS NULL))::int AS free_joins_7d,
  count(*) FILTER (WHERE m.joined_at >= now() - interval '7 days'
                     AND m.member_tier = 'PAID_VIP')::int                             AS vip_conversions_7d,

  -- recency
  max(m.joined_at)                                                                   AS last_member_at,
  max(m.paid_group_joined_at)                                                        AS last_vip_at,
  EXTRACT(DAY FROM (now() - max(m.joined_at)))::int                                  AS days_since_last_member,
  (max(m.joined_at) >= now() - interval '7 days')                                    AS active_7d,
  count(*) FILTER (WHERE m.joined_at >= date_trunc('month', now()) - interval '1 month'
                     AND m.joined_at <  date_trunc('month', now()))::int              AS members_prev_month
FROM public.associates a
LEFT JOIN mem m ON m.associate_id = a.id
GROUP BY a.id, a.name, a.status, a.created_at, a.paid_commission_pct, a.total_paid
ORDER BY vip_conversions DESC, free_joins DESC;

-- ── team_growth_view : monthly acquisition, last 18 months ───────────
CREATE OR REPLACE VIEW public.team_growth_view AS
SELECT
  to_char(date_trunc('month', COALESCE(c.paid_group_joined_at, c.free_group_joined_at, c.created_at)), 'YYYY-MM') AS month,
  count(*) FILTER (WHERE c.member_tier <> 'PAID_VIP' OR c.member_tier IS NULL)::int AS free_joins,
  count(*) FILTER (WHERE c.member_tier = 'PAID_VIP')::int                            AS vip_conversions,
  COALESCE(sum(c.paid_subscription_value)
           FILTER (WHERE c.paid_group_joined_at IS NOT NULL), 0)::numeric(12,2)      AS revenue
FROM public.community_members_log c
WHERE c.deleted_at IS NULL
  AND COALESCE(c.paid_group_joined_at, c.free_group_joined_at, c.created_at) >= date_trunc('month', now()) - interval '17 months'
GROUP BY 1
ORDER BY 1;

GRANT SELECT ON public.team_performance_view, public.team_growth_view TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
`;

async function migrate() {
  const client = new Client({ connectionString: DB_CONNECTION, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected (V11 team performance views)...');
  try {
    await client.query(SQL);
    console.log('✅ team_performance_view + team_growth_view created.');
    const perf = await client.query(`SELECT team_member, free_joins, vip_conversions, revenue_driven, free_joins_7d, vip_conversions_7d, days_since_last_member FROM public.team_performance_view WHERE total_members > 0 ORDER BY vip_conversions DESC`);
    console.table(perf.rows);
    const growth = await client.query(`SELECT * FROM public.team_growth_view ORDER BY month DESC LIMIT 6`);
    console.table(growth.rows);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate();
