import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AffiliatesDeskView() {
  const [affiliates, setAffiliates] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState(null);

  // Modals state
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);

  // Payout Form State
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    currency: 'USDT',
    txHash: '',
    notes: ''
  });

  // Conversion Form State
  const [conversionForm, setConversionForm] = useState({
    affiliateId: '',
    joinedUsername: '',
    planName: 'Quarterly VIP ($299)',
    planAmount: 299,
    commissionRate: 15
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    fetchAffiliateData();
  }, []);

  async function fetchAffiliateData() {
    setLoading(true);
    try {
      const { data: affData, error: affErr } = await supabase.from('affiliates').select('*').order('created_at', { ascending: false });
      const { data: refData, error: refErr } = await supabase.from('affiliate_referrals').select('*').order('created_at', { ascending: false });

      if (affErr) console.error('Error fetching affiliates:', affErr);
      if (refErr) console.error('Error fetching referrals:', refErr);

      setAffiliates(affData || []);
      setReferrals(refData || []);
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
      // Update Supabase
      const { error } = await supabase
        .from('affiliates')
        .update({
          total_paid: newPaid,
          unpaid_balance: newUnpaid,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAffiliate.id);

      if (error) throw error;

      // Update Referral Payout Statuses
      await supabase
        .from('affiliate_referrals')
        .update({
          payout_status: 'PAID',
          payout_txhash: payoutForm.txHash,
          paid_at: new Date().toISOString()
        })
        .eq('affiliate_id', selectedAffiliate.id)
        .eq('payout_status', 'UNPAID');

      showToast(`✅ Payout of $${payAmount} ${payoutForm.currency} processed for ${selectedAffiliate.telegram_handle}!`);

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
    const aff = affiliates.find(a => a.id === conversionForm.affiliateId);
    if (!aff) {
      showToast('⚠️ Please select an affiliate partner.');
      return;
    }

    const commRate = Number(conversionForm.commissionRate || aff.commission_rate || 15);
    const earnedComm = (Number(conversionForm.planAmount) * commRate) / 100;
    const refId = `REF-${Date.now()}`;

    try {
      // Insert Referral detail
      await supabase.from('affiliate_referrals').insert({
        id: refId,
        affiliate_id: aff.id,
        joined_telegram_id: `MANUAL_${Date.now()}`,
        joined_username: conversionForm.joinedUsername || '@member',
        joined_first_name: 'Premium Member',
        status: 'CONVERTED_PREMIUM',
        converted_plan: conversionForm.planName,
        converted_amount: conversionForm.planAmount,
        earned_commission: earnedComm,
        payout_status: 'UNPAID'
      });

      // Update Affiliate balances
      const newConversions = Number(aff.total_conversions || 0) + 1;
      const newTotalEarned = Number(aff.total_earned || 0) + earnedComm;
      const newUnpaid = Number(aff.unpaid_balance || 0) + earnedComm;

      await supabase.from('affiliates').update({
        total_conversions: newConversions,
        total_earned: newTotalEarned,
        unpaid_balance: newUnpaid,
        updated_at: new Date().toISOString()
      }).eq('id', aff.id);

      // Trigger Telegram Bot Notification via API
      try {
        await fetch('http://localhost:3005/api/affiliate/conversion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            affiliateId: aff.id,
            joinedUsername: conversionForm.joinedUsername || '@member',
            planName: conversionForm.planName,
            planAmount: conversionForm.planAmount,
            commissionEarned: earnedComm
          })
        });
      } catch (botErr) {
        console.warn('Bot API alert notify fallback:', botErr.message);
      }

      showToast(`💰 Conversion logged! ${aff.telegram_handle} earned +$${earnedComm.toFixed(2)} USDT (${commRate}%).`);
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
      (aff.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (aff.telegram_handle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (aff.wallet_address || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'ACTIVE') return matchesSearch && aff.status === 'Active';
    if (statusFilter === 'UNPAID') return matchesSearch && Number(aff.unpaid_balance || 0) > 0;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f141d] p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#e39e2e]/20 text-[#e39e2e] border border-[#e39e2e]/30 uppercase">
              100% Performance-Based
            </span>
            <span className="text-xs text-slate-400 font-mono">Telegram Partner Engine</span>
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight mt-2">
            Affiliates &amp; Partner Management Desk
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Track registered partners, monitor live Telegram invite conversions, audit earnings transparency, and process crypto payouts with instant Telegram notifications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setConversionModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider transition-all border border-slate-700 flex items-center gap-2"
          >
            <span>💰 Log Sale Conversion</span>
          </button>
          <button
            onClick={() => fetchAffiliateData()}
            className="px-4 py-2.5 rounded-xl bg-[#e39e2e] hover:bg-[#d49024] text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#e39e2e]/20 flex items-center gap-2"
          >
            <span>🔄 Sync Live Data</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-[#0f141d] border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Affiliates</span>
          <div className="text-2xl font-black text-white font-mono">{totalAffiliatesCount}</div>
          <span className="text-[10px] text-emerald-400">Registered Partners</span>
        </div>
        <div className="p-4 bg-[#0f141d] border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Free Group Joinees</span>
          <div className="text-2xl font-black text-[#e39e2e] font-mono">{totalFreeJoineesSum}</div>
          <span className="text-[10px] text-slate-400">Tracked via Bot Links</span>
        </div>
        <div className="p-4 bg-[#0f141d] border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Premium Conversions</span>
          <div className="text-2xl font-black text-white font-mono">{totalConversionsSum}</div>
          <span className="text-[10px] text-emerald-400">15%–25% Commission Sales</span>
        </div>
        <div className="p-4 bg-[#0f141d] border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Paid Out</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">${totalPaidSum.toFixed(2)}</div>
          <span className="text-[10px] text-slate-400">Crypto Settlements</span>
        </div>
        <div className="p-4 bg-[#0f141d] border border-amber-500/30 rounded-2xl space-y-1 bg-amber-500/5">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Unpaid Balance</span>
          <div className="text-2xl font-black text-amber-400 font-mono">${totalUnpaidSum.toFixed(2)}</div>
          <span className="text-[10px] text-amber-400 font-medium">Pending Partner Payouts</span>
        </div>
      </div>

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
                  <th className="px-6 py-3.5">Partner</th>
                  <th className="px-6 py-3.5">Telegram Handle</th>
                  <th className="px-6 py-3.5">Invite Link</th>
                  <th className="px-6 py-3.5">Rate</th>
                  <th className="px-6 py-3.5">Free Joinees</th>
                  <th className="px-6 py-3.5">Sales</th>
                  <th className="px-6 py-3.5">Total Earned</th>
                  <th className="px-6 py-3.5">Unpaid Balance</th>
                  <th className="px-6 py-3.5">Payout Wallet</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredAffiliates.map(aff => (
                  <tr key={aff.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-white font-sans">
                      {aff.first_name || aff.id}
                      <div className="text-[10px] font-mono font-normal text-slate-500">{aff.id}</div>
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
                    <td className="px-6 py-4 font-bold text-white">{aff.total_conversions || 0}</td>
                    <td className="px-6 py-4 font-bold text-slate-200">${Number(aff.total_earned || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 font-bold text-amber-400">
                      ${Number(aff.unpaid_balance || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      {aff.wallet_address ? (
                        <span className="truncate max-w-[120px] block text-slate-400" title={aff.wallet_address}>
                          {aff.wallet_address.substring(0, 6)}...{aff.wallet_address.substring(aff.wallet_address.length - 4)}
                        </span>
                      ) : (
                        <span className="text-amber-500/70 text-[10px] italic">Not Set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedAffiliate(aff);
                          setPayoutForm(prev => ({ ...prev, amount: String(aff.unpaid_balance || 0) }));
                          setPayoutModalOpen(true);
                        }}
                        disabled={Number(aff.unpaid_balance || 0) <= 0}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all ${
                          Number(aff.unpaid_balance || 0) > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-600 border border-slate-800 cursor-not-allowed'
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
      </div>

      {/* PROCESS PAYOUT MODAL */}
      {payoutModalOpen && selectedAffiliate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f141d] border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-white uppercase text-sm">Process Crypto Payout</h3>
              <button onClick={() => setPayoutModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1 font-mono text-xs">
              <div className="text-slate-400">Partner: <span className="text-white font-bold">{selectedAffiliate.first_name} ({selectedAffiliate.telegram_handle})</span></div>
              <div className="text-slate-400">Unpaid Balance: <span className="text-amber-400 font-bold">${Number(selectedAffiliate.unpaid_balance).toFixed(2)} USDT</span></div>
              <div className="text-slate-400 truncate">Wallet: <span className="text-emerald-400 font-bold">{selectedAffiliate.wallet_address || 'Unset'}</span></div>
            </div>

            <form onSubmit={handleProcessPayout} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Payout Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payoutForm.amount}
                  onChange={e => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#e39e2e]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Currency</label>
                <select
                  value={payoutForm.currency}
                  onChange={e => setPayoutForm({ ...payoutForm, currency: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#e39e2e]"
                >
                  <option value="USDT">USDT (TRC20 / ERC20)</option>
                  <option value="USDC">USDC</option>
                  <option value="SOL">Solana (SOL)</option>
                  <option value="BTC">Bitcoin (BTC)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Blockchain TxHash / Ref ID</label>
                <input
                  type="text"
                  required
                  placeholder="Paste transaction hash..."
                  value={payoutForm.txHash}
                  onChange={e => setPayoutForm({ ...payoutForm, txHash: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#e39e2e]"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPayoutModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase shadow-lg shadow-emerald-500/20"
                >
                  Confirm &amp; Alert Bot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOG MANUAL CONVERSION MODAL */}
      {conversionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f141d] border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-white uppercase text-sm">Log Premium Sale Conversion</h3>
              <button onClick={() => setConversionModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleLogConversion} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Select Affiliate Partner</label>
                <select
                  required
                  value={conversionForm.affiliateId}
                  onChange={e => setConversionForm({ ...conversionForm, affiliateId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#e39e2e]"
                >
                  <option value="">-- Choose Partner --</option>
                  {affiliates.map(a => (
                    <option key={a.id} value={a.id}>{a.first_name} ({a.telegram_handle || a.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Referred Buyer Username</label>
                <input
                  type="text"
                  placeholder="@buyer_username"
                  value={conversionForm.joinedUsername}
                  onChange={e => setConversionForm({ ...conversionForm, joinedUsername: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#e39e2e]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Purchased Plan</label>
                <select
                  value={conversionForm.planName}
                  onChange={e => {
                    const plan = e.target.value;
                    let amt = 299;
                    if (plan.includes('499')) amt = 499;
                    if (plan.includes('799')) amt = 799;
                    setConversionForm({ ...conversionForm, planName: plan, planAmount: amt });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#e39e2e]"
                >
                  <option value="Quarterly VIP ($299)">Quarterly VIP ($299)</option>
                  <option value="Half-Yearly VIP ($499)">Half-Yearly VIP ($499)</option>
                  <option value="Yearly VIP ($799)">Yearly VIP ($799)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConversionModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#e39e2e] hover:bg-[#d49024] text-slate-950 font-black text-xs uppercase shadow-lg shadow-[#e39e2e]/20"
                >
                  Log &amp; Send Telegram Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-[#0f141d] border border-[#e39e2e]/50 shadow-2xl rounded-2xl text-xs font-bold text-white flex items-center gap-3">
          <span>⚡️</span>
          <p>{toastMessage}</p>
        </div>
      )}
    </div>
  );
}
