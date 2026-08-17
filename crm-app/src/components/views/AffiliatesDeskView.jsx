import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Pagination, { usePagination } from '../Pagination';

export default function AffiliatesDeskView() {
  const [affiliates, setAffiliates] = useState([]);
  const [payoutLogs, setPayoutLogs] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('ROSTER'); // 'ROSTER' | 'PAYOUT_LOGS'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'UNPAID'

  // Modal States
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [payoutForm, setPayoutForm] = useState({ amount: '', currency: 'USDT', txHash: '', notes: '' });

  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [conversionForm, setConversionForm] = useState({
    affiliateId: '',
    joinedUsername: '',
    planName: 'Quarterly VIP ($299)',
    planAmount: 299,
    commissionRate: 15
  });

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

      let allRefs = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: refPage, error: refErr } = await supabase
          .from('affiliate_referrals')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (refErr || !refPage || refPage.length === 0) break;
        allRefs = allRefs.concat(refPage);
        if (refPage.length < pageSize) break;
        page++;
      }

      if (affErr) console.error('Error fetching partners:', affErr);

      const { data: lbData } = await supabase.from('affiliate_leaderboard_view').select('*').limit(5);

      setAffiliates(affData || []);
      setPayoutLogs(logsData || []);
      setReferrals(allRefs);
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

  // Handle Manual Conversion Recording
  const handleLogConversion = async (e) => {
    e.preventDefault();
    if (!conversionForm.affiliateId || !conversionForm.planAmount) {
      showToast('⚠️ Please select a partner and enter sale details.');
      return;
    }

    const aff = affiliates.find(a => a.id === conversionForm.affiliateId);
    if (!aff) return;

    const planAmt = Number(conversionForm.planAmount);
    const commRate = Number(conversionForm.commissionRate || 15);
    const earnedComm = (planAmt * commRate) / 100;

    try {
      const newConversions = (aff.total_conversions || 0) + 1;
      const newTotalEarned = (aff.total_earned || 0) + earnedComm;
      const newUnpaid = (aff.unpaid_balance || 0) + earnedComm;

      const { error: conversionError } = await supabase.from('affiliates').update({
        total_conversions: newConversions,
        total_earned: newTotalEarned,
        unpaid_balance: newUnpaid,
        updated_at: new Date().toISOString()
      }).eq('id', aff.id);
      if (conversionError) throw conversionError;

      try {
        await fetch('http://localhost:3005/api/affiliate/conversion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            affiliateId: aff.id,
            joinedUsername: conversionForm.joinedUsername || '@member',
            planName: conversionForm.planName,
            planAmount: planAmt,
            commissionEarned: earnedComm
          })
        });
      } catch (botErr) {
        console.warn('Bot API alert fallback:', botErr.message);
      }

      showToast(`💰 Conversion logged! ${aff.name} earned +$${earnedComm.toFixed(2)} USDT (${commRate}%).`);
      setConversionModalOpen(false);
      setConversionForm({ affiliateId: '', joinedUsername: '', planName: 'Quarterly VIP ($299)', planAmount: 299, commissionRate: 15 });
      fetchAffiliateData();
    } catch (err) {
      console.error('Log conversion error:', err.message);
      showToast(`❌ Error logging conversion: ${err.message}`);
    }
  };

  // KPI Computations
  const totalAffiliatesCount = affiliates.length;
  const totalFreeJoineesSum = affiliates.reduce((acc, a) => acc + Number(a.total_free_joins || 0), 0);
  const totalConversionsSum = affiliates.reduce((acc, a) => acc + Number(a.total_conversions || 0), 0);
  const totalPaidSum = affiliates.reduce((acc, a) => acc + Number(a.total_paid || 0), 0);
  const totalUnpaidSum = affiliates.reduce((acc, a) => acc + Number(a.unpaid_balance || 0), 0);

  // Filtered Affiliates List
  const filteredAffiliates = affiliates.filter(aff => {
    const matchesSearch = 
      (aff.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (aff.telegram_handle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (aff.wallet_address || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'ACTIVE') return matchesSearch && aff.status !== 'Inactive';
    if (statusFilter === 'UNPAID') return matchesSearch && Number(aff.unpaid_balance || 0) > 0;
    return matchesSearch;
  });

  // Bound the DOM to one page of rows at a time instead of rendering every
  // filtered partner at once.
  const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages, pageItems: paginatedAffiliates } = usePagination(filteredAffiliates);
  const {
    currentPage: logsPage,
    setCurrentPage: setLogsPage,
    itemsPerPage: logsPerPage,
    setItemsPerPage: setLogsPerPage,
    totalPages: logsTotalPages,
    pageItems: paginatedPayoutLogs,
  } = usePagination(payoutLogs);

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
            onClick={() => setConversionModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-[#e39e2e] hover:from-amber-600 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <span>💰 Log Sale Conversion</span>
          </button>
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
        <>
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0f141d] p-4 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search by handle, name, wallet..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#e39e2e]"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {['ALL', 'ACTIVE', 'UNPAID'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                    statusFilter === tab
                      ? 'bg-[#e39e2e] text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Affiliates Master Table */}
          <div className="bg-[#0f141d] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-white text-sm uppercase tracking-wider">Registered Affiliates &amp; Performance Records</h3>
              <span className="text-xs text-slate-400 font-mono">Showing {filteredAffiliates.length} partners</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-mono">Loading affiliate records...</div>
            ) : filteredAffiliates.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs font-mono">No affiliate records match your filter criteria.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th scope="col" className="px-6 py-3.5">Partner</th>
                      <th scope="col" className="px-6 py-3.5">Type</th>
                      <th scope="col" className="px-6 py-3.5">Telegram Handle</th>
                      <th scope="col" className="px-6 py-3.5">Invite Link</th>
                      <th scope="col" className="px-6 py-3.5">Rate</th>
                      <th scope="col" className="px-6 py-3.5">Free Joinees</th>
                      <th scope="col" className="px-6 py-3.5">Sales</th>
                      <th scope="col" className="px-6 py-3.5">Total Earned</th>
                      <th scope="col" className="px-6 py-3.5">Total Paid</th>
                      <th scope="col" className="px-6 py-3.5">Unpaid Balance</th>
                      <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {paginatedAffiliates.map(aff => (
                      <tr key={aff.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-bold text-white font-sans">
                          {aff.name || aff.id}
                          <div className="text-[10px] font-mono font-normal text-slate-500">{aff.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                            aff.partner_type === 'ASSOCIATE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {aff.partner_type || 'AFFILIATE'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-[#e39e2e]">{aff.telegram_handle || 'N/A'}</td>
                        <td className="px-6 py-4">
                          {aff.invite_link ? (
                            <div className="flex items-center gap-1">
                              <span className="truncate max-w-[140px] text-slate-300">{aff.invite_link}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(aff.invite_link);
                                  showToast('📋 Invite link copied to clipboard!');
                                }}
                                className="p-1 text-slate-400 hover:text-white"
                                title="Copy link"
                              >
                                📋
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 italic">Not Generated</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-400">{aff.commission_rate || 15}%</td>
                        <td className="px-6 py-4 font-bold text-slate-200">{aff.total_free_joins || 0}</td>
                        <td className="px-6 py-4 font-bold text-[#e39e2e]">{aff.total_conversions || 0}</td>
                        <td className="px-6 py-4 font-bold text-white">${Number(aff.total_earned || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 font-bold text-emerald-400">${Number(aff.total_paid || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 font-bold text-[#e39e2e]">
                          ${Number(aff.unpaid_balance || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedAffiliate(aff);
                              setPayoutForm({
                                amount: Number(aff.unpaid_balance || 0) > 0 ? String(aff.unpaid_balance) : '',
                                currency: 'USDT',
                                txHash: '',
                                notes: ''
                              });
                              setPayoutModalOpen(true);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans uppercase transition-all ${
                              Number(aff.unpaid_balance || 0) > 0
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            Process Payout
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredAffiliates.length > 0 && (
              <Pagination
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                setItemsPerPage={setItemsPerPage}
                totalCount={filteredAffiliates.length}
                itemLabel="partners"
              />
            )}
          </div>
        </>
      ) : (
        /* Payout Audit Log Table */
        <div className="bg-[#0f141d] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-white text-sm uppercase tracking-wider">Immutable Payout Transaction Audit Ledger</h3>
            <span className="text-xs text-slate-400 font-mono">Total {payoutLogs.length} Transactions</span>
          </div>

          {payoutLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs font-mono">No payout logs recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Date &amp; Time (UTC)</th>
                    <th scope="col" className="px-6 py-3.5">Payment ID</th>
                    <th scope="col" className="px-6 py-3.5">Partner Name</th>
                    <th scope="col" className="px-6 py-3.5">Type</th>
                    <th scope="col" className="px-6 py-3.5">Amount Paid</th>
                    <th scope="col" className="px-6 py-3.5">Currency</th>
                    <th scope="col" className="px-6 py-3.5">Blockchain TxHash</th>
                    <th scope="col" className="px-6 py-3.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {paginatedPayoutLogs.map(log => {
                    const dateStr = new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
                    return (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-300">{dateStr}</td>
                        <td className="px-6 py-4 text-slate-400">{log.id}</td>
                        <td className="px-6 py-4 font-bold text-white font-sans">{log.partner_name} ({log.partner_id})</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {log.partner_type || 'AFFILIATE'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-400">${Number(log.amount).toFixed(2)}</td>
                        <td className="px-6 py-4 text-amber-400 font-bold">{log.currency}</td>
                        <td className="px-6 py-4 font-mono text-slate-300">
                          <span className="truncate max-w-[150px] inline-block">{log.tx_hash}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 italic">{log.notes || 'Admin Execution'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {payoutLogs.length > 0 && (
            <Pagination
              currentPage={logsPage}
              setCurrentPage={setLogsPage}
              totalPages={logsTotalPages}
              itemsPerPage={logsPerPage}
              setItemsPerPage={setLogsPerPage}
              totalCount={payoutLogs.length}
              itemLabel="transactions"
            />
          )}
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
