import { supabase } from './supabase';
import { resolveRates, calcCommissions } from './commissions';
import { logMemberEvent, recordMemberPayment, diffFields } from './memberLog';

// Shared member lifecycle actions — used by the Member 360 panel and (for
// renew) the VIP desk, so the "update state row + write event + write
// payment" sequence lives in one place.

export async function renewMember(member, { tierValue, months, associates, commissionRules, source = 'CRM_MEMBER_360' }) {
  const subVal = Number(tierValue) || Number(member.paid_subscription_value) || 350;
  const m = Number(months) || Number(member.subscription_duration_months) || 6;
  const rates = resolveRates(associates?.find((a) => a.id === member.associate_id), commissionRules);
  const { associate_commission: commVal, kabidul_commission: kabComm, snapshot } = calcCommissions(subVal, rates);

  const now = new Date();
  const newExp = new Date(now);
  newExp.setMonth(newExp.getMonth() + m);
  const priorExpiry = member.subscription_expiration_date || null;

  const { error } = await supabase.from('community_members_log').update({
    paid_subscription_value: subVal,
    paid_commission: commVal,
    kabidul_commission: kabComm,
    subscription_duration_months: m,
    subscription_expiration_date: newExp.toISOString(),
    subscription_status: 'ACTIVE',
    status: 'ACTIVE',
    last_renewed_at: now.toISOString(),
    renewal_count: Number(member.renewal_count || 0) + 1,
    lifetime_value: Number(member.lifetime_value || member.paid_subscription_value || 0) + subVal,
  }).eq('id', member.id);
  if (error) return { error };

  const paymentId = await recordMemberPayment({
    memberId: member.id, telegramUserId: member.telegram_user_id, memberName: member.first_name,
    paymentType: 'renewal', amount: subVal, durationMonths: m,
    termStart: now.toISOString(), termEnd: newExp.toISOString(), previousTermEnd: priorExpiry,
    associateId: member.associate_id || null, associateName: member.associate_name,
    associateCommission: commVal, kabidulCommission: kabComm, commissionSnapshot: snapshot,
    recordedBy: 'crm', source,
  });
  await logMemberEvent({
    memberId: member.id, telegramUserId: member.telegram_user_id, memberName: member.first_name,
    type: 'renewed', source, paymentId,
    note: `Renewed at $${subVal} for ${m} months`,
    detail: {
      before: { subscription_expiration_date: priorExpiry, paid_subscription_value: member.paid_subscription_value },
      after: { subscription_expiration_date: newExp.toISOString(), paid_subscription_value: subVal },
    },
  });
  return { ok: true, kabidul_commission: kabComm };
}

export async function updateMemberContact(member, patch, source = 'CRM_MEMBER_360') {
  const clean = {};
  for (const [k, v] of Object.entries(patch)) clean[k] = typeof v === 'string' ? v.trim() || null : v;
  const { error } = await supabase.from('community_members_log').update(clean).eq('id', member.id);
  if (error) return { error };
  const diff = diffFields(member, clean, Object.keys(clean));
  if (Object.keys(diff).length) {
    await logMemberEvent({
      memberId: member.id, telegramUserId: member.telegram_user_id, memberName: clean.first_name || member.first_name,
      type: 'edited', source, note: `Edited ${Object.keys(diff).join(', ')}`, detail: { diff },
    });
  }
  return { ok: true };
}

export async function setMemberDeleted(member, deleted, source = 'CRM_MEMBER_360') {
  const patch = deleted
    ? { deleted_at: new Date().toISOString(), deleted_by: 'crm', status: 'LEFT', left_at: member.left_at || new Date().toISOString() }
    : { deleted_at: null, deleted_by: null, status: 'ACTIVE' };
  const { error } = await supabase.from('community_members_log').update(patch).eq('id', member.id);
  if (error) return { error };
  await logMemberEvent({
    memberId: member.id, telegramUserId: member.telegram_user_id, memberName: member.first_name,
    type: deleted ? 'deleted' : 'restored', source,
    note: deleted ? 'Soft-deleted' : 'Restored to active',
  });
  return { ok: true };
}

export async function linkConcierge(member, conciergeTelegramId, source = 'CRM_MEMBER_360') {
  const { error } = await supabase.from('community_members_log')
    .update({ concierge_telegram_id: String(conciergeTelegramId).trim() }).eq('id', member.id);
  if (error) return { error };
  await logMemberEvent({
    memberId: member.id, telegramUserId: member.telegram_user_id, memberName: member.first_name,
    type: 'concierge_linked', source, note: `Linked to concierge lead ${conciergeTelegramId}`,
  });
  return { ok: true };
}
