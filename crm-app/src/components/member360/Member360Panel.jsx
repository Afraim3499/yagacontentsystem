import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Crown, Clock, DollarSign, Users, RotateCw, Trash2, RefreshCw,
  UserCheck, Sparkles, Pencil, ArrowRightLeft, LogOut, AlertTriangle, CheckCircle2,
  Undo2, FileText, Link2, TrendingUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useMember360 } from './Member360Context';
import { computeLiveStatus, LIVE_STATUS_LABEL, fmtDateNice, relTime, daysUntil } from '../data/dates';
import { renewMember, updateMemberContact, setMemberDeleted, linkConcierge } from '../../lib/memberActions';

const EVENT_META = {
  enrolled:         { icon: Crown,          color: '#e39e2e', label: 'Enrolled' },
  renewed:          { icon: RotateCw,       color: '#00d294', label: 'Renewed' },
  upgraded:         { icon: Sparkles,       color: '#e39e2e', label: 'Upgraded to VIP' },
  edited:           { icon: Pencil,         color: '#38bdf8', label: 'Edited' },
  tier_changed:     { icon: ArrowRightLeft, color: '#38bdf8', label: 'Tier changed' },
  status_changed:   { icon: ArrowRightLeft, color: '#a7b0c0', label: 'Status changed' },
  approved:         { icon: CheckCircle2,   color: '#00d294', label: 'Approved' },
  expiring_soon:    { icon: AlertTriangle,  color: '#e39e2e', label: 'Expiring soon' },
  expired:          { icon: Clock,          color: '#f43f5e', label: 'Expired' },
  left:             { icon: LogOut,         color: '#f43f5e', label: 'Left group' },
  rejoined:         { icon: Undo2,          color: '#00d294', label: 'Rejoined' },
  deleted:          { icon: Trash2,         color: '#f43f5e', label: 'Removed' },
  restored:         { icon: Undo2,          color: '#00d294', label: 'Restored' },
  payment:          { icon: DollarSign,     color: '#00d294', label: 'Payment' },
  payment_recorded: { icon: DollarSign,     color: '#00d294', label: 'Payment recorded' },
  note_added:       { icon: FileText,       color: '#a7b0c0', label: 'Note' },
  concierge_linked: { icon: Link2,          color: '#38bdf8', label: 'Concierge linked' },
  joined_free:      { icon: Users,          color: '#38bdf8', label: 'Joined free group' },
};
const metaFor = (t) => EVENT_META[t] || { icon: FileText, color: '#a7b0c0', label: t };

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">{label}</div>
      <div className="text-sm text-[var(--color-text)]">{value ?? '—'}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    ACTIVE: ['bg-emerald-500/10 text-emerald-400 border-emerald-500/20', CheckCircle2],
    EXPIRING_SOON: ['bg-amber-500/10 text-amber-400 border-amber-500/20', AlertTriangle],
    EXPIRED: ['bg-red-500/10 text-red-400 border-red-500/20', Clock],
  };
  const [cls, Icon] = map[status] || map.ACTIVE;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-semibold ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {LIVE_STATUS_LABEL[status] || status}
    </span>
  );
}

export default function Member360Panel() {
  const { memberId, close, notifyChange, refreshKey } = useMember360();

  const [member, setMember] = useState(null);
  const [events, setEvents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [concierge, setConcierge] = useState(null);
  const [associates, setAssociates] = useState([]);
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const { data: m } = await supabase.from('community_members_log').select('*').eq('id', memberId).maybeSingle();
      setMember(m || null);

      const [{ data: ev }, { data: pay }] = await Promise.all([
        supabase.from('member_events').select('*').eq('member_id', memberId).order('created_at', { ascending: false }),
        supabase.from('member_payments').select('*').eq('member_id', memberId).order('created_at', { ascending: false }),
      ]);
      setEvents(ev || []);
      setPayments(pay || []);

      const tgId = m?.concierge_telegram_id || m?.telegram_user_id;
      if (tgId && /^\d+$/.test(String(tgId))) {
        const { data: cs } = await supabase.from('concierge_user_states').select('*').eq('telegram_id', String(tgId)).maybeSingle();
        setConcierge(cs || null);
      } else {
        setConcierge(null);
      }

      if (associates.length === 0) {
        const { data: a } = await supabase.from('associates').select('id, name, paid_commission_pct, free_commission_rate');
        setAssociates(a || []);
      }
      if (!rules) {
        const { data: r } = await supabase.from('commission_rules').select('*').eq('id', 'RULE-DEFAULT').maybeSingle();
        setRules(r || null);
      }
    } finally {
      setLoading(false);
    }
  }, [memberId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Reset tab when a different member opens
  useEffect(() => { setTab('overview'); }, [memberId]);

  // ESC to close
  useEffect(() => {
    if (!memberId) return undefined;
    const h = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [memberId, close]);

  if (!memberId) return null;

  const status = member ? computeLiveStatus(member) : 'ACTIVE';
  const dte = member ? daysUntil(member.subscription_expiration_date) : null;
  const isVip = /VIP/i.test(member?.member_tier || '');
  const lifetime = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const runAction = async (fn, okMsg) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res?.error) { alert(res.error.message || 'Action failed'); return; }
    if (okMsg) alert(okMsg);
    notifyChange();
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-[560px] h-full bg-[var(--bg-dark)] border-l border-[var(--border-line)] shadow-2xl flex flex-col animate-[slidein_.2s_ease]">
        <style>{`@keyframes slidein{from{transform:translateX(24px);opacity:.6}to{transform:none;opacity:1}}`}</style>

        {/* Header */}
        <div className="p-5 border-b border-[var(--border-line)] flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center font-black text-[#0b0e14]">
              {(member?.first_name || 'M').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold text-[var(--color-text)] truncate">{member?.first_name || 'Member'}</div>
              <div className="text-xs text-[var(--color-muted)] flex items-center gap-2">
                {member?.telegram_handle && <span className="text-[#e39e2e]/80">{member.telegram_handle}</span>}
                {member?.telegram_user_id && <span className="font-mono text-[10px]">ID: {member.telegram_user_id}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => { setBusy(true); load().finally(() => setBusy(false)); }} className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)]" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={close} className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)]"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-1 border-b border-[var(--border-line)]">
          {[
            ['overview', 'Overview'],
            ['timeline', `Timeline (${events.length})`],
            ['payments', `Payments (${payments.length})`],
            ['presale', 'Pre-sale'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors ${
                tab === id ? 'bg-[var(--bg-surface)] text-[var(--color-text)] border-b-2 border-[#e39e2e]' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && !member ? (
            <div className="text-center py-16 text-[var(--color-muted)] text-sm">Loading…</div>
          ) : !member ? (
            <div className="text-center py-16 text-[var(--color-muted)] text-sm">Member not found.</div>
          ) : tab === 'overview' ? (
            <OverviewTab
              member={member} status={status} dte={dte} isVip={isVip} lifetime={lifetime}
              payments={payments} busy={busy}
              onSaveContact={(patch) => runAction(() => updateMemberContact(member, patch), 'Saved.')}
              onRenew={(v) => runAction(() => renewMember(member, { ...v, associates, commissionRules: rules }), 'Renewed.')}
              onToggleDeleted={() => runAction(() => setMemberDeleted(member, !member.deleted_at), member.deleted_at ? 'Restored.' : 'Removed.')}
            />
          ) : tab === 'timeline' ? (
            <TimelineTab events={events} />
          ) : tab === 'payments' ? (
            <PaymentsTab payments={payments} />
          ) : (
            <PresaleTab member={member} concierge={concierge}
              onLink={(id) => runAction(() => linkConcierge(member, id), 'Linked.')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────
function OverviewTab({ member, status, dte, isVip, lifetime, payments, busy, onSaveContact, onRenew, onToggleDeleted }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    first_name: member.first_name || '', telegram_handle: member.telegram_handle || '',
    email: member.email || '', country: member.country || '', notes: member.notes || '',
  });
  useEffect(() => {
    setForm({
      first_name: member.first_name || '', telegram_handle: member.telegram_handle || '',
      email: member.email || '', country: member.country || '', notes: member.notes || '',
    });
    setEdit(false);
  }, [member]);

  const [renewOpen, setRenewOpen] = useState(false);
  const [renewTier, setRenewTier] = useState(member.paid_subscription_value || 350);
  const [renewMonths, setRenewMonths] = useState(member.subscription_duration_months || 6);

  const firstPay = payments[payments.length - 1];
  const lastPay = payments[0];

  return (
    <>
      {member.deleted_at && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Removed {relTime(member.deleted_at)} — hidden from the roster.
        </div>
      )}

      {/* Subscription */}
      <div className="glass-panel p-4 border border-[var(--border-line)] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Subscription</span>
          {isVip && <StatusBadge status={status} />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tier" value={isVip ? `$${Number(member.paid_subscription_value || 0)}` : member.member_tier?.replace('_', ' ')} />
          <Field label="Duration" value={member.subscription_duration_months ? `${member.subscription_duration_months} months` : '—'} />
          <Field label="Joined" value={fmtDateNice(member.paid_group_joined_at || member.free_group_joined_at || member.created_at)} />
          <Field label="Expires" value={member.subscription_expiration_date ? `${fmtDateNice(member.subscription_expiration_date)}${dte != null ? ` (${dte}d)` : ''}` : '—'} />
          <Field label="Renewals" value={member.renewal_count ?? 0} />
          <Field label="Lifetime value" value={money(member.lifetime_value || lifetime)} />
          <Field label="First converted" value={member.first_converted_at ? fmtDateNice(member.first_converted_at) : '—'} />
          <Field label="Last renewed" value={member.last_renewed_at ? fmtDateNice(member.last_renewed_at) : '—'} />
        </div>
      </div>

      {/* Attribution */}
      <div className="glass-panel p-4 border border-[var(--border-line)] space-y-3">
        <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Attribution</span>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Team member" value={member.associate_name || 'Unattributed / Direct'} />
          <Field label="Enrollment source" value={member.enrollment_source || '—'} />
          <Field label="First payment" value={firstPay ? `${money(firstPay.amount)} · ${fmtDateNice(firstPay.created_at)}` : '—'} />
          <Field label="Last payment" value={lastPay ? `${money(lastPay.amount)} · ${fmtDateNice(lastPay.created_at)}` : '—'} />
        </div>
      </div>

      {/* Contact (editable) */}
      <div className="glass-panel p-4 border border-[var(--border-line)] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Contact & Notes</span>
          {!edit && <button onClick={() => setEdit(true)} className="text-xs text-[#e39e2e] font-bold flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>}
        </div>
        {!edit ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Display name" value={member.first_name} />
            <Field label="Telegram" value={member.telegram_handle} />
            <Field label="Email" value={member.email} />
            <Field label="Country" value={member.country} />
            <div className="col-span-2"><Field label="Notes" value={member.notes} /></div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {[['first_name', 'Display name'], ['telegram_handle', 'Telegram @handle'], ['email', 'Email'], ['country', 'Country']].map(([k, label]) => (
              <div key={k}>
                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase">{label}</label>
                <input value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-line)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[#e39e2e]" />
              </div>
            ))}
            <div>
              <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-line)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[#e39e2e]" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEdit(false)} className="px-3 py-1.5 text-xs text-[var(--color-muted)]">Cancel</button>
              <button disabled={busy} onClick={() => onSaveContact(form)} className="grad-button px-4 py-1.5 rounded-lg text-xs font-black">Save</button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="glass-panel p-4 border border-[var(--border-line)] space-y-3">
        <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Actions</span>
        {!renewOpen ? (
          <div className="flex flex-wrap gap-2">
            {isVip && (
              <button onClick={() => setRenewOpen(true)} className="px-3 py-2 rounded-lg bg-[#e39e2e]/10 text-[#e39e2e] border border-[#e39e2e]/30 text-xs font-bold flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5" /> Renew
              </button>
            )}
            <button disabled={busy} onClick={onToggleDeleted}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${
                member.deleted_at ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
              {member.deleted_at ? <><Undo2 className="w-3.5 h-3.5" /> Restore</> : <><LogOut className="w-3.5 h-3.5" /> Mark left</>}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase">Tier ($)</label>
                <input type="number" value={renewTier} onChange={(e) => setRenewTier(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-line)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[#e39e2e]" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase">Months</label>
                <select value={renewMonths} onChange={(e) => setRenewMonths(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-line)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[#e39e2e]">
                  {[3, 6, 8, 12, 14].map((m) => <option key={m} value={m}>{m} months</option>)}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-[var(--color-muted)]">New expiry starts today. Writes a renewal payment + timeline event.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenewOpen(false)} className="px-3 py-1.5 text-xs text-[var(--color-muted)]">Cancel</button>
              <button disabled={busy} onClick={() => { onRenew({ tierValue: renewTier, months: renewMonths }); setRenewOpen(false); }}
                className="grad-button px-4 py-1.5 rounded-lg text-xs font-black">Confirm renewal</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────
function TimelineTab({ events }) {
  const [openId, setOpenId] = useState(null);
  if (events.length === 0) return <div className="text-center py-12 text-[var(--color-muted)] text-sm">No events yet.</div>;
  return (
    <div className="space-y-1">
      {events.map((e) => {
        const meta = metaFor(e.event_type);
        const Icon = meta.icon;
        const hasDetail = e.detail && Object.keys(e.detail).length > 0;
        return (
          <div key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0"
                style={{ background: `${meta.color}18`, borderColor: `${meta.color}40`, color: meta.color }}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="w-px flex-1 bg-[var(--border-line)]" />
            </div>
            <div className="pb-4 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[var(--color-text)]">{meta.label}</span>
                <span className="text-[10px] text-[var(--color-muted)] font-mono shrink-0">{relTime(e.created_at)}</span>
              </div>
              {e.note && <div className="text-xs text-[var(--color-muted)] mt-0.5">{e.note}</div>}
              <div className="text-[10px] text-[var(--color-muted)]/70 mt-0.5">
                {e.source}{e.actor && e.actor !== 'system' ? ` · ${e.actor}` : ''} · {fmtDateNice(e.created_at)}
              </div>
              {hasDetail && (
                <button onClick={() => setOpenId(openId === e.id ? null : e.id)} className="text-[10px] text-[#38bdf8] mt-1">
                  {openId === e.id ? 'Hide' : 'Show'} detail
                </button>
              )}
              {openId === e.id && (
                <pre className="text-[10px] bg-[var(--bg-input)] border border-[var(--border-line)] rounded-lg p-2 mt-1 overflow-x-auto text-[var(--color-muted)]">
                  {JSON.stringify(e.detail, null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Payments ──────────────────────────────────────────────────────────
function PaymentsTab({ payments }) {
  const [openId, setOpenId] = useState(null);
  if (payments.length === 0) return <div className="text-center py-12 text-[var(--color-muted)] text-sm">No payments recorded.</div>;
  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  return (
    <div className="space-y-2">
      <div className="text-xs text-[var(--color-muted)]">Lifetime: <span className="text-[var(--color-text)] font-bold">{money(total)}</span> across {payments.length} payment{payments.length > 1 ? 's' : ''}</div>
      {payments.map((p) => (
        <div key={p.id} className="glass-panel border border-[var(--border-line)] rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                p.payment_type === 'new' ? 'bg-[#e39e2e]/15 text-[#e39e2e]'
                  : p.payment_type === 'renewal' ? 'bg-emerald-500/15 text-emerald-400'
                  : p.payment_type === 'upgrade' ? 'bg-[#38bdf8]/15 text-[#38bdf8]'
                  : 'bg-slate-500/15 text-slate-300'
              }`}>{p.payment_type}</span>
              {p.is_backfilled && <span className="text-[9px] text-[var(--color-muted)]">backfilled</span>}
              {p.voided_at && <span className="text-[9px] text-red-400 font-bold">VOIDED</span>}
            </div>
            <span className={`font-bold ${Number(p.amount) < 0 ? 'text-red-400' : 'text-[var(--color-text)]'}`}>{money(p.amount)}</span>
          </div>
          <div className="text-[10px] text-[var(--color-muted)] mt-1">
            {p.term_start ? `${fmtDateNice(p.term_start)} → ${fmtDateNice(p.term_end)}` : fmtDateNice(p.created_at)}
            {p.duration_months ? ` · ${p.duration_months}mo` : ''} · {p.source}
          </div>
          <button onClick={() => setOpenId(openId === p.id ? null : p.id)} className="text-[10px] text-[#38bdf8] mt-1">
            {openId === p.id ? 'Hide' : 'Commission split'}
          </button>
          {openId === p.id && (
            <div className="text-[11px] mt-1.5 grid grid-cols-2 gap-1 bg-[var(--bg-input)] rounded-lg p-2 border border-[var(--border-line)]">
              <span className="text-[var(--color-muted)]">Associate</span><span className="text-right text-emerald-400">{money(p.associate_commission)}</span>
              <span className="text-[var(--color-muted)]">Kabidul</span><span className="text-right text-[#e39e2e]">{money(p.kabidul_commission)}</span>
              {p.commission_snapshot?.rate_source && (
                <><span className="text-[var(--color-muted)]">Rate source</span><span className="text-right">{p.commission_snapshot.rate_source}</span></>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Pre-sale ──────────────────────────────────────────────────────────
function PresaleTab({ member, concierge, onLink }) {
  const [id, setId] = useState('');
  if (!concierge) {
    return (
      <div className="space-y-3">
        <div className="text-center py-8 text-[var(--color-muted)] text-sm">
          <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No linked concierge (pre-sale) lead.
        </div>
        <div className="glass-panel p-4 border border-[var(--border-line)] space-y-2">
          <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase">Link a concierge lead by Telegram ID</label>
          <div className="flex gap-2">
            <input value={id} onChange={(e) => setId(e.target.value)} placeholder={member.telegram_user_id}
              className="flex-1 bg-[var(--bg-input)] border border-[var(--border-line)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[#e39e2e]" />
            <button disabled={!id} onClick={() => onLink(id)} className="grad-button px-3 py-2 rounded-lg text-xs font-black">Link</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="glass-panel p-4 border border-[var(--border-line)] space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[#38bdf8]" />
        <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Pre-sale funnel</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Funnel stage" value={concierge.current_stage} />
        <Field label="Archetype score" value={concierge.archetype_score} />
        <Field label="Risk segment" value={concierge.risk_segment} />
        <Field label="Loss pain" value={concierge.loss_pain ? 'Yes' : 'No'} />
        <Field label="Pro structure" value={concierge.professional_structure ? 'Yes' : 'No'} />
        <Field label="Re-engaged" value={concierge.reengagement_sent_at ? fmtDateNice(concierge.reengagement_sent_at) : '—'} />
        <Field label="First seen" value={fmtDateNice(concierge.created_at)} />
        <Field label="Last update" value={relTime(concierge.updated_at)} />
      </div>
    </div>
  );
}
