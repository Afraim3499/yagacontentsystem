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
  Clock,
  AlertTriangle,
  RotateCw,
  Briefcase,
  Gift,
  X,
  Edit
} from 'lucide-react';
import Pagination, { usePagination } from '../Pagination';

export default function VipMembersDeskView() {
  const [vipMembers, setVipMembers] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssociate, setSelectedAssociate] = useState("ALL");
  const [selectedPackage, setSelectedPackage] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL"); // ALL | ACTIVE | EXPIRING_SOON | EXPIRED
  const [sortOrder, setSortOrder] = useState("LATEST"); // LATEST | OLDEST | PKG_DESC | PKG_ASC

  // Manual VIP Enroll Modal State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [telegramHandle, setTelegramHandle] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [targetAssociateId, setTargetAssociateId] = useState("");
  const [subscriptionValue, setSubscriptionValue] = useState("350");
  const [durationMonths, setDurationMonths] = useState("8"); // Default 8 Mos Promo

  // Renew Subscription Modal State
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewingMember, setRenewingMember] = useState(null);
  const [renewTierValue, setRenewTierValue] = useState("350");
  const [renewDurationMonths, setRenewDurationMonths] = useState("8");

  // Edit VIP Member Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editName, setEditName] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [editAssociateId, setEditAssociateId] = useState("");
  const [editSubVal, setEditSubVal] = useState("350");
  const [editDurationMonths, setEditDurationMonths] = useState("8");
  const [editJoinedDate, setEditJoinedDate] = useState("");
  const [editExpirationDate, setEditExpirationDate] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editAssociateComm, setEditAssociateComm] = useState("17.50");
  const [editKabidulComm, setEditKabidulComm] = useState("87.50");

  useEffect(() => {
    fetchVipData();
  }, []);

  async function fetchVipData() {
    setLoading(true);
    try {
      // Page through results instead of a single unbounded .select('*') —
      // Supabase/PostgREST silently caps unranged queries at 1000 rows, so
      // as the VIP roster grows past that, results (and totals computed
      // from them) would be silently truncated with no error shown.
      const PAGE_SIZE = 1000;
      let allMembers = [];
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: page, error: memErr } = await supabase
          .from('community_members_log')
          .select('*')
          .or('member_tier.eq.PAID_VIP,member_tier.eq.PAID_VIP_PENDING')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (memErr) {
          console.error('Error fetching VIP members:', memErr);
          break;
        }
        if (!page || page.length === 0) break;
        allMembers = allMembers.concat(page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setVipMembers(allMembers);

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
    const filtered = vipMembers.filter(m => {
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search || 
        (m.first_name && m.first_name.toLowerCase().includes(search)) ||
        (m.telegram_handle && m.telegram_handle.toLowerCase().includes(search)) ||
        (m.telegram_user_id && m.telegram_user_id.includes(search)) ||
        (m.associate_name && m.associate_name.toLowerCase().includes(search));

      const matchesAssociate = selectedAssociate === "ALL" || m.associate_id === selectedAssociate || (selectedAssociate === "DIRECT" && !m.associate_id);

      const val = Number(m.paid_subscription_value || 0);
      let matchesPackage = true;
      if (selectedPackage === "250") matchesPackage = val === 250;
      else if (selectedPackage === "350") matchesPackage = val === 350;
      else if (selectedPackage === "700") matchesPackage = val === 700;
      else if (selectedPackage === "CUSTOM") matchesPackage = val > 0 && val !== 250 && val !== 350 && val !== 700;

      // Status Filter (ACTIVE | EXPIRING_SOON | EXPIRED)
      const matchesStatus = selectedStatus === "ALL" || (m.subscription_status || 'ACTIVE') === selectedStatus;

      return matchesSearch && matchesAssociate && matchesPackage && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'LATEST') {
        const timeA = new Date(a.paid_group_joined_at || a.created_at);
        const timeB = new Date(b.paid_group_joined_at || b.created_at);
        return timeB - timeA;
      } else if (sortOrder === 'OLDEST') {
        const timeA = new Date(a.paid_group_joined_at || a.created_at);
        const timeB = new Date(b.paid_group_joined_at || b.created_at);
        return timeA - timeB;
      } else if (sortOrder === 'PKG_DESC') {
        return Number(b.paid_subscription_value || 0) - Number(a.paid_subscription_value || 0);
      } else if (sortOrder === 'PKG_ASC') {
        return Number(a.paid_subscription_value || 0) - Number(b.paid_subscription_value || 0);
      }
      return 0;
    });
  }, [vipMembers, searchTerm, selectedAssociate, selectedPackage, selectedStatus, sortOrder]);

  // Bound the DOM to one page of rows at a time — filteredVips can run into
  // the thousands, and rendering all of them into <tr>s at once is a real
  // scroll/perf problem.
  const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages, pageItems: paginatedVips } = usePagination(filteredVips);

  // Overall Stat Calculations
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCommission = 0;
    let totalKabidulCommission = 0;
    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;

    vipMembers.forEach(m => {
      const val = Number(m.paid_subscription_value || 0);
      const comm = Number(m.paid_commission || (val * 0.05));
      const kabComm = Number(m.kabidul_commission || (val * 0.25));
      totalRevenue += val;
      totalCommission += comm;
      totalKabidulCommission += kabComm;

      const st = m.subscription_status || 'ACTIVE';
      if (st === 'EXPIRING_SOON') expiringCount++;
      else if (st === 'EXPIRED') expiredCount++;
      else activeCount++;
    });

    return {
      totalCount: vipMembers.length,
      totalRevenue,
      totalCommission,
      totalKabidulCommission,
      activeCount,
      expiringCount,
      expiredCount
    };
  }, [vipMembers]);

  // Open Edit Modal with pre-filled fields
  const handleOpenEditModal = (m) => {
    setEditingMember(m);
    setEditName(m.first_name || "");
    setEditHandle(m.telegram_handle || "");
    setEditUserId(m.telegram_user_id || "");
    setEditAssociateId(m.associate_id || "");
    const subVal = m.paid_subscription_value || 350;
    setEditSubVal(subVal);
    setEditDurationMonths(m.subscription_duration_months || 8);
    
    // Format dates to YYYY-MM-DD for date inputs
    const joinedIso = m.paid_group_joined_at || m.created_at;
    const joinedStr = joinedIso ? new Date(joinedIso).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    setEditJoinedDate(joinedStr);

    const expIso = m.subscription_expiration_date;
    const expStr = expIso ? new Date(expIso).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    setEditExpirationDate(expStr);

    setEditStatus(m.subscription_status || "ACTIVE");
    setEditAssociateComm(m.paid_commission || (subVal * 0.05).toFixed(2));
    setEditKabidulComm(m.kabidul_commission || (subVal * 0.25).toFixed(2));

    setIsEditModalOpen(true);
  };

  // Helper when Package Sub Value changes in Edit Modal
  const handleEditSubValChange = (val) => {
    setEditSubVal(val);
    const num = Number(val) || 0;
    setEditAssociateComm((num * 0.05).toFixed(2));
    setEditKabidulComm((num * 0.25).toFixed(2));
  };

  // Save Edit Changes Handler
  async function handleSaveMemberEdits(e) {
    e.preventDefault();
    if (!editingMember) return;

    const subVal = Number(editSubVal) || 0;
    const commVal = Number(editAssociateComm) || 0;
    const kabCommVal = Number(editKabidulComm) || 0;
    const months = Number(editDurationMonths) || 6;

    const selectedAscObj = associates.find(a => a.id === editAssociateId);
    const ascName = selectedAscObj ? selectedAscObj.name : 'Unattributed / Direct';

    const joinedDateObj = editJoinedDate ? new Date(`${editJoinedDate}T12:00:00`) : new Date();
    const expDateObj = editExpirationDate ? new Date(`${editExpirationDate}T12:00:00`) : new Date();

    const { error } = await supabase.from('community_members_log').update({
      first_name: editName.trim(),
      telegram_handle: editHandle.startsWith('@') ? editHandle : (editHandle ? `@${editHandle}` : ''),
      telegram_user_id: editUserId.trim(),
      associate_id: editAssociateId || null,
      associate_name: ascName,
      paid_subscription_value: subVal,
      paid_commission: commVal,
      kabidul_commission: kabCommVal,
      subscription_duration_months: months,
      paid_group_joined_at: joinedDateObj.toISOString(),
      subscription_expiration_date: expDateObj.toISOString(),
      subscription_status: editStatus,
      status: editStatus === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE'
    }).eq('id', editingMember.id);

    if (error) {
      alert('Error updating member details: ' + error.message);
    } else {
      alert(`🎉 Successfully updated ${editName || 'Member'}! Details synced live to database & CRM.`);
      setIsEditModalOpen(false);
      setEditingMember(null);
      fetchVipData();
    }
  }

  // Manual VIP Enroll Handler
  async function handleManualEnroll(e) {
    e.preventDefault();
    if (!memberName) return alert('Please enter member name.');

    const subVal = Number(subscriptionValue) || 350;
    const commVal = Number((subVal * 0.05).toFixed(2));
    const kabidulCommVal = Number((subVal * 0.25).toFixed(2));
    const months = Number(durationMonths) || 6;

    const selectedAscObj = associates.find(a => a.id === targetAssociateId);
    const ascName = selectedAscObj ? selectedAscObj.name : 'Unattributed / Direct';

    const userId = telegramUserId ? telegramUserId.trim() : `USR-${Date.now().toString().substring(6)}`;
    const logId = `MEM-${Date.now().toString().substring(5)}`;

    const now = new Date();
    const expDate = new Date(now);
    expDate.setMonth(expDate.getMonth() + months);

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
      kabidul_commission: kabidulCommVal,
      status: 'ACTIVE',
      enrollment_source: 'OWNER_MANUAL_ENROLL',
      paid_group_joined_at: now.toISOString(),
      group_name: 'High Table (Paid VIP)',
      group_id: '-1002607815374',
      subscription_duration_months: months,
      subscription_expiration_date: expDate.toISOString(),
      subscription_status: 'ACTIVE'
    }]);

    if (error) {
      alert('Error enrolling VIP member: ' + error.message);
    } else {
      alert(`🎉 Successfully Enrolled VIP Member: ${memberName} ($${subVal} Tier - ${months} Months)!\n💼 Kabidul's 25% Commission: $${kabidulCommVal}`);
      setIsEnrollModalOpen(false);
      setMemberName("");
      setTelegramHandle("");
      setTelegramUserId("");
      setTargetAssociateId("");
      fetchVipData();
    }
  }

  // Renewal Handler
  async function handleRenewSubscription(e) {
    e.preventDefault();
    if (!renewingMember) return;

    const subVal = Number(renewTierValue) || 350;
    const commVal = Number((subVal * 0.05).toFixed(2));
    const kabidulCommVal = Number((subVal * 0.25).toFixed(2));
    const months = Number(renewDurationMonths) || 6;

    const now = new Date();
    const newExpDate = new Date(now);
    newExpDate.setMonth(newExpDate.getMonth() + months);

    const { error } = await supabase.from('community_members_log').update({
      paid_subscription_value: subVal,
      paid_commission: commVal,
      kabidul_commission: kabidulCommVal,
      subscription_duration_months: months,
      subscription_expiration_date: newExpDate.toISOString(),
      subscription_status: 'ACTIVE',
      status: 'ACTIVE'
    }).eq('id', renewingMember.id);

    if (error) {
      alert('Error renewing subscription: ' + error.message);
    } else {
      alert(`🎉 Renewed ${renewingMember.first_name}'s VIP Subscription for ${months} Months!\n💼 Kabidul's 25% Commission: $${kabidulCommVal}`);
      setIsRenewModalOpen(false);
      setRenewingMember(null);
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
    const headers = ["Member Name", "Telegram Handle", "User ID", "Attributed Associate", "Subscription Tier ($)", "Duration (Months)", "Expiration Date", "Status", "5% Associate Commission ($)", "25% Kabidul Commission ($)", "Date Enrolled"];
    const rows = filteredVips.map(m => [
      `"${m.first_name || 'Member'}"`,
      `"${m.telegram_handle || '-'}"`,
      `"${m.telegram_user_id || '-'}"`,
      `"${m.associate_name || 'Direct'}"`,
      m.paid_subscription_value || 0,
      m.subscription_duration_months || 6,
      `"${m.subscription_expiration_date ? new Date(m.subscription_expiration_date).toLocaleDateString() : '-'}"`,
      m.subscription_status || 'ACTIVE',
      m.paid_commission || 0,
      m.kabidul_commission || ((m.paid_subscription_value || 0) * 0.25),
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
              Manage High Table VIP Subscribers, edit member details live, track subscription durations & expiration dates.
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
            <span className="text-xs font-semibold tracking-wider uppercase">Active Subscribers</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.activeCount}</div>
          <div className="text-xs text-slate-500 mt-1">High Table Active VIPs</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Kabidul's Commission (25%)</span>
            <Briefcase className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">${stats.totalKabidulCommission.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">25% Calculated Management Cut</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Expiring / Expired</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-slate-200">
            <span className="text-amber-400">{stats.expiringCount}</span>
            <span className="text-slate-600 mx-1">/</span>
            <span className="text-red-400">{stats.expiredCount}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Expiring Soon / Expired Members</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Total VIP Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">${stats.totalRevenue.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">5% Associate: ${stats.totalCommission.toLocaleString()}</div>
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
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500/50"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">🟢 Active</option>
            <option value="EXPIRING_SOON">⚠️ Expiring Soon</option>
            <option value="EXPIRED">🔴 Expired</option>
          </select>

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

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500/50"
          >
            <option value="LATEST">📅 Latest Joined</option>
            <option value="OLDEST">📅 Oldest Joined</option>
            <option value="PKG_DESC">💰 Highest to Lowest Package</option>
            <option value="PKG_ASC">💰 Lowest to Highest Package</option>
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
              {searchTerm || selectedAssociate !== "ALL" || selectedPackage !== "ALL" || selectedStatus !== "ALL"
                ? "Try adjusting your search terms or dropdown filters."
                : "Enroll your first VIP member using the button above!"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th scope="col" className="py-3.5 px-4">Member Info</th>
                  <th scope="col" className="py-3.5 px-4">Referred Associate</th>
                  <th scope="col" className="py-3.5 px-4">Package & Duration</th>
                  <th scope="col" className="py-3.5 px-4">Joined & Expiration Date</th>
                  <th scope="col" className="py-3.5 px-4">Status</th>
                  <th scope="col" className="py-3.5 px-4">Commissions (5% / 25%)</th>
                  <th scope="col" className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {paginatedVips.map((m) => {
                  const val = Number(m.paid_subscription_value || 0);
                  const comm = Number(m.paid_commission || (val * 0.05));
                  const kabComm = Number(m.kabidul_commission || (val * 0.25));
                  const durMonths = m.subscription_duration_months || 6;
                  const isPromo = durMonths === 8 || durMonths === 14;

                  const status = m.subscription_status || 'ACTIVE';
                  const expDate = m.subscription_expiration_date ? new Date(m.subscription_expiration_date) : null;

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

                      {/* Package & Duration */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-emerald-400 flex items-center gap-1">
                          <DollarSign className="w-4 h-4 stroke-[2.5]" />
                          <span>{val}</span>
                          <span className="text-xs font-normal text-slate-400 ml-1">
                            ({durMonths} Months {isPromo ? '🎁 Promo' : ''})
                          </span>
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs space-y-0.5">
                          <div className="text-slate-300 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>Joined: {new Date(m.paid_group_joined_at || m.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="text-slate-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Expires: {expDate ? expDate.toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {status === 'EXPIRING_SOON' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" /> Expiring Soon
                          </span>
                        ) : status === 'EXPIRED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold">
                            <Clock className="w-3.5 h-3.5" /> Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        )}
                      </td>

                      {/* Commissions */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs space-y-0.5">
                          <div className="font-medium text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>5% Associate: ${comm.toFixed(2)}</span>
                          </div>
                          <div className="font-semibold text-amber-400 flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            <span>25% Kabidul: ${kabComm.toFixed(2)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEditModal(m)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-lg text-xs font-medium transition-colors"
                            title="Edit VIP Member Details"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Edit
                          </button>

                          <button
                            onClick={() => {
                              setRenewingMember(m);
                              setRenewTierValue(m.paid_subscription_value || "350");
                              setRenewDurationMonths(m.subscription_duration_months || "8");
                              setIsRenewModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-medium transition-colors"
                            title="Renew Subscription"
                          >
                            <RotateCw className="w-3.5 h-3.5" /> Renew
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

      {!loading && filteredVips.length > 0 && (
        <Pagination
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={setItemsPerPage}
          totalCount={filteredVips.length}
          itemLabel="VIP members"
        />
      )}

      {/* --- LIVE EDIT VIP MEMBER MODAL --- */}
      {isEditModalOpen && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Edit VIP Member Details</h3>
                  <p className="text-xs text-slate-500">Update member data live in Supabase DB</p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMemberEdits} className="space-y-4">
              {/* Member Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Member Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

              {/* Handle & User ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Telegram Handle
                  </label>
                  <input
                    type="text"
                    value={editHandle}
                    onChange={(e) => setEditHandle(e.target.value)}
                    placeholder="@username"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Telegram User ID
                  </label>
                  <input
                    type="text"
                    value={editUserId}
                    onChange={(e) => setEditUserId(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Referred Associate */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Referred Associate
                </label>
                <select
                  value={editAssociateId}
                  onChange={(e) => setEditAssociateId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                >
                  <option value="">Unattributed / Direct VIP</option>
                  {associates.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Package Value ($) & Duration (Months) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Package Tier ($)
                  </label>
                  <input
                    type="number"
                    required
                    value={editSubVal}
                    onChange={(e) => handleEditSubValChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-emerald-400 font-semibold text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    required
                    value={editDurationMonths}
                    onChange={(e) => setEditDurationMonths(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Joined Date & Expiration Date Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Joined Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editJoinedDate}
                    onChange={(e) => setEditJoinedDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editExpirationDate}
                    onChange={(e) => setEditExpirationDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-amber-400 font-medium text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Subscription Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-medium"
                >
                  <option value="ACTIVE">🟢 Active</option>
                  <option value="EXPIRING_SOON">⚠️ Expiring Soon (≤ 7 Days)</option>
                  <option value="EXPIRED">🔴 Expired</option>
                </select>
              </div>

              {/* Commissions Breakdown */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    5% Associate Comm ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editAssociateComm}
                    onChange={(e) => setEditAssociateComm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-emerald-400 font-medium text-xs px-3 py-1.5 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    25% Kabidul Comm ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editKabidulComm}
                    onChange={(e) => setEditKabidulComm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-amber-400 font-medium text-xs px-3 py-1.5 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Subscription Tier ($)
                  </label>
                  <select
                    value={subscriptionValue}
                    onChange={(e) => setSubscriptionValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  >
                    <option value="350">$350 (Half-Yearly)</option>
                    <option value="700">$700 (Yearly)</option>
                    <option value="250">$250 (Quarterly)</option>
                    <option value="500">$500 (Custom)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Duration (Months)
                  </label>
                  <select
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-medium"
                  >
                    <option value="8">🎁 8 Months (Promo)</option>
                    <option value="14">🎁 14 Months (Promo)</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>
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

      {/* --- RENEW SUBSCRIPTION MODAL --- */}
      {isRenewModalOpen && renewingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RotateCw className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100">Renew VIP: {renewingMember.first_name}</h3>
              </div>
              <button onClick={() => setIsRenewModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubscription} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Subscription Tier ($)
                  </label>
                  <input
                    type="number"
                    required
                    value={renewTierValue}
                    onChange={(e) => setRenewTierValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Renewal Duration (Months)
                  </label>
                  <select
                    value={renewDurationMonths}
                    onChange={(e) => setRenewDurationMonths(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-medium"
                  >
                    <option value="8">🎁 8 Months (Promo)</option>
                    <option value="14">🎁 14 Months (Promo)</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                This will reset the member's status to 🟢 ACTIVE, calculate Kabidul's 25% commission ($${(Number(renewTierValue) * 0.25).toFixed(2)}), and calculate a new expiration date starting from today.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-semibold text-xs rounded-xl shadow-md"
                >
                  Confirm Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
