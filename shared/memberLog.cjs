// Bot-side writers for the append-only member intelligence tables
// (public.member_events, public.member_payments).
//
// Mirror of crm-app/src/lib/memberLog.js, for the Telegram bot / daemons
// which talk to Postgres directly via `pg`. Pass in the engine's own
// `runQuery(text, params)` helper. Every call is non-throwing — a logging
// failure must never break an enrollment.
//
//   const { logMemberEvent, recordMemberPayment } = require('./shared/memberLog.cjs');
//   await logMemberEvent(runQuery, { memberId, type: 'enrolled', ... });

async function logMemberEvent(runQuery, {
  memberId, telegramUserId, memberName,
  type, note, detail, actor, source, paymentId,
}) {
  try {
    await runQuery(
      `INSERT INTO public.member_events
         (member_id, telegram_user_id, member_name, event_type, note, detail, actor, source, payment_id)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
      [
        memberId,
        telegramUserId || null,
        memberName || null,
        type,
        note || null,
        JSON.stringify(detail || {}),
        actor || 'bot',
        source || 'BOT',
        paymentId || null,
      ],
    );
  } catch (err) {
    console.error('logMemberEvent (bot) failed:', err.message);
  }
}

async function recordMemberPayment(runQuery, p) {
  try {
    const res = await runQuery(
      `INSERT INTO public.member_payments
         (member_id, telegram_user_id, member_name, payment_type, amount, currency,
          duration_months, term_start, term_end, previous_term_end, package_id, package_name,
          associate_id, associate_name, associate_commission, kabidul_commission,
          commission_snapshot, recorded_by, source, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20)
       RETURNING id`,
      [
        p.memberId,
        p.telegramUserId || null,
        p.memberName || null,
        p.paymentType || 'new',
        p.amount ?? 0,
        p.currency || 'USD',
        p.durationMonths ?? null,
        p.termStart || null,
        p.termEnd || null,
        p.previousTermEnd || null,
        p.packageId || null,
        p.packageName || null,
        p.associateId || null,
        p.associateName || null,
        p.associateCommission ?? 0,
        p.kabidulCommission ?? 0,
        JSON.stringify(p.commissionSnapshot || {}),
        p.recordedBy || 'bot',
        p.source || 'BOT',
        p.note || null,
      ],
    );
    return res.rows[0] ? res.rows[0].id : null;
  } catch (err) {
    console.error('recordMemberPayment (bot) failed:', err.message);
    return null;
  }
}

module.exports = { logMemberEvent, recordMemberPayment };
