import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Users, Crown, DollarSign, TrendingUp, RefreshCw, AlertTriangle, ArrowUpRight,
  Flame, Moon, Trophy,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import DataTable from '../data/DataTable';
import FilterBar from '../data/FilterBar';
import { useTableControls } from '../data/useTableControls';
import { exportCsv } from '../data/exportCsv';
import { relTime } from '../data/dates';

// ---------------------------------------------------------------------------
// Command Center → Team Performance Center.
//
// The "team" = the associates (they carry all member attribution). Reads
// team_performance_view + team_growth_view (migration V11). Content-ops
// (dispatch batches, creator voice profiles) has been removed from here.
// ---------------------------------------------------------------------------

const fmtMoney = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function Kpi({ label, value, sub, icon: Icon, accent = '#e39e2e' }) {
  return (
    <div className="glass-card-interactive p-4 sm:p-6 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] sm:text-xs font-bold text-[#a7b0c0] uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border"
          style={{ background: `${accent}20`, borderColor: `${accent}50`, color: accent }}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-black text-white">{value}</div>
      {sub && <div className="text-[11px] text-[#a7b0c0] font-medium">{sub}</div>}
    </div>
  );
}

export default function DashboardView({ issues = [], onNavigateTab }) {
  const [team, setTeam] = useState([]);
  const [growth, setGrowth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [{ data: t }, { data: g }] = await Promise.all([
        supabase.from('team_performance_view').select('*'),
        supabase.from('team_growth_view').select('*').order('month'),
      ]);
      setTeam(t || []);
      setGrowth(g || []);
    } catch (err) {
      console.error('Team Center fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => { fetchData(); }, []);

  const openIssues = issues.filter((i) => i.status === 'OPEN');

  // ── Team totals (all team-attributed, for consistency) ──
  const totals = useMemo(() => {
    const sum = (k) => team.reduce((s, r) => s + Number(r[k] || 0), 0);
    const free = sum('free_joins');
    const vip = sum('vip_conversions');
    const mtdMembers = sum('free_joins_mtd') + sum('vip_conversions_mtd');
    const prevMonth = sum('members_prev_month');
    return {
      free, vip,
      revenue: sum('revenue_driven'),
      owed: sum('commission_owed'),
      mtdMembers,
      mtdRevenue: sum('revenue_mtd'),
      memberDelta: mtdMembers - prevMonth,
      convRate: free + vip ? (100 * vip / (free + vip)).toFixed(1) : '0',
    };
  }, [team]);

  const movers = useMemo(
    () => [...team].filter((r) => r.vip_conversions_7d > 0)
      .sort((a, b) => b.vip_conversions_7d - a.vip_conversions_7d).slice(0, 3),
    [team],
  );
  const quiet = useMemo(
    () => team.filter((r) => r.total_members > 0 && (r.days_since_last_member == null || r.days_since_last_member > 14)),
    [team],
  );

  // ── Leaderboard controls (shared infra) ──
  const tableConfig = useMemo(() => ({
    urlKey: 'team',
    searchPlaceholder: 'Search team member…',
    searchKeys: ['team_member'],
    filters: [
      {
        key: 'activity', type: 'select', label: 'All activity',
        accessor: (r) => (r.active_7d ? 'ACTIVE' : (r.total_members > 0 ? 'QUIET' : 'NONE')),
        options: [
          { value: 'ACTIVE', label: '🔥 Active (7d)' },
          { value: 'QUIET', label: '💤 Quiet' },
          { value: 'NONE', label: '— No members' },
        ],
      },
    ],
    sortAccessors: {
      vip: (r) => Number(r.vip_conversions || 0),
      free: (r) => Number(r.free_joins || 0),
      rate: (r) => Number(r.conversion_rate_pct || 0),
      revenue: (r) => Number(r.revenue_driven || 0),
      owed: (r) => Number(r.commission_owed || 0),
      vip_mtd: (r) => Number(r.vip_conversions_mtd || 0),
      vip_7d: (r) => Number(r.vip_conversions_7d || 0),
      recency: (r) => (r.last_member_at ? new Date(r.last_member_at).getTime() : 0),
    },
    defaultSort: [{ key: 'vip', dir: 'desc' }],
  }), []);
  const controls = useTableControls(tableConfig);
  const rows = useMemo(() => controls.apply(team), [controls, team]);

  const columns = useMemo(() => [
    {
      key: 'rank', header: '#', width: '40px',
      render: (r) => <span className="text-[#a7b0c0] font-mono text-xs">{team.indexOf(r) + 1}</span>,
    },
    {
      key: 'name', header: 'Team Member', sortKey: 'vip', width: '18%',
      csv: (r) => r.team_member,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center font-black text-[#0b0e14] text-xs">
            {r.team_member.substring(0, 2).toUpperCase()}
          </div>
          <div className="font-bold text-white">{r.team_member}</div>
        </div>
      ),
    },
    {
      key: 'free', header: 'Free', sortKey: 'free', align: 'right',
      csv: (r) => r.free_joins, render: (r) => <span className="text-slate-200 font-semibold">{r.free_joins.toLocaleString()}</span>,
    },
    {
      key: 'vip', header: 'VIP', sortKey: 'vip', align: 'right',
      csv: (r) => r.vip_conversions, render: (r) => <span className="text-[#e39e2e] font-bold">{r.vip_conversions}</span>,
    },
    {
      key: 'rate', header: 'Conv %', sortKey: 'rate', align: 'right',
      csv: (r) => r.conversion_rate_pct, render: (r) => <span className="text-slate-300">{r.conversion_rate_pct ?? 0}%</span>,
    },
    {
      key: 'mtd', header: 'This month', sortKey: 'vip_mtd', align: 'right',
      csv: (r) => `${r.free_joins_mtd}f / ${r.vip_conversions_mtd}v / ${r.revenue_mtd}`,
      render: (r) => (
        <div className="text-xs">
          <span className="text-slate-200">{r.free_joins_mtd}f</span>
          <span className="text-[#e39e2e] font-bold"> / {r.vip_conversions_mtd}v</span>
          <div className="text-[10px] text-[#00d294]">{fmtMoney(r.revenue_mtd)}</div>
        </div>
      ),
    },
    {
      key: 'd7', header: 'Last 7d', sortKey: 'vip_7d', align: 'right',
      csv: (r) => `${r.free_joins_7d}f / ${r.vip_conversions_7d}v`,
      render: (r) => (
        <span className="text-xs text-slate-300">{r.free_joins_7d}f
          <span className={r.vip_conversions_7d > 0 ? 'text-[#e39e2e] font-bold' : ''}> / {r.vip_conversions_7d}v</span>
        </span>
      ),
    },
    {
      key: 'recency', header: 'Last member', sortKey: 'recency', align: 'right',
      csv: (r) => r.last_member_at || '',
      render: (r) => {
        const stale = r.days_since_last_member == null || r.days_since_last_member > 7;
        return <span className={`text-xs ${stale ? 'text-slate-500' : 'text-[#00d294]'}`}>{relTime(r.last_member_at)}</span>;
      },
    },
    {
      key: 'revenue', header: 'Revenue driven', sortKey: 'revenue', align: 'right',
      csv: (r) => r.revenue_driven, render: (r) => <span className="text-white font-bold">{fmtMoney(r.revenue_driven)}</span>,
    },
    {
      key: 'comm', header: 'Comm earned / owed', sortKey: 'owed', align: 'right',
      csv: (r) => `${r.commission_earned} / ${r.commission_owed}`,
      render: (r) => (
        <div className="text-xs">
          <span className="text-slate-300">{fmtMoney(r.commission_earned)}</span>
          <div className={`text-[10px] ${Number(r.commission_owed) > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
            owed {fmtMoney(r.commission_owed)}
          </div>
        </div>
      ),
    },
    {
      key: 'status', header: '', align: 'center',
      render: (r) => (r.active_7d
        ? <span title="Active in last 7 days"><Flame className="w-4 h-4 text-[#e39e2e] inline" /></span>
        : r.total_members > 0
          ? <span title={`Quiet — ${r.days_since_last_member ?? '?'}d since last member`}><Moon className="w-4 h-4 text-slate-500 inline" /></span>
          : null),
    },
  ], [team]);

  const goToMembers = (associateId) => {
    // Deep-link Member Intelligence to this associate (its useTableControls reads ?members.*)
    try {
      const sp = new URLSearchParams(window.location.search);
      [...sp.keys()].forEach((k) => k.startsWith('members.') && sp.delete(k));
      sp.set('members.associate_id', associateId);
      window.history.replaceState(null, '', `${window.location.pathname}?${sp.toString()}`);
    } catch { /* ignore */ }
    onNavigateTab?.('members');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="glass-panel p-4 sm:p-8 bg-gradient-to-r from-[#121720] via-[#090c10] to-[#121720] border border-[#e39e2e]/30 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-[#e39e2e]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <span className="badge badge-gold font-mono text-[10px] sm:text-xs">Team Performance Center</span>
            <h2 className="text-xl sm:text-3xl font-black text-[#eaf2ff] tracking-tight uppercase">Yaga Calls Team Center</h2>
            <p className="text-xs sm:text-sm text-[#a7b0c0] max-w-3xl leading-relaxed">
              Member acquisition performance across <span className="text-white font-bold">{team.filter((t) => t.total_members > 0).length} active team members</span> —
              free joins, VIP conversions, revenue driven, and recent momentum.
            </p>
          </div>
          <button
            onClick={() => { setRefreshing(true); fetchData(); }}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-[#080a0f] hover:bg-[#121722] text-slate-300 border border-white/10 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#e39e2e]' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI band */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        <Kpi label="Total Members" icon={Users} accent="#38bdf8"
          value={(totals.free + totals.vip).toLocaleString()}
          sub={`${totals.free.toLocaleString()} free · ${totals.vip.toLocaleString()} VIP`} />
        <Kpi label="VIP Conversions" icon={Crown} accent="#e39e2e"
          value={totals.vip.toLocaleString()} sub={`${totals.convRate}% of all members`} />
        <Kpi label="Revenue Driven" icon={DollarSign} accent="#00d294"
          value={fmtMoney(totals.revenue)} sub={`${fmtMoney(totals.owed)} commission owed`} />
        <Kpi label="This Month" icon={TrendingUp} accent="#e39e2e"
          value={totals.mtdMembers.toLocaleString()}
          sub={<>
            {fmtMoney(totals.mtdRevenue)} ·{' '}
            <span className={totals.memberDelta >= 0 ? 'text-[#00d294]' : 'text-rose-400'}>
              {totals.memberDelta >= 0 ? '▲' : '▼'} {Math.abs(totals.memberDelta).toLocaleString()} vs last month
            </span>
          </>} />
      </div>

      {/* Growth chart + side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 glass-panel p-4 sm:p-6 space-y-4">
          <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#e39e2e]" /> Monthly Acquisition
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={growth} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" tick={{ fill: '#a7b0c0', fontSize: 10 }} />
                <YAxis tick={{ fill: '#a7b0c0', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f141d', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="free_joins" name="Free joins" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="vip_conversions" name="VIP" fill="#e39e2e" radius={[3, 3, 0, 0]} />
                <Line dataKey="revenue" name="Revenue $" stroke="#00d294" strokeWidth={2} dot={false} yAxisId={0} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          {/* Movers */}
          <div className="glass-panel p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-tight">
              <Trophy className="w-4 h-4 text-[#e39e2e]" /> This Week's Movers
            </h3>
            {movers.length === 0 && <p className="text-xs text-slate-500">No VIP conversions in the last 7 days.</p>}
            {movers.map((m, i) => (
              <div key={m.associate_id} className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-semibold">{i + 1}. {m.team_member}</span>
                <span className="text-[#e39e2e] font-bold">+{m.vip_conversions_7d} VIP</span>
              </div>
            ))}
          </div>
          {/* Quiet */}
          <div className="glass-panel p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-tight">
              <Moon className="w-4 h-4 text-slate-400" /> Gone Quiet (14d+)
            </h3>
            {quiet.length === 0 && <p className="text-xs text-[#00d294]">Everyone's active. 🔥</p>}
            {quiet.map((q) => (
              <div key={q.associate_id} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{q.team_member}</span>
                <span className="text-slate-500">{q.days_since_last_member == null ? 'never' : `${q.days_since_last_member}d ago`}</span>
              </div>
            ))}
          </div>
          {/* Issues carryover */}
          {openIssues.length > 0 && (
            <button onClick={() => onNavigateTab?.('issues')}
              className="w-full glass-panel p-4 flex items-center justify-between text-xs text-rose-400 font-bold hover:bg-rose-500/5 cursor-pointer">
              <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {openIssues.length} open issue{openIssues.length > 1 ? 's' : ''}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#e39e2e]" /> Team Leaderboard
          </h3>
          <button
            onClick={() => exportCsv(rows, columns, 'Team_Performance')}
            className="px-3.5 py-2 rounded-xl bg-[#121722] hover:bg-[#1a2130] text-slate-200 font-bold text-xs border border-[#38bdf8]/40 cursor-pointer"
          >
            Export CSV
          </button>
        </div>
        <FilterBar config={tableConfig} controls={controls} facets={controls.facetCounts(team)} matched={rows.length} total={team.length} />
        <DataTable
          rows={rows}
          columns={columns}
          sort={controls.sort}
          onToggleSort={controls.toggleSort}
          loading={loading}
          estimateRowHeight={60}
          rowKey={(r) => r.associate_id}
          onRowClick={(r) => goToMembers(r.associate_id)}
        />
      </div>
    </div>
  );
}
