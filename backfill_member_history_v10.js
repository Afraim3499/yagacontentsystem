// ====================================================================
// BACKFILL V10: seed member_payments + member_events for existing VIPs
//
// The intelligence tables start empty. For every current PAID_VIP member
// that already has a subscription value but no payment row, this
// synthesises:
//   - one member_payments row  (payment_type='new', is_backfilled=true)
//   - one member_events row     (event_type='enrolled', source='BACKFILL')
// and sets first_converted_at / lifetime_value / renewal_count on the
// member so the CRM's derived numbers line up.
//
// Idempotent: guarded by NOT EXISTS + is_backfilled, so re-running only
// picks up members added since the last run.
//
// Run once: DATABASE_URL="postgresql://..." node backfill_member_history_v10.js
// ====================================================================

const { Client } = require('pg');
const { resolveRates, calcCommissions } = require('./shared/commissions.cjs');

const DB_CONNECTION = process.env.DATABASE_URL;
if (!DB_CONNECTION) {
  console.error('DATABASE_URL is not set. Refusing to run without an explicit connection string.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DB_CONNECTION, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected. Backfilling member payment + event history...');

  const rulesRes = await client.query(`SELECT free_rate_per_100, paid_commission_pct FROM public.commission_rules WHERE id = 'RULE-DEFAULT'`);
  const rules = rulesRes.rows[0] || null;

  const assocRes = await client.query(`SELECT id, paid_commission_pct, free_commission_rate FROM public.associates`);
  const assocById = {};
  for (const a of assocRes.rows) assocById[a.id] = a;

  const members = (await client.query(`
    SELECT m.*
    FROM public.community_members_log m
    WHERE m.member_tier = 'PAID_VIP'
      AND COALESCE(m.paid_subscription_value, 0) > 0
      AND NOT EXISTS (SELECT 1 FROM public.member_payments p WHERE p.member_id = m.id)
  `)).rows;

  console.log(`${members.length} VIP member(s) need backfilling.`);

  let payments = 0, events = 0, errors = 0, revenue = 0;

  for (const m of members) {
    const gross = Number(m.paid_subscription_value) || 0;
    const rates = resolveRates(assocById[m.associate_id], rules);
    const calc = calcCommissions(gross, rates);
    const assocComm = m.paid_commission != null ? Number(m.paid_commission) : calc.associate_commission;
    const kabComm = m.kabidul_commission != null ? Number(m.kabidul_commission) : calc.kabidul_commission;
    const termStart = m.paid_group_joined_at || m.created_at;
    const termEnd = m.subscription_expiration_date || null;

    try {
      const pay = await client.query(
        `INSERT INTO public.member_payments
           (member_id, telegram_user_id, member_name, payment_type, amount, currency,
            duration_months, term_start, term_end, package_id, package_name,
            associate_id, associate_name, associate_commission, kabidul_commission,
            commission_snapshot, recorded_by, source, note, is_backfilled, created_at)
         VALUES ($1,$2,$3,'new',$4,'USD',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,'backfill','BACKFILL',
                 'Synthesised from the member row at V10 migration',TRUE,$15)
         RETURNING id`,
        [
          m.id, m.telegram_user_id, m.first_name, gross,
          m.subscription_duration_months || null, termStart, termEnd,
          m.package_id || null, m.package_name || null,
          m.associate_id || null, m.associate_name || null, assocComm, kabComm,
          JSON.stringify({ ...calc.snapshot, backfilled: true }),
          termStart,
        ],
      );
      payments++;
      revenue += gross;

      await client.query(
        `INSERT INTO public.member_events
           (member_id, telegram_user_id, member_name, event_type, note, detail, actor, source, payment_id, created_at)
         VALUES ($1,$2,$3,'enrolled',$4,$5::jsonb,'system','BACKFILL',$6,$7)`,
        [
          m.id, m.telegram_user_id, m.first_name,
          `Backfilled enrollment — $${gross} for ${m.subscription_duration_months || '?'} months`,
          JSON.stringify({ after: { paid_subscription_value: gross, associate: m.associate_name }, meta: { backfilled: true } }),
          pay.rows[0].id, termStart,
        ],
      );
      events++;

      await client.query(
        `UPDATE public.community_members_log
         SET first_converted_at = COALESCE(first_converted_at, $2),
             lifetime_value = GREATEST(COALESCE(lifetime_value, 0), $3),
             renewal_count = GREATEST(renewal_count, 0)
         WHERE id = $1`,
        [m.id, termStart, gross],
      );
    } catch (err) {
      errors++;
      console.error(`  ✗ ${m.id} (${m.first_name}):`, err.message);
    }
  }

  // Cross-check against the CRM's client-side revenue sum.
  const totalRes = await client.query(
    `SELECT COALESCE(SUM(paid_subscription_value), 0) AS crm_sum
     FROM public.community_members_log WHERE member_tier = 'PAID_VIP' AND deleted_at IS NULL`,
  );
  const backfilledRes = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS ledger_sum FROM public.member_payments WHERE is_backfilled = TRUE`,
  );

  await client.end();

  console.log(`\nDone. ${payments} payments, ${events} events, ${errors} errors.`);
  console.log(`This run added $${revenue.toFixed(2)} of revenue to the ledger.`);
  console.log(`CRM member-row revenue total : $${Number(totalRes.rows[0].crm_sum).toFixed(2)}`);
  console.log(`Backfilled ledger total       : $${Number(backfilledRes.rows[0].ledger_sum).toFixed(2)}`);
  if (errors > 0) process.exitCode = 1;
}

main().catch((err) => { console.error('Backfill failed:', err); process.exit(1); });
