import { supabase } from './supabase';

// Thin, non-throwing writers for the two append-only intelligence tables.
// A logging failure must never block the user's actual action, so every
// call swallows its error (after logging it to the console).
//
// The bot has a parallel implementation at ../../shared/memberLog.cjs
// (raw pg). Keep the two in step — they only do inserts, no logic.

export async function logMemberEvent({
  memberId, telegramUserId, memberName,
  type, note, detail, actor, source, paymentId,
}) {
  try {
    const { error } = await supabase.from('member_events').insert({
      member_id: memberId,
      telegram_user_id: telegramUserId || null,
      member_name: memberName || null,
      event_type: type,
      note: note || null,
      detail: detail || {},
      actor: actor || 'crm',
      source: source || 'CRM',
      payment_id: paymentId || null,
    });
    if (error) console.error('logMemberEvent failed:', error.message);
  } catch (e) {
    console.error('logMemberEvent exception:', e);
  }
}

export async function recordMemberPayment(p) {
  try {
    const { data, error } = await supabase
      .from('member_payments')
      .insert({
        member_id: p.memberId,
        telegram_user_id: p.telegramUserId || null,
        member_name: p.memberName || null,
        payment_type: p.paymentType || 'new',
        amount: p.amount,
        currency: p.currency || 'USD',
        duration_months: p.durationMonths ?? null,
        term_start: p.termStart || null,
        term_end: p.termEnd || null,
        previous_term_end: p.previousTermEnd || null,
        package_id: p.packageId || null,
        package_name: p.packageName || null,
        associate_id: p.associateId || null,
        associate_name: p.associateName || null,
        associate_commission: p.associateCommission ?? 0,
        kabidul_commission: p.kabidulCommission ?? 0,
        commission_snapshot: p.commissionSnapshot || {},
        recorded_by: p.recordedBy || 'crm',
        source: p.source || 'CRM',
        note: p.note || null,
      })
      .select('id')
      .single();
    if (error) {
      console.error('recordMemberPayment failed:', error.message);
      return null;
    }
    return data.id;
  } catch (e) {
    console.error('recordMemberPayment exception:', e);
    return null;
  }
}

// Shallow diff helper for `edited` events — returns { field: [before, after] }.
export function diffFields(before, after, fields) {
  const out = {};
  for (const f of fields) {
    const b = before?.[f];
    const a = after?.[f];
    if (String(b ?? '') !== String(a ?? '')) out[f] = [b ?? null, a ?? null];
  }
  return out;
}
