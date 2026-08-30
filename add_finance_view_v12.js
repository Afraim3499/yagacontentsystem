// ====================================================================
// MIGRATION V12: finance_daily_view
//
// Powers the Owner Financial Analytics window — a per-day roll-up of
// membership growth + revenue + commission distribution, which the client
// filters by an arbitrary date range. Read-only view; re-runnable.
//
// Run: DATABASE_URL="postgresql://..." node add_finance_view_v12.js
// ====================================================================

const { Client } = require('pg');

const DB_CONNECTION = process.env.DATABASE_URL;
if (!DB_CONNECTION) {
  console.error('DATABASE_URL is not set. Refusing to run without an explicit connection string.');
  process.exit(1);
}

const SQL = `
DROP VIEW IF EXISTS public.finance_daily_view;
CREATE VIEW public.finance_daily_view AS
WITH pay AS (
  SELECT created_at::date AS d,
         count(*) FILTER (WHERE payment_type IN ('new', 'upgrade'))          AS vip_joins,
         count(*) FILTER (WHERE payment_type = 'renewal')                     AS renewals,
         COALESCE(sum(amount), 0)                                             AS revenue,
         COALESCE(sum(amount) FILTER (WHERE payment_type = 'renewal'), 0)     AS renewal_revenue,
         -- only commission attributed to a real team member is an owner cost;
         -- the 5% on unattributed/direct sales has no payee and stays with the owner
         COALESCE(sum(associate_commission) FILTER (WHERE associate_id IS NOT NULL), 0) AS associate_commission,
         COALESCE(sum(associate_commission) FILTER (WHERE associate_id IS NULL), 0)     AS unattributed_commission,
         COALESCE(sum(kabidul_commission), 0)                                 AS kabidul_commission
  FROM public.member_payments
  WHERE voided_at IS NULL
  GROUP BY 1
),
free AS (
  SELECT free_group_joined_at::date AS d, count(*) AS free_joins
  FROM public.community_members_log
  WHERE deleted_at IS NULL
    AND free_group_joined_at IS NOT NULL
    AND (member_tier <> 'PAID_VIP' OR member_tier IS NULL)
  GROUP BY 1
),
left_free AS (
  SELECT left_at::date AS d, count(*) AS members_left
  FROM public.community_members_log
  WHERE left_at IS NOT NULL
  GROUP BY 1
)
SELECT
  COALESCE(pay.d, free.d, left_free.d)                                        AS day,
  COALESCE(free.free_joins, 0)::int                                          AS free_joins,
  COALESCE(pay.vip_joins, 0)::int                                            AS vip_joins,
  COALESCE(pay.renewals, 0)::int                                             AS renewals,
  COALESCE(left_free.members_left, 0)::int                                   AS members_left,
  COALESCE(pay.revenue, 0)::numeric(12,2)                                    AS revenue,
  COALESCE(pay.renewal_revenue, 0)::numeric(12,2)                            AS renewal_revenue,
  COALESCE(pay.associate_commission, 0)::numeric(12,2)                       AS associate_commission,
  COALESCE(pay.unattributed_commission, 0)::numeric(12,2)                    AS unattributed_commission,
  COALESCE(pay.kabidul_commission, 0)::numeric(12,2)                         AS kabidul_commission,
  (COALESCE(pay.revenue, 0)
   - COALESCE(pay.associate_commission, 0)
   - COALESCE(pay.kabidul_commission, 0))::numeric(12,2)                     AS owner_net
FROM pay
FULL OUTER JOIN free      ON pay.d = free.d
FULL OUTER JOIN left_free ON COALESCE(pay.d, free.d) = left_free.d
ORDER BY day;

GRANT SELECT ON public.finance_daily_view TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
`;

async function migrate() {
  const client = new Client({ connectionString: DB_CONNECTION, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected (V12 finance_daily_view)...');
  try {
    await client.query(SQL);
    console.log('✅ finance_daily_view created.');
    const r = await client.query(`
      SELECT
        min(day) AS first_day, max(day) AS last_day,
        sum(free_joins) AS free, sum(vip_joins) AS vip,
        sum(revenue) AS revenue, sum(associate_commission) AS assoc,
        sum(kabidul_commission) AS kabidul, sum(owner_net) AS owner_net
      FROM public.finance_daily_view
      WHERE day >= '2026-08-12'`);
    console.log('Since 2026-08-12:', r.rows[0]);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate();
