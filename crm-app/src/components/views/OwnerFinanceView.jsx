import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Wallet, DollarSign, Users, Crown, TrendingUp, RotateCw, LogOut, RefreshCw, Download, Briefcase,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportCsv } from '../data/exportCsv';
import { fmtDate, startOfDayISO, endOfDayISO } from '../data/dates';

// ---------------------------------------------------------------------------
// Owner Financial Analytics — pick a date range, see the whole picture:
// revenue, membership growth, and how every dollar of commission was split
// (each team member's share + Kabidul's 25% + what the owner keeps).
//
// Reference point: reliable tracking starts 2026-08-12 ("since launch").
// Commission figures are ACCRUED (what's owed) — no payouts recorded yet.
// ---------------------------------------------------------------------------

const LAUNCH = '2026-08-12';
const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const money2 = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Kpi({ label, value, sub, icon: Icon, accent = '#e39e2e' }) {
  return (
    <div className="glass-card-interactive p-4 sm:p-5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-[11px] font-bold text-[#a7b0c0] uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center border"
          style={{ background: `${accent}20`, borderColor: `${accent}50`, color: accent }}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-black text-white">{value}</div>
      {sub && <div className="text-[10px] text-[#a7b0c0]">{sub}</div>}
    </div>
  );
}

export default function OwnerFinanceView() {
  const [daily, setDaily] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [from, setFrom] = useState(LAUNCH);
  const [to, setTo] = useState(today());

  async function fetchData() {
    setLoading(true);
    try {
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase.from('finance_daily_view').select('*').order('day'),
        supabase.from('member_payments')
          .select('id, amount, payment_type, associate_id, associate_name, associate_commission, kabidul_commission, created_at, is_backfilled')
          .is('voided_at', null)
          .order('created_at'),
      ]);
      setDaily(d || []);
      setPayments(p || []);
    } catch (err) {
      console.error('Owner Finance fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => { fetchData(); }, []);

  const applyPreset = (preset) => {
    const t = today();
    if (preset === 'launch') { setFrom(LAUNCH); setTo(t); }
    else if (preset === 'month') { setFrom(t.slice(0, 8) + '01'); setTo(t); }
    else if (preset === '30d') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      setFrom(d.toISOString().slice(0, 10)); setTo(t);
    } else if (preset === 'all') { setFrom('2025-01-01'); setTo(t); }
  };

  // ── everything below is scoped to [from, to] ──
  const fromT = from ? new Date(startOfDayISO(from)).getTime() : -Infinity;
  const toT = to ? new Date(endOfDayISO(to)).getTime() : Infinity;

  const rangeDaily = useMemo(
    () => daily.filter((r) => {
      const t = new Date(r.day).getTime();
      return t >= fromT && t <= toT;
    }),
    [daily, fromT, toT],
  );

  const rangePayments = useMemo(
    () => payments.filter((p) => {
      const t = new Date(p.created_at).getTime();
      return t >= fromT && t <= toT;
    }),
    [payments, fromT, toT],
  );

  const totals = useMemo(() => {
    const sum = (rows, k) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);
    const revenue = sum(rangeDaily, 'revenue');
    const associate = sum(rangeDaily, 'associate_commission');       // attributed team members only
    const unattributed = sum(rangeDaily, 'unattributed_commission'); // 5% on direct sales — no payee
    const kabidul = sum(rangeDaily, 'kabidul_commission');
    return {
      revenue,
      renewalRevenue: sum(rangeDaily, 'renewal_revenue'),
      freeJoins: sum(rangeDaily, 'free_joins'),
      vipJoins: sum(rangeDaily, 'vip_joins'),
      renewals: sum(rangeDaily, 'renewals'),
      membersLeft: sum(rangeDaily, 'members_left'),
      associate,
      unattributed,
      kabidul,
      ownerNet: revenue - associate - kabidul,
    };
  }, [rangeDaily]);

  // ── per-team-member commission share in range (attributed only) ──
  const distribution = useMemo(() => {
    const byAssoc = new Map();
    let directRevenue = 0;
    let directPayments = 0;
    let unattributed = 0;
    for (const p of rangePayments) {
      if (!p.associate_id) {
        directRevenue += Number(p.amount || 0);
        directPayments += 1;
        unattributed += Number(p.associate_commission || 0);
        continue;
      }
      const cur = byAssoc.get(p.associate_id) || { key: p.associate_id, name: p.associate_name || p.associate_id, payments: 0, revenue: 0, share: 0 };
      cur.payments += 1;
      cur.revenue += Number(p.amount || 0);
      cur.share += Number(p.associate_commission || 0);
      byAssoc.set(p.associate_id, cur);
    }
    const rows = [...byAssoc.values()].sort((a, b) => b.share - a.share);
    const kabidulShare = rangePayments.reduce((s, p) => s + Number(p.kabidul_commission || 0), 0);
    return { rows, kabidulShare, directRevenue, directPayments, unattributed };
  }, [rangePayments]);

  // ── weekly chart series ──
  const chartData = useMemo(() => {
    const wk = new Map();
    for (const r of rangeDaily) {
      const d = new Date(r.day);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const cur = wk.get(key) || { week: key, free_joins: 0, vip_joins: 0, revenue: 0 };
      cur.free_joins += Number(r.free_joins || 0);
      cur.vip_joins += Number(r.vip_joins || 0);
      cur.revenue += Number(r.revenue || 0);
      wk.set(key, cur);
    }
    return [...wk.values()].sort((a, b) => a.week.localeCompare(b.week));
  }, [rangeDaily]);

  const exportDistribution = () => {
    const rows = [
      ...distribution.rows.map((r) => ({ payee: r.name, payments: r.payments, revenue_driven: r.revenue.toFixed(2), rate: '5%', share: r.share.toFixed(2) })),
      { payee: 'Kabidul (management)', payments: rangePayments.length, revenue_driven: totals.revenue.toFixed(2), rate: '25%', share: distribution.kabidulShare.toFixed(2) },
      { payee: 'Direct / unattributed', payments: distribution.directPayments, revenue_driven: distribution.directRevenue.toFixed(2), rate: 'no payee', share: '0.00' },
      { payee: 'PAID OUT TO OTHERS', payments: '', revenue_driven: '', rate: '', share: (totals.associate + distribution.kabidulShare).toFixed(2) },
      { payee: 'OWNER KEEPS (NET)', payments: '', revenue_driven: totals.revenue.toFixed(2), rate: '', share: totals.ownerNet.toFixed(2) },
    ];
    exportCsv(rows, [
      { header: 'Payee', key: 'payee' }, { header: 'Payments', key: 'payments' },
      { header: 'Revenue driven ($)', key: 'revenue_driven' }, { header: 'Rate', key: 'rate' },
      { header: 'Share ($)', key: 'share' },
    ], `Owner_Finance_${from}_to_${to}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="glass-panel p-4 sm:p-8 bg-gradient-to-r from-[#121720] via-[#090c10] to-[#121720] border border-[#00d294]/30 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-[#00d294]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <span className="badge badge-emerald font-mono text-[10px] sm:text-xs">Owner Financial Analytics</span>
            <h2 className="text-xl sm:text-3xl font-black text-[#eaf2ff] tracking-tight uppercase flex items-center gap-2">
              <Wallet className="w-6 h-6 text-[#00d294]" /> Financial &amp; VIP Analysis
            </h2>
            <p className="text-xs sm:text-sm text-[#a7b0c0] max-w-3xl">
              Revenue, membership growth and the full commission split for any date range.
              Reliable tracking starts <span className="text-white font-bold">{LAUNCH}</span>.
              Commission figures are <span className="text-white font-bold">accrued</span> (owed) — no payouts recorded yet.
            </p>
          </div>
          <button onClick={() => { setRefreshing(true); fetchData(); }} disabled={refreshing}
            className="p-2.5 rounded-xl bg-[#080a0f] hover:bg-[#121722] text-slate-300 border border-white/10 shrink-0" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#00d294]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Date range */}
      <div className="glass-panel p-4 border border-white/10 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-bold text-[#a7b0c0] uppercase tracking-wider">Date range</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="bg-[#080a0f] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00d294]" />
        <span className="text-[#a7b0c0] text-xs">→</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="bg-[#080a0f] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00d294]" />
        <div className="flex items-center gap-1.5 ml-auto">
          {[['launch', 'Since launch'], ['month', 'This month'], ['30d', 'Last 30d'], ['all', 'All time']].map(([k, label]) => (
            <button key={k} onClick={() => applyPreset(k)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#121722] hover:bg-[#1a2130] text-slate-300 border border-white/10">
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-16 text-center text-[#a7b0c0] text-sm">Loading financials…</div>
      ) : (
        <>
          {/* KPI band */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Kpi label="Total Revenue" icon={DollarSign} accent="#00d294"
              value={money(totals.revenue)} sub={`${money(totals.renewalRevenue)} from renewals`} />
            <Kpi label="Free Members Joined" icon={Users} accent="#38bdf8"
              value={totals.freeJoins.toLocaleString()} sub={`${totals.membersLeft.toLocaleString()} left in range`} />
            <Kpi label="Paid Members Joined" icon={Crown} accent="#e39e2e"
              value={totals.vipJoins.toLocaleString()} sub={`+ ${totals.renewals} renewals`} />
            <Kpi label="Owner Net" icon={Wallet} accent="#00d294"
              value={money(totals.ownerNet)}
              sub={`after ${money(totals.associate)} team + ${money(totals.kabidul)} Kabidul`} />
          </div>

          {/* Chart */}
          <div className="glass-panel p-4 sm:p-6 space-y-3 border border-white/10">
            <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00d294]" /> Weekly Revenue &amp; Joins
            </h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="week" tick={{ fill: '#a7b0c0', fontSize: 9 }} />
                  <YAxis yAxisId="count" tick={{ fill: '#a7b0c0', fontSize: 9 }} />
                  <YAxis yAxisId="rev" orientation="right" tick={{ fill: '#00d294', fontSize: 9 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#0f141d', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }} />
                  <Bar yAxisId="count" dataKey="free_joins" name="Free joins" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="count" dataKey="vip_joins" name="Paid joins" fill="#e39e2e" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="rev" dataKey="revenue" name="Revenue $" stroke="#00d294" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Commission distribution */}
          <div className="glass-panel border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-white/10">
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#e39e2e]" /> Commission Distribution
                <span className="text-[10px] font-mono text-[#a7b0c0] normal-case">({fmtDate(from)} → {fmtDate(to)})</span>
              </h3>
              <button onClick={exportDistribution}
                className="px-3 py-1.5 rounded-lg bg-[#121722] hover:bg-[#1a2130] text-slate-200 text-xs font-bold border border-[#38bdf8]/40 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#080a0f] text-[#a7b0c0] uppercase text-[10px] border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3">Payee</th>
                    <th className="px-4 py-3 text-right">Payments</th>
                    <th className="px-4 py-3 text-right">Revenue driven</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Share (accrued)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {distribution.rows.map((r) => (
                    <tr key={r.key} className="hover:bg-[#121722]">
                      <td className="px-4 py-3 font-bold text-white">{r.name}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{r.payments}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{money2(r.revenue)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">5%</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{money2(r.share)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#e39e2e]/5 hover:bg-[#e39e2e]/10">
                    <td className="px-4 py-3 font-bold text-[#e39e2e]">Kabidul — management</td>
                    <td className="px-4 py-3 text-right text-slate-300">{rangePayments.length}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{money2(totals.revenue)}</td>
                    <td className="px-4 py-3 text-right text-[#e39e2e]">25%</td>
                    <td className="px-4 py-3 text-right font-bold text-[#e39e2e]">{money2(distribution.kabidulShare)}</td>
                  </tr>
                  {distribution.directPayments > 0 && (
                    <tr className="hover:bg-[#121722]">
                      <td className="px-4 py-3 text-slate-400">Direct / unattributed sales</td>
                      <td className="px-4 py-3 text-right text-slate-400">{distribution.directPayments}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{money2(distribution.directRevenue)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">— no payee</td>
                      <td className="px-4 py-3 text-right text-slate-500">{money2(0)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="border-t-2 border-white/10 bg-[#080a0f]">
                  <tr>
                    <td className="px-4 py-3 font-black text-white uppercase">Paid out to others</td>
                    <td />
                    <td />
                    <td />
                    <td className="px-4 py-3 text-right font-black text-white">{money2(totals.associate + distribution.kabidulShare)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-black text-[#00d294] uppercase">Owner keeps (net)</td>
                    <td colSpan={2} className="px-4 py-3 text-[10px] text-slate-500">
                      revenue {money2(totals.revenue)} − team {money2(totals.associate)} − Kabidul {money2(distribution.kabidulShare)}
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right font-black text-[#00d294] text-sm">{money2(totals.ownerNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {distribution.rows.length === 0 && (
              <div className="p-8 text-center text-[#a7b0c0] text-xs">No payments in this date range.</div>
            )}
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Renewals" icon={RotateCw} accent="#00d294" value={totals.renewals} sub={money(totals.renewalRevenue)} />
            <Kpi label="Members Left" icon={LogOut} accent="#f43f5e" value={totals.membersLeft.toLocaleString()} sub="in range" />
            <Kpi label="Team Commission" icon={Users} accent="#38bdf8" value={money(totals.associate)} sub="5% accrued, owed" />
            <Kpi label="Kabidul Commission" icon={Briefcase} accent="#e39e2e" value={money(totals.kabidul)} sub="25% accrued, owed" />
          </div>
        </>
      )}
    </div>
  );
}
