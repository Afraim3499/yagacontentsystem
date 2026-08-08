import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Crown, 
  Users, 
  Search, 
  Filter, 
  Download, 
  DollarSign, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  Sparkles, 
  Zap, 
  ShieldCheck,
  Edit3,
  UserCheck,
  Calendar,
  X
} from 'lucide-react';

export default function VipMembersDeskView() {
  const [vipMembers, setVipMembers] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssociate, setSelectedAssociate] = useState("ALL");
  const [selectedPackage, setSelectedPackage] = useState("ALL");
  const [selectedSource, setSelectedSource] = useState("ALL");

  // Manual VIP Enroll Modal State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [telegramHandle, setTelegramHandle] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [targetAssociateId, setTargetAssociateId] = useState("");
  const [subscriptionValue, setSubscriptionValue] = useState("700");

  // Edit Tier Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editValue, setEditValue] = useState("700");

  useEffect(() => {
    fetchVipData();
  }, []);

  async function fetchVipData() {
    setLoading(true);
    try {
      // Fetch VIP Members (PAID_VIP or PAID_VIP_PENDING)
      const { data: memData, error: memErr } = await supabase
        .from('community_members_log')
        .select('*')
        .or('member_tier.eq.PAID_VIP,member_tier.eq.PAID_VIP_PENDING')
        .order('created_at', { ascending: false });

      if (memErr) console.error('Error fetching VIP members:', memErr);
      else setVipMembers(memData || []);

      // Fetch Associates
      const { data: ascData, error: ascErr } = await supabase
        .from('associates')
        .select('*')
        .order('name', { ascending: true });

      if (ascErr) console.error('Error fetching associates:', ascErr);
      else setAssociates(ascData || []);

    } catch (err) {
      console.error('fetchVipData exception:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVipData();
  };

  // Filtered VIP Members
  const filteredVips = useMemo(() => {
    return vipMembers.filter(m => {
      // Search
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search || 
        (m.first_name && m.first_name.toLowerCase().includes(search)) ||
        (m.telegram_handle && m.telegram_handle.toLowerCase().includes(search)) ||
        (m.telegram_user_id && m.telegram_user_id.includes(search)) ||
        (m.associate_name && m.associate_name.toLowerCase().includes(search));

      // Associate Filter
      const matchesAssociate = selectedAssociate === "ALL" || m.associate_id === selectedAssociate || (selectedAssociate === "DIRECT" && !m.associate_id);

      // Package Filter
      const val = Number(m.paid_subscription_value || 0);
      let matchesPackage = true;
      if (selectedPackage === "250") matchesPackage = val === 250;
      else if (selectedPackage === "350") matchesPackage = val === 350;
      else if (selectedPackage === "700") matchesPackage = val === 700;
      else if (selectedPackage === "CUSTOM") matchesPackage = val > 0 && val !== 250 && val !== 350 && val !== 700;

      // Source Filter
      const matchesSource = selectedSource === "ALL" || m.enrollment_source === selectedSource;

      return matchesSearch && matchesAssociate && matchesPackage && matchesSource;
    });
  }, [vipMembers, searchTerm, selectedAssociate, selectedPackage, selectedSource]);

  // Overall Stat Calculations
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCommission = 0;
    let manualCount = 0;
    let autoCount = 0;

    vipMembers.forEach(m => {
      const val = Number(m.paid_subscription_value || 0);
      const comm = Number(m.paid_commission || (val * 0.05));
      totalRevenue += val;
      totalCommission += comm;
      if (m.enrollment_source === 'OWNER_MANUAL_ENROLL') manualCount++;
      else autoCount++;
    });

    return {
      totalCount: vipMembers.length,
      totalRevenue,
      totalCommission,
      manualCount,
      autoCount
    };
  }, [vipMembers]);

  // Manual VIP Enroll Handler
  async function handleManualEnroll(e) {
    e.preventDefault();
    if (!memberName) return alert('Please enter member name.');

    const subVal = Number(subscriptionValue) || 700;
    const commVal = Number((subVal * 0.05).toFixed(2));

    const selectedAscObj = associates.find(a => a.id === targetAssociateId);
    const ascName = selectedAscObj ? selectedAscObj.name : 'Unattributed / Direct';

    const userId = telegramUserId ? telegramUserId.trim() : `USR-${Date.now().toString().substring(6)}`;
    const logId = `MEM-${Date.now().toString().substring(5)}`;

    const { error } = await supabase.from('community_members_log').insert([{
      id: logId,
      telegram_user_id: userId,
      telegram_handle: telegramHandle.startsWith('@') ? telegramHandle : (telegramHandle ? `@${telegramHandle}` : ''),
      first_name: memberName.trim(),
      associate_id: targetAssociateId || null,
      associate_name: ascName,
      member_tier: 'PAID_VIP',
      paid_subscription_value: subVal,
      paid_commission: commVal,
      status: 'ACTIVE',
      enrollment_source: 'OWNER_MANUAL_ENROLL',
      paid_group_joined_at: new Date().toISOString(),
      group_name: 'High Table (Paid VIP)',
      group_id: '-1002607815374'
    }]);

    if (error) {
      alert('Error enrolling VIP member: ' + error.message);
    } else {
      alert(`🎉 Successfully Enrolled VIP Member: ${memberName} ($${subVal} Tier)!`);
      setIsEnrollModalOpen(false);
      setMemberName("");
      setTelegramHandle("");
      setTelegramUserId("");
      setTargetAssociateId("");
      fetchVipData();
    }
  }

  // Edit Tier Handler
  async function handleSaveEditTier(e) {
    e.preventDefault();
    if (!editingMember) return;

    const val = Number(editValue) || 0;
    const comm = Number((val * 0.05).toFixed(2));

    const { error } = await supabase.from('community_members_log').update({
      paid_subscription_value: val,
      paid_commission: comm,
      member_tier: 'PAID_VIP',
      status: 'ACTIVE'
    }).eq('id', editingMember.id);

    if (error) {
      alert('Error updating tier: ' + error.message);
    } else {
      alert(`✅ Updated subscription tier for ${editingMember.first_name} to $${val}!`);
      setIsEditModalOpen(false);
      setEditingMember(null);
      fetchVipData();
    }
  }

  // Delete Member Handler
  async function handleDeleteMember(memberId, name) {
    if (!window.confirm(`⚠️ Are you sure you want to delete VIP member "${name}"?`)) return;

    const { error } = await supabase.from('community_members_log').delete().eq('id', memberId);
    if (error) {
      alert('Error deleting member: ' + error.message);
    } else {
      setVipMembers(prev => prev.filter(m => m.id !== memberId));
    }
  }

  // Export CSV Handler
  const exportToCSV = () => {
    if (filteredVips.length === 0) return alert('No VIP data to export.');
    const headers = ["Member Name", "Telegram Handle", "User ID", "Attributed Associate", "Subscription Tier ($)", "5% Commission ($)", "Source", "Date Enrolled"];
    const rows = filteredVips.map(m => [
      `"${m.first_name || 'Member'}"`,
      `"${m.telegram_handle || '-'}"`,
      `"${m.telegram_user_id || '-'}"`,
      `"${m.associate_name || 'Direct'}"`,
      m.paid_subscription_value || 0,
      m.paid_commission || 0,
      m.enrollment_source || 'AUTO_JOIN_REQUEST',
      `"${new Date(m.paid_group_joined_at || m.created_at).toLocaleDateString()}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `VIP_Members_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-slate-900 border border-amber-500/20 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-xl shadow-lg shadow-amber-500/20 text-slate-950">
            <Crown className="w-8 h-8 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">High Table VIP Roster</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Paid Members Only
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Manage High Table VIP Subscribers, track 5% Associate Commissions, and enroll legacy members.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl border border-slate-700/50 transition-all shadow-sm"
            title="Refresh VIP Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm border border-slate-700/60 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsEnrollModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Enroll VIP Member</span>
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Total VIP Members</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats.totalCount}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> High Table Subscribers
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Total VIP Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">${stats.totalRevenue.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Gross VIP Subscriptions</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Paid 5% Commission</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">${stats.totalCommission.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Allocated to Associates</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Enrollment Sources</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-400">{stats.autoCount}</span>
            <span className="text-xs text-slate-400">Auto</span>
            <span className="text-slate-600">/</span>
            <span className="text-lg font-semibold text-purple-400">{stats.manualCount}</span>
            <span className="text-xs text-slate-400">Manual</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Auto Request vs Owner Enrolled</div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl shadow-lg space-y-3 md:space-y-0 md:flex md:items-center md:justify-between gap-4 backdrop-blur-md">
        {/* Search Box */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search member name, @handle, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-amber-500/50 text-slate-200 text-sm pl-10 pr-4 py-2 rounded-xl focus:outline-none transition-all placeholder:text-slate-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Associate Filter */}
          <select
            value={selectedAssociate}
            onChange={(e) => setSelectedAssociate(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500/50"
          >
            <option value="ALL">All Associates</option>
            {associates.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
            <option value="DIRECT">Unattributed / Direct</option>
          </select>

          {/* Package Filter */}
          <select
            value={selectedPackage}
            onChange={(e) => setSelectedPackage(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500/50"
          >
            <option value="ALL">All Tier Packages</option>
            <option value="250">$250 (Quarterly)</option>
            <option value="350">$350 (Half-Yearly)</option>
            <option value="700">$700 (Yearly)</option>
            <option value="CUSTOM">Custom Tier</option>
          </select>

          {/* Source Filter */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500/50"
          >
            <option value="ALL">All Enrollment Sources</option>
            <option value="AUTO_JOIN_REQUEST">Auto Join Request</option>
            <option value="OWNER_MANUAL_ENROLL">Owner Manual Enroll</option>
          </select>
        </div>
      </div>

      {/* Main VIP Roster Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <span className="text-sm">Loading High Table VIP Roster...</span>
          </div>
        ) : filteredVips.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <Crown className="w-10 h-10 text-slate-600 mx-auto stroke-[1.5]" />
            <div className="text-base font-medium text-slate-300">No VIP Members Found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || selectedAssociate !== "ALL" || selectedPackage !== "ALL"
                ? "Try adjusting your search terms or dropdown filters."
                : "Enroll your first VIP member using the button above!"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Member Info</th>
                  <th className="py-3.5 px-4">Referred Associate</th>
                  <th className="py-3.5 px-4">Package Tier</th>
                  <th className="py-3.5 px-4">5% Commission</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Date Enrolled</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredVips.map((m) => {
                  const val = Number(m.paid_subscription_value || 0);
                  const comm = Number(m.paid_commission || (val * 0.05));
                  const isPending = m.member_tier === 'PAID_VIP_PENDING' || m.status === 'PENDING_APPROVAL';

                  return (
                    <tr key={m.id} className="hover:bg-slate-800/30 transition-colors group">
                      {/* Member Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-sm">
                            {m.first_name ? m.first_name.charAt(0).toUpperCase() : 'V'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200 flex items-center gap-2">
                              <span>{m.first_name || 'VIP Member'}</span>
                              {isPending && (
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                  Pending Approval
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              {m.telegram_handle && <span className="text-amber-400/80">{m.telegram_handle}</span>}
                              {m.telegram_user_id && <span className="text-slate-600 font-mono text-[10px]">ID: {m.telegram_user_id}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Attributed Associate */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs font-medium text-slate-300">
                          <Users className="w-3.5 h-3.5 text-amber-400" />
                          <span>{m.associate_name || 'Unattributed / Direct'}</span>
                        </div>
                      </td>

                      {/* Package Tier */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-emerald-400 flex items-center gap-1">
                          <DollarSign className="w-4 h-4 stroke-[2.5]" />
                          <span>{val}</span>
                          <span className="text-xs font-normal text-slate-500">
                            {val === 700 ? '(Yearly)' : val === 350 ? '(Half-Yearly)' : val === 250 ? '(Quarterly)' : '(Custom)'}
                          </span>
                        </div>
                      </td>

                      {/* 5% Commission */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-amber-400 text-xs flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>${comm.toFixed(2)}</span>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        {m.enrollment_source === 'OWNER_MANUAL_ENROLL' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-medium">
                            <UserCheck className="w-3 h-3" /> Manual Owner
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-medium">
                            <Zap className="w-3 h-3" /> Auto Request
                          </span>
                        )}
                      </td>

                      {/* Date Enrolled */}
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(m.paid_group_joined_at || m.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingMember(m);
                              setEditValue(m.paid_subscription_value || "700");
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 rounded-lg transition-colors"
                            title="Edit Tier Value"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteMember(m.id, m.first_name)}
                            className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- MANUAL VIP ENROLLMENT MODAL --- */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-5 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Crown className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-100">Enroll VIP Member</h3>
              </div>
              <button onClick={() => setIsEnrollModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualEnroll} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Member Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Vance"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Telegram Handle
                  </label>
                  <input
                    type="text"
                    placeholder="@username"
                    value={telegramHandle}
                    onChange={(e) => setTelegramHandle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Telegram User ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12345678"
                    value={telegramUserId}
                    onChange={(e) => setTelegramUserId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Attributed Associate
                </label>
                <select
                  value={targetAssociateId}
                  onChange={(e) => setTargetAssociateId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                >
                  <option value="">Unattributed / Direct VIP</option>
                  {associates.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Paid Subscription Package Tier ($) *
                </label>
                <select
                  value={subscriptionValue}
                  onChange={(e) => setSubscriptionValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                >
                  <option value="700">$700 (Yearly - $35 Comm)</option>
                  <option value="350">$350 (Half-Yearly - $17.50 Comm)</option>
                  <option value="250">$250 (Quarterly - $12.50 Comm)</option>
                  <option value="500">$500 (Custom Tier - $25 Comm)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Confirm Enrollment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT TIER VALUE MODAL --- */}
      {isEditModalOpen && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">Edit VIP Tier: {editingMember.first_name}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Subscription Value ($)
                </label>
                <input
                  type="number"
                  required
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  5% Associate Commission will be set to ${(Number(editValue) * 0.05).toFixed(2)}.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
