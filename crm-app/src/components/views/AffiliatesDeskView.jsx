import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import DataTable from '../data/DataTable';
import FilterBar from '../data/FilterBar';
import { useTableControls } from '../data/useTableControls';
import { exportCsv } from '../data/exportCsv';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function AffiliatesDeskView() {
  const [affiliates, setAffiliates] = useState([]);
  const [payoutLogs, setPayoutLogs] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('ROSTER'); // 'ROSTER' | 'PAYOUT_LOGS'

  const rosterConfig = useMemo(() => ({
    urlKey: 'partners',
    searchPlaceholder: 'Search by handle, name, wallet…',
    searchKeys: ['name', 'id', 'telegram_handle', 'wallet_address', 'invite_link'],
    filters: [
      {
        key: 'partner_type', type: 'multiselect', label: 'Type',
        accessor: (a) => a.partner_type || 'AFFILIATE',
        options: [{ value: 'ASSOCIATE', label: 'Associate' }, { value: 'AFFILIATE', label: 'Affiliate' }],
      },
      {
        key: 'settlement', type: 'select', label: 'All balances',
        accessor: (a) => (Number(a.unpaid_balance || 0) > 0 ? 'OWING' : 'SETTLED'),
        options: [{ value: 'OWING', label: '💰 Owed a payout' }, { value: 'SETTLED', label: '✅ Settled' }],
      },
      {
        key: 'status', type: 'select', label: 'All status',
        accessor: (a) => (a.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE'),
        options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }],
      },
    ],
    sortAccessors: {
      name: (a) => (a.name || '').toLowerCase(),
      free: (a) => Number(a.total_free_joins || 0),
      sales: (a) => Number(a.total_conversions || 0),
      earned: (a) => Number(a.total_earned || 0),
      paid: (a) => Number(a.total_paid || 0),
      unpaid: (a) => Number(a.unpaid_balance || 0),
    },
    defaultSort: [{ key: 'earned', dir: 'desc' }],
  }), []);
  const rosterControls = useTableControls(rosterConfig);

  const logsConfig = useMemo(() => ({
    urlKey: 'payouts',
    searchPlaceholder: 'Search partner, tx hash, notes…',
    searchKeys: ['partner_name', 'partner_id', 'tx_hash', 'notes', 'id'],
    filters: [
      {
        key: 'partner_type', type: 'select', label: 'All types',
        accessor: (l) => l.partner_type || 'AFFILIATE',
        options: [{ value: 'ASSOCIATE', label: 'Associate' }, { value: 'AFFILIATE', label: 'Affiliate' }],
      },
      { key: 'paid_on', type: 'daterange', label: 'Paid', accessor: (l) => l.created_at },
    ],
    sortAccessors: {
      date: (l) => new Date(l.created_at || 0).getTime(),
      amount: (l) => Number(l.amount || 0),
      partner: (l) => (l.partner_name || '').toLowerCase(),
    },
    defaultSort: [{ key: 'date', dir: 'desc' }],
  }), []);
  const logsControls = useTableControls(logsConfig);

  // Modal States
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [payoutForm, setPayoutForm] = useState({ amount: '', currency: 'USDT', txHash: '', notes: '' });


  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 4000);
  };

  useEffect(() => {
    fetchAffiliateData();
  }, []);

  async function fetchAffiliateData() {
    setLoading(true);
    try {
      // Query unified view (associates + affiliates)
      const { data: affData, error: affErr } = await supabase
        .from('all_partners_view')
        .select('*')
        .order('total_earned', { ascending: false });

      // Query immutable payout logs
      const { data: logsData } = await supabase
        .from('payout_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (affErr) console.error('Error fetching partners:', affErr);

      const { data: lbData } = await supabase.from('affiliate_leaderboard_view').select('*').limit(5);

      setAffiliates(affData || []);
      setPayoutLogs(logsData || []);
      setLeaderboard(lbData || []);

    } catch (err) {
      console.error('Database connection error:', err);
    }
    setLoading(false);
  }

  // Handle Process Payout Submission
  const handleProcessPayout = async (e) => {
    e.preventDefault();
    if (!selectedAffiliate || !payoutForm.amount || !payoutForm.txHash) {
      showToast('⚠️ Please fill in all payout details including TxHash.');
      return;
    }

    const payAmount = Number(payoutForm.amount);
    const currentPaid = Number(selectedAffiliate.total_paid || 0);
    const currentUnpaid = Number(selectedAffiliate.unpaid_balance || 0);

    const newPaid = currentPaid + payAmount;
    const newUnpaid = Math.max(0, currentUnpaid - payAmount);

    try {
      // 1. Update Supabase table (associates or affiliates)
      if (selectedAffiliate.partner_type === 'ASSOCIATE' || selectedAffiliate.id.startsWith('ASC-')) {
        const { error: updateError } = await supabase.from('associates').update({ total_paid: newPaid }).eq('id', selectedAffiliate.id);
        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabase.from('affiliates').update({
          total_paid: newPaid,
          unpaid_balance: newUnpaid,
          updated_at: new Date().toISOString()
        }).eq('id', selectedAffiliate.id);
        if (updateError) throw updateError;
      }

      // 2. Insert Immutable Payout Log Entry with Date & Time
      const payId = `PAY-${Date.now()}`;
      const { error: logError } = await supabase.from('payout_logs').insert([{
        id: payId,
        partner_id: selectedAffiliate.id,
        partner_name: selectedAffiliate.name || selectedAffiliate.first_name,
        partner_type: selectedAffiliate.partner_type || 'AFFILIATE',
        amount: payAmount,
        currency: payoutForm.currency,
        tx_hash: payoutForm.txHash,
        notes: payoutForm.notes || 'CRM Admin Execution',
        created_at: new Date().toISOString()
      }]);
      if (logError) throw logError;

      // 3. Trigger Telegram Bot Alert via API
      try {
        await fetch('http://localhost:3005/api/affiliate/payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            affiliateId: selectedAffiliate.id,
            amount: payAmount,
            txHash: payoutForm.txHash
          })
        });
      } catch (botErr) {
        console.warn('Bot payout alert fallback:', botErr.message);
      }

      showToast(`✅ Payout of $${payAmount} ${payoutForm.currency} processed for ${selectedAffiliate.name || selectedAffiliate.telegram_handle}!`);

      setPayoutModalOpen(false);
      setPayoutForm({ amount: '', currency: 'USDT', txHash: '', notes: '' });
      fetchAffiliateData();
    } catch (err) {
      console.error('Payout failed:', err.message);
      showToast(`❌ Error processing payout: ${err.message}`);
    }
  };

  // KPI Computations
  const totalAffiliatesCount = affiliates.length;
  const totalFreeJoineesSum = affiliates.reduce((acc, a) => acc + Number(a.total_free_joins || 0), 0);
  const totalConversionsSum = affiliates.reduce((acc, a) => acc + Number(a.total_conversions || 0), 0);
  const totalPaidSum = affiliates.reduce((acc, a) => acc + Number(a.total_paid || 0), 0);
  const totalUnpaidSum = affiliates.reduce((acc, a) => acc + Number(a.unpaid_balance || 0), 0);

  const filteredAffiliates = useMemo(() => rosterControls.apply(affiliates), [rosterControls, affiliates]);
  const filteredLogs = useMemo(() => logsControls.apply(payoutLogs), [logsControls, payoutLogs]);

  const openPayout = (aff) => {
    setSelectedAffiliate(aff);
    setPayoutForm({
      amount: Number(aff.unpaid_balance || 0) > 0 ? String(aff.unpaid_balance) : '',
      currency: 'USDT', txHash: '', notes: '',
    });
    setPayoutModalOpen(true);
  };

  const rosterColumns = useMemo(() => [
    {
      key: 'partner', header: 'Partner', sortKey: 'name', width: '16%',
      csv: (a) => a.name || a.id,
      render: (a) => (
        <div className="font-sans">
          <div className="font-bold text-white">{a.name || a.id}</div>
          <div className="text-[10px] font-mono text-slate-500">{a.id}</div>
        </div>
      ),
    },
    {
      key: 'type', header: 'Type', csv: (a) => a.partner_type || 'AFFILIATE',
      render: (a) => (
        <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
          a.partner_type === 'ASSOCIATE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
        }`}>{a.partner_type || 'AFFILIATE'}</span>
      ),
    },
    { key: 'handle', header: 'Telegram', csv: (a) => a.telegram_handle || '', render: (a) => <span className="font-bold text-[#e39e2e]">{a.telegram_handle || 'N/A'}</span> },
    {
      key: 'link', header: 'Invite Link', csv: (a) => a.invite_link || '',
      render: (a) => a.invite_link ? (
        <div className="flex items-center gap-1">
          <span className="truncate max-w-[140px] text-slate-300">{a.invite_link}</span>
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(a.invite_link); showToast('📋 Invite link copied!'); }} className="p-1 text-slate-400 hover:text-white" title="Copy">📋</button>
        </div>
      ) : <span className="text-slate-600 italic">Not Generated</span>,
    },
    { key: 'rate', header: 'Rate', csv: (a) => `${a.commission_rate || 15}%`, render: (a) => <span className="font-bold text-emerald-400">{a.commission_rate || 15}%</span> },
    { key: 'free', header: 'Free Joinees', sortKey: 'free', align: 'right', csv: (a) => a.total_free_joins || 0, render: (a) => <span className="font-bold text-slate-200">{Number(a.total_free_joins || 0).toLocaleString()}</span> },
    { key: 'sales', header: 'Sales', sortKey: 'sales', align: 'right', csv: (a) => a.total_conversions || 0, render: (a) => <span className="font-bold text-[#e39e2e]">{a.total_conversions || 0}</span> },
    { key: 'earned', header: 'Total Earned', sortKey: 'earned', align: 'right', csv: (a) => Number(a.total_earned || 0).toFixed(2), render: (a) => <span className="font-bold text-white">{money(a.total_earned)}</span> },
    { key: 'paid', header: 'Total Paid', sortKey: 'paid', align: 'right', csv: (a) => Number(a.total_paid || 0).toFixed(2), render: (a) => <span className="font-bold text-emerald-400">{money(a.total_paid)}</span> },
    { key: 'unpaid', header: 'Unpaid', sortKey: 'unpaid', align: 'right', csv: (a) => Number(a.unpaid_balance || 0).toFixed(2), render: (a) => <span className="font-bold text-[#e39e2e]">{money(a.unpaid_balance)}</span> },
    { key: 'wallet', header: 'Wallet', csv: (a) => a.wallet_address || '' },
    {
      key: 'actions', header: 'Actions', align: 'right',
      render: (a) => (
        <button
          onClick={(e) => { e.stopPropagation(); openPayout(a); }}
          disabled={!(Number(a.unpaid_balance || 0) > 0)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans uppercase transition-all ${
            Number(a.unpaid_balance || 0) > 0 ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >Process Payout</button>
      ),
    },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  const logsColumns = useMemo(() => [
    { key: 'date', header: 'Date (UTC)', sortKey: 'date', csv: (l) => new Date(l.created_at).toISOString(), render: (l) => <span className="font-bold text-slate-300">{new Date(l.created_at).toISOString().replace('T', ' ').substring(0, 19)}</span> },
    { key: 'id', header: 'Payment ID', csv: (l) => l.id, render: (l) => <span className="text-slate-400">{l.id}</span> },
    { key: 'partner', header: 'Partner', sortKey: 'partner', csv: (l) => `${l.partner_name} (${l.partner_id})`, render: (l) => <span className="font-bold text-white font-sans">{l.partner_name} <span className="text-slate-500 text-[10px]">({l.partner_id})</span></span> },
    { key: 'type', header: 'Type', csv: (l) => l.partner_type || 'AFFILIATE', render: (l) => <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{l.partner_type || 'AFFILIATE'}</span> },
    { key: 'amount', header: 'Amount', sortKey: 'amount', align: 'right', csv: (l) => Number(l.amount).toFixed(2), render: (l) => <span className="font-bold text-emerald-400">{money(l.amount)}</span> },
    { key: 'currency', header: 'Currency', csv: (l) => l.currency, render: (l) => <span className="text-amber-400 font-bold">{l.currency}</span> },
    { key: 'tx', header: 'TxHash', csv: (l) => l.tx_hash || '', render: (l) => <span className="font-mono text-slate-300 truncate max-w-[150px] inline-block">{l.tx_hash}</span> },
    { key: 'notes', header: 'Notes', csv: (l) => l.notes || '', render: (l) => <span className="text-slate-400 italic">{l.notes || 'Admin Execution'}</span> },
  ], []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f141d] p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#e39e2e]/20 text-[#e39e2e] border border-[#e39e2e]/30 uppercase">
              100% Performance-Based
            </span>
            <span className="text-xs text-slate-400 font-mono">Supabase Real-Time Pipeline</span>
          </div>
          <h2 className="text-2xl font-black text-white mt-2 tracking-tight uppercase">
            Affiliates &amp; Partner Management Desk
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Track all 11+ partners, monitor Telegram invite conversions, audit earnings transparency, and process crypto payouts with instant Telegram notifications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAffiliateData}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2"
          >
            <span>🔄 Sync Live Data</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#0f141d] p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Partners</div>
          <div className="text-2xl font-black text-white font-mono mt-1">{totalAffiliatesCount}</div>
          <div className="text-[10px] text-emerald-400 mt-1 font-mono">Associates &amp; Affiliates</div>
        </div>

        <div className="bg-[#0f141d] p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Free Group Joinees</div>
          <div className="text-2xl font-black text-white font-mono mt-1">{totalFreeJoineesSum.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">Tracked via Bot Links</div>
        </div>

        <div className="bg-[#0f141d] p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Premium Conversions</div>
          <div className="text-2xl font-black text-white font-mono mt-1">{totalConversionsSum}</div>
          <div className="text-[10px] text-[#e39e2e] mt-1 font-mono">VIP Commission Sales</div>
        </div>

        <div className="bg-[#0f141d] p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Paid Out</div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">${totalPaidSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">Crypto Settlements</div>
        </div>

        <div className="bg-[#0f141d] p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Unpaid Balance</div>
          <div className="text-2xl font-black text-[#e39e2e] font-mono mt-1">${totalUnpaidSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-[10px] text-amber-500 mt-1 font-mono">Pending Partner Payouts</div>
        </div>
      </div>

      {/* Public Leaderboard Display Widget */}
      <div className="bg-[#0f141d] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <h3 className="text-base font-black text-white uppercase tracking-tight">
              Public Website Leaderboard (15% Commission Scale)
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#e39e2e] bg-[#e39e2e]/10 border border-[#e39e2e]/30 px-3 py-1 rounded-full uppercase">
            Live Website Sync
          </span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-2">No leaderboard data available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {leaderboard.map((item, idx) => {
              const badges = ['👑 #1', '🥈 #2', '🥉 #3', '#4', '#5'];
              const borders = ['border-amber-500/40 bg-amber-500/5', 'border-slate-400/40 bg-slate-400/5', 'border-amber-700/40 bg-amber-700/5', 'border-slate-800 bg-slate-900/40', 'border-slate-800 bg-slate-900/40'];
              const displayed = Number(item.public_displayed_earnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              return (
                <div key={item.associate_id || idx} className={`p-3.5 rounded-xl border ${borders[idx] || borders[3]} space-y-1.5`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black font-mono text-[#e39e2e]">{badges[idx]}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.vip_conversions || 0} VIP Sales</span>
                  </div>
                  <div className="text-sm font-black text-white font-mono truncate">{item.anonymized_name}</div>
                  <div className="text-xs font-mono font-bold text-emerald-400 pt-1 border-t border-slate-800/60">
                    ${displayed} <span className="text-[9px] text-slate-500 font-normal">(15% rate)</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Section Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('ROSTER')}
          className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'ROSTER'
              ? 'bg-[#e39e2e] text-slate-950 shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <span>👥 Unified Partner Roster ({filteredAffiliates.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('PAYOUT_LOGS')}
          className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'PAYOUT_LOGS'
              ? 'bg-[#e39e2e] text-slate-950 shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <span>📜 Payout Audit Log ({payoutLogs.length})</span>
        </button>
      </div>

      {activeTab === 'ROSTER' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-white text-sm uppercase tracking-wider">Registered Partners &amp; Performance</h3>
            <button
              onClick={() => exportCsv(filteredAffiliates, rosterColumns, 'Partner_Roster')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-[#38bdf8]/40"
            >Export CSV</button>
          </div>
          <FilterBar
            config={rosterConfig}
            controls={rosterControls}
            facets={rosterControls.facetCounts(affiliates)}
            matched={filteredAffiliates.length}
            total={affiliates.length}
          />
          <DataTable
            rows={filteredAffiliates}
            columns={rosterColumns}
            sort={rosterControls.sort}
            onToggleSort={rosterControls.toggleSort}
            loading={loading}
            estimateRowHeight={60}
            rowKey={(a) => a.id}
            emptyState={<div className="p-12 text-center text-slate-500 text-xs font-mono">No partners match your filters.</div>}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-white text-sm uppercase tracking-wider">Immutable Payout Audit Ledger</h3>
            <button
              onClick={() => exportCsv(filteredLogs, logsColumns, 'Payout_Logs')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-[#38bdf8]/40"
            >Export CSV</button>
          </div>
          <FilterBar
            config={logsConfig}
            controls={logsControls}
            facets={logsControls.facetCounts(payoutLogs)}
            matched={filteredLogs.length}
            total={payoutLogs.length}
          />
          <DataTable
            rows={filteredLogs}
            columns={logsColumns}
            sort={logsControls.sort}
            onToggleSort={logsControls.toggleSort}
            loading={loading}
            estimateRowHeight={56}
            rowKey={(l) => l.id}
            emptyState={<div className="p-12 text-center text-slate-500 text-xs font-mono">No payout logs recorded yet.</div>}
          />
        </div>
      )}

      {/* Process Payout Modal */}
      {payoutModalOpen && selectedAffiliate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#0f141d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">Process Partner Payout</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {selectedAffiliate.name} ({selectedAffiliate.id})
                </p>
              </div>
              <button
                onClick={() => setPayoutModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessPayout} className="space-y-4">
              <div>
                <label htmlFor="affiliatesdeskview-field-1" className="block text-xs font-mono text-slate-400 uppercase mb-1">Payout Amount ($)</label>
                <input id="affiliatesdeskview-field-1"
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={payoutForm.amount}
                  onChange={e => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#e39e2e]"
                />
              </div>

              <div>
                <label htmlFor="affiliatesdeskview-field-2" className="block text-xs font-mono text-slate-400 uppercase mb-1">Settlement Currency</label>
                <select id="affiliatesdeskview-field-2"
                  value={payoutForm.currency}
                  onChange={e => setPayoutForm({ ...payoutForm, currency: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e39e2e]"
                >
                  <option value="USDT">USDT (Tether TRC20/ERC20)</option>
                  <option value="USDC">USDC (USD Coin)</option>
                  <option value="SOL">SOL (Solana)</option>
                  <option value="BTC">BTC (Bitcoin)</option>
                </select>
              </div>

              <div>
                <label htmlFor="affiliatesdeskview-field-3" className="block text-xs font-mono text-slate-400 uppercase mb-1">Blockchain TxHash / Ref</label>
                <input id="affiliatesdeskview-field-3"
                  type="text"
                  required
                  placeholder="Enter transaction hash or reference..."
                  value={payoutForm.txHash}
                  onChange={e => setPayoutForm({ ...payoutForm, txHash: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#e39e2e]"
                />
              </div>

              <div>
                <label htmlFor="affiliatesdeskview-field-4" className="block text-xs font-mono text-slate-400 uppercase mb-1">Admin Notes (Optional)</label>
                <input id="affiliatesdeskview-field-4"
                  type="text"
                  placeholder="Weekly settlement payment..."
                  value={payoutForm.notes}
                  onChange={e => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#e39e2e]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayoutModalOpen(false)}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all"
                >
                  Confirm Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-[#e39e2e] text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-mono flex items-center gap-3 animate-bounce">
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
