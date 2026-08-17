import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { supabase } from '../../lib/supabase';
import { 
  Users, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Link as LinkIcon, 
  DollarSign, 
  CheckCircle2, 
  UserX, 
  Plus, 
  Trash2, 
  Crown, 
  ExternalLink,
  RefreshCw,
  Loader2,
  Clock,
  ShieldCheck,
  Zap,
  Sparkles,
  Edit3,
  Check,
  X,
  Tag,
  Settings
} from 'lucide-react';
import { useConfirm } from '../ConfirmDialogProvider';
import { SkeletonTableRows } from '../Skeleton';

export default function MemberTrackingDeskView() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState("MEMBERS_LOG"); // MEMBERS_LOG | ASSOCIATES_VAULT | SETTINGS_VAULT
  const [membersLog, setMembersLog] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [packages, setPackages] = useState([]);
  const [commissionRules, setCommissionRules] = useState({ free_rate_per_100: 30.00, paid_commission_pct: 5.00 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssociate, setSelectedAssociate] = useState("ALL");
  const [selectedTier, setSelectedTier] = useState("ALL"); // ALL | FREE_ONLY | PAID_VIP
  const [selectedMonth, setSelectedMonth] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("LATEST"); // LATEST | OLDEST | PKG_DESC | PKG_ASC

  // New Associate Modal State
  const [isAddAssociateModalOpen, setIsAddAssociateModalOpen] = useState(false);
  const [newAscName, setNewAscName] = useState("");
  const [newAscChatId, setNewAscChatId] = useState("");
  const [newAscInviteLink, setNewAscInviteLink] = useState("");

  // Edit Associate Modal State
  const [isEditAssociateModalOpen, setIsEditAssociateModalOpen] = useState(false);
  const [editingAsc, setEditingAsc] = useState(null);
  const [editAscName, setEditAscName] = useState("");
  const [editAscChatId, setEditAscChatId] = useState("");
  const [editAscInviteLink, setEditAscInviteLink] = useState("");
  const [editAscFreeRate, setEditAscFreeRate] = useState("0.30");
  const [editAscPaidPct, setEditAscPaidPct] = useState("5.00");
  const [editAscStatus, setEditAscStatus] = useState("ACTIVE");

  // VIP Upgrade Modal State
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [selectedMemberForVip, setSelectedMemberForVip] = useState(null);
  const [selectedPkgId, setSelectedPkgId] = useState("");
  const [customVipValue, setCustomVipValue] = useState("");

  // New Package Modal State
  const [isAddPkgModalOpen, setIsAddPkgModalOpen] = useState(false);
  const [newPkgName, setNewPkgName] = useState("");
  const [newPkgDuration, setNewPkgDuration] = useState("3");
  const [newPkgPrice, setNewPkgPrice] = useState("200.00");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 4000);
  };

  // Table body scroll container, used by the row virtualizer set up below
  // (near filteredLog) — declared up top so hooks stay in one place.
  const memberTableScrollRef = useRef(null);

  // Fetch Data from Supabase concurrently across ranges
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: ascData, error: ascError } = await supabase.from('associates').select('*').order('created_at', { ascending: false });
      if (ascError) throw ascError;
      setAssociates(ascData || []);

      // Page through community_members_log sequentially instead of a fixed
      // set of parallel .range() calls — the old approach silently dropped
      // every row past 5,000 with no error surfaced. This keeps fetching
      // until a page comes back short (or empty), so it's correct at any
      // table size, and stops as soon as there's nothing left to load.
      const PAGE_SIZE = 1000;
      let allMembers = [];
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: page, error: pageError } = await supabase
          .from('community_members_log')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (pageError) throw pageError;
        if (!page || page.length === 0) break;
        allMembers = allMembers.concat(page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setMembersLog(allMembers);

      const { data: pkgData, error: pkgError } = await supabase.from('vip_packages').select('*').order('price', { ascending: true });
      if (pkgError) throw pkgError;
      setPackages(pkgData || []);

      const { data: ruleData, error: ruleError } = await supabase.from('commission_rules').select('*').eq('id', 'RULE-DEFAULT').single();
      if (ruleError && ruleError.code !== 'PGRST116') throw ruleError; // PGRST116 = no row found, fall back to defaults
      if (ruleData) setCommissionRules(ruleData);
    } catch (err) {
      console.error('Error fetching member tracking data:', err);
      showToast(`❌ Failed to load member data: ${err.message || err}`, true);
    }
    setLoading(false);
    setRefreshing(false);
  };


  useEffect(() => {
    fetchData();

    // Supabase Real-time Subscriptions
    const memSub = supabase
      .channel('community_members_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_members_log' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(memSub); };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Add New Associate
  const handleAddAssociate = async (e) => {
    e.preventDefault();
    if (!newAscName.trim() || !newAscInviteLink.trim()) return;
    setSaving(true);

    const ascId = `ASC-${Date.now().toString().substring(7)}`;
    try {
      const { error } = await supabase.from('associates').insert({
        id: ascId,
        name: newAscName.trim(),
        telegram_chat_id: newAscChatId.trim() || null,
        unique_invite_link: newAscInviteLink.trim(),
        free_commission_rate: (Number(commissionRules.free_rate_per_100) / 100) || 0.30,
        paid_commission_pct: Number(commissionRules.paid_commission_pct) || 5.00,
        status: 'ACTIVE'
      });
      if (error) throw error;

      await fetchData();
      setNewAscName("");
      setNewAscChatId("");
      setNewAscInviteLink("");
      setIsAddAssociateModalOpen(false);
      showToast('✅ Associate added.');
    } catch (err) {
      console.error('Add associate error:', err);
      showToast(`❌ Failed to add associate: ${err.message || err}`, true);
    }
    setSaving(false);
  };

  // Open Edit Associate Modal
  const handleOpenEditAssociate = (asc) => {
    setEditingAsc(asc);
    setEditAscName(asc.name || "");
    setEditAscChatId(asc.telegram_chat_id || "");
    setEditAscInviteLink(asc.unique_invite_link || "");
    setEditAscFreeRate(asc.free_commission_rate || "0.30");
    setEditAscPaidPct(asc.paid_commission_pct || "5.00");
    setEditAscStatus(asc.status || "ACTIVE");
    setIsEditAssociateModalOpen(true);
  };

  // Save Associate Edits
  const handleSaveAssociateEdit = async (e) => {
    e.preventDefault();
    if (!editingAsc || !editAscName.trim() || !editAscInviteLink.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('associates').update({
        name: editAscName.trim(),
        telegram_chat_id: editAscChatId.trim() || null,
        unique_invite_link: editAscInviteLink.trim(),
        free_commission_rate: parseFloat(editAscFreeRate) || 0.30,
        paid_commission_pct: parseFloat(editAscPaidPct) || 5.00,
        status: editAscStatus
      }).eq('id', editingAsc.id);
      if (error) throw error;

      await fetchData();
      setIsEditAssociateModalOpen(false);
      setEditingAsc(null);
      showToast('✅ Associate updated.');
    } catch (err) {
      console.error('Error updating associate:', err);
      showToast(`❌ Failed to update associate: ${err.message || err}`, true);
    }
    setSaving(false);
  };

  // Add New Package Tier
  const handleAddPackage = async (e) => {
    e.preventDefault();
    if (!newPkgName.trim() || !newPkgPrice) return;
    setSaving(true);

    const pkgId = `PKG-${newPkgName.trim().toUpperCase().replace(/\s+/g, '-')}`;
    try {
      const { error } = await supabase.from('vip_packages').insert({
        id: pkgId,
        name: newPkgName.trim(),
        duration_months: parseInt(newPkgDuration) || 3,
        price: parseFloat(newPkgPrice) || 200.00,
        is_active: true
      });
      if (error) throw error;

      await fetchData();
      setNewPkgName("");
      setNewPkgDuration("3");
      setNewPkgPrice("200.00");
      setIsAddPkgModalOpen(false);
      showToast('✅ Package added.');
    } catch (err) {
      console.error('Add package error:', err);
      showToast(`❌ Failed to add package: ${err.message || err}`, true);
    }
    setSaving(false);
  };

  // Update Package Price / Name
  const handleUpdatePackage = async (pkgId, updatedPrice, updatedName) => {
    try {
      const { error } = await supabase.from('vip_packages').update({
        price: parseFloat(updatedPrice),
        name: updatedName
      }).eq('id', pkgId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Update package error:', err);
      showToast(`❌ Failed to update package: ${err.message || err}`, true);
    }
  };

  // Delete Package
  const handleDeletePackage = async (pkgId) => {
    if (!(await confirm('Delete this VIP package tier?'))) return;
    const { error } = await supabase.from('vip_packages').delete().eq('id', pkgId);
    if (error) {
      console.error('Delete package error:', error);
      showToast(`❌ Failed to delete package: ${error.message}`, true);
      return;
    }
    setPackages(prev => prev.filter(p => p.id !== pkgId));
  };

  // Delete Member Entry
  const handleDeleteMember = async (memberLogId, memberName) => {
    if (!(await confirm(`Are you sure you want to delete member log entry for "${memberName}"?`))) return;
    try {
      const { error } = await supabase.from('community_members_log').delete().eq('id', memberLogId);
      if (error) throw error;
      setMembersLog(prev => prev.filter(m => m.id !== memberLogId));
    } catch (err) {
      console.error('Delete member error:', err);
      showToast(`❌ Failed to delete member: ${err.message || err}`, true);
    }
  };

  // Save Global Commission Rules
  const handleSaveCommissionRules = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('commission_rules').upsert({
        id: 'RULE-DEFAULT',
        free_rate_per_100: parseFloat(commissionRules.free_rate_per_100),
        paid_commission_pct: parseFloat(commissionRules.paid_commission_pct),
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      showToast('✅ Global Commission Rules Saved Successfully!');
    } catch (err) {
      console.error('Error saving rules:', err);
      showToast(`❌ Failed to save commission rules: ${err.message || err}`, true);
    }
    setSaving(false);
  };

  // Process VIP Upgrade Conversion
  const handleProcessVipUpgrade = async (e) => {
    e.preventDefault();
    if (!selectedMemberForVip) return;
    setSaving(true);

    let priceVal = 0;
    let pkgName = "Custom VIP Access";

    if (selectedPkgId === "CUSTOM") {
      priceVal = parseFloat(customVipValue) || 200.00;
    } else {
      const selectedPkg = packages.find(p => p.id === selectedPkgId);
      if (selectedPkg) {
        priceVal = Number(selectedPkg.price);
        pkgName = selectedPkg.name;
      }
    }

    const paidComm = priceVal * (Number(commissionRules.paid_commission_pct) / 100);

    try {
      const { error } = await supabase.from('community_members_log').update({
        member_tier: 'PAID_VIP',
        package_id: selectedPkgId,
        package_name: pkgName,
        paid_subscription_value: priceVal,
        paid_commission: paidComm,
        paid_group_joined_at: new Date().toISOString()
      }).eq('id', selectedMemberForVip.id);
      if (error) throw error;

      await fetchData();
      setIsVipModalOpen(false);
      setSelectedMemberForVip(null);
      showToast('✅ Member upgraded to VIP.');
    } catch (err) {
      console.error('VIP Upgrade error:', err);
      showToast(`❌ Failed to process VIP upgrade: ${err.message || err}`, true);
    }
    setSaving(false);
  };

  // Unique Months for Dropdown Filter
  const availableMonths = useMemo(() => {
    const months = new Set();
    membersLog.forEach(m => {
      const dateStr = m.paid_group_joined_at || m.free_group_joined_at || m.created_at;
      if (dateStr) {
        const d = new Date(dateStr);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthKey);
      }
    });
    return Array.from(months).sort().reverse();
  }, [membersLog]);

  // Filtered Members Log Data
  const filteredLog = useMemo(() => {
    const filtered = membersLog.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        item.telegram_user_id?.toLowerCase().includes(searchLower) ||
        item.telegram_handle?.toLowerCase().includes(searchLower) ||
        item.first_name?.toLowerCase().includes(searchLower) ||
        item.associate_name?.toLowerCase().includes(searchLower);

      const matchesAssociate = selectedAssociate === "ALL" || item.associate_id === selectedAssociate || item.associate_name === selectedAssociate;
      const matchesTier = selectedTier === "ALL" || item.member_tier === selectedTier;
      const dateStr = item.paid_group_joined_at || item.free_group_joined_at || item.created_at;
      const matchesMonth = selectedMonth === "ALL" || (dateStr && dateStr.startsWith(selectedMonth));
      const matchesStatus = selectedStatus === "ALL" || item.status === selectedStatus;

      return matchesSearch && matchesAssociate && matchesTier && matchesMonth && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'LATEST') {
        const timeA = new Date(a.paid_group_joined_at || a.free_group_joined_at || a.created_at);
        const timeB = new Date(b.paid_group_joined_at || b.free_group_joined_at || b.created_at);
        return timeB - timeA;
      } else if (sortOrder === 'OLDEST') {
        const timeA = new Date(a.paid_group_joined_at || a.free_group_joined_at || a.created_at);
        const timeB = new Date(b.paid_group_joined_at || b.free_group_joined_at || b.created_at);
        return timeA - timeB;
      } else if (sortOrder === 'PKG_DESC') {
        return Number(b.paid_subscription_value || 0) - Number(a.paid_subscription_value || 0);
      } else if (sortOrder === 'PKG_ASC') {
        return Number(a.paid_subscription_value || 0) - Number(b.paid_subscription_value || 0);
      }
      return 0;
    });
  }, [membersLog, searchTerm, selectedAssociate, selectedTier, selectedMonth, selectedStatus, sortOrder]);

  // Virtualize the member log table body — same "spacer <tr>" windowing
  // technique used and verified on the VIP Members desk: real
  // <table>/<tr>/<td> markup throughout, dynamic row-height measurement,
  // no position:absolute on table rows. Replaces the old 100-row-per-page
  // pagination bar with a real scroll, since virtualization means every
  // filtered row is always reachable by scrolling instead of paging.
  const memberRowVirtualizer = useVirtualizer({
    count: filteredLog.length,
    getScrollElement: () => memberTableScrollRef.current,
    estimateSize: () => 76,
    overscan: 8,
  });
  const memberVirtualRows = memberRowVirtualizer.getVirtualItems();
  const memberPaddingTop = memberVirtualRows.length > 0 ? memberVirtualRows[0].start : 0;
  const memberPaddingBottom = memberVirtualRows.length > 0
    ? memberRowVirtualizer.getTotalSize() - memberVirtualRows[memberVirtualRows.length - 1].end
    : 0;

  // Summary Metrics Calculations
  const freeMembersCount = membersLog.filter(m => m.member_tier === 'FREE_ONLY' || !m.member_tier).length;
  const paidVipCount = membersLog.filter(m => m.member_tier === 'PAID_VIP').length;
  const totalRevenue = membersLog.reduce((sum, m) => sum + (Number(m.paid_subscription_value) || 0), 0);
  const totalAssociateCommissions = membersLog.reduce((sum, m) => {
    const freeC = Number(m.free_commission) || 0.30;
    const paidC = Number(m.paid_commission) || 0;
    return sum + freeC + paidC;
  }, 0);


  // CSV Export Function
  const exportCSV = () => {
    const headers = ['Log ID', 'Telegram User ID', 'First Name', 'Handle', 'Associate Name', 'Member Tier', 'Package', 'VIP Revenue ($)', 'Free Comm ($)', 'Paid 5% Comm ($)', 'Total Comm ($)', 'Join Timestamp'];
    const rows = filteredLog.map(m => [
      m.id,
      m.telegram_user_id,
      `"${m.first_name || ''}"`,
      `"${m.telegram_handle || ''}"`,
      `"${m.associate_name || ''}"`,
      m.member_tier || 'FREE_ONLY',
      `"${m.package_name || 'Free Group'}"`,
      m.paid_subscription_value || 0,
      m.free_commission || 0.30,
      m.paid_commission || 0,
      (Number(m.free_commission || 0.30) + Number(m.paid_commission || 0)).toFixed(2),
      m.paid_group_joined_at || m.free_group_joined_at || m.created_at
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `community_member_tracking_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Executive Command Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-gold">2-Tier Member & Attribution Desk</span>
            <span className="text-xs text-slate-400 font-mono">Live Real-time Sync Active</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2 uppercase">
            <Users className="w-6 h-6 text-[#e39e2e]" />
            Community Member Intelligence & VIP Conversions
          </h2>
          <p className="text-xs text-slate-400">
            Audit free group joins ($30/100 members), paid VIP group upgrades (5% commission), and associate attribution ledgers.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-[#080a0f] hover:bg-[#121722] text-slate-300 border border-white/10 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#e39e2e]' : ''}`} />
          </button>

          <button
            onClick={exportCSV}
            className="px-4 py-2.5 rounded-xl bg-[#121722] hover:bg-[#1a2130] text-slate-200 font-bold text-xs border border-[#38bdf8]/40 flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Download className="w-4 h-4 text-[#38bdf8]" />
            Export CSV Audit Report
          </button>

          <button
            onClick={() => setIsAddAssociateModalOpen(true)}
            className="grad-button px-4 py-2.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Register Associate & Link
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card-interactive p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Free Group Joins</span>
            <div className="w-8 h-8 rounded-xl bg-[#00d294]/15 border border-[#00d294]/30 flex items-center justify-center text-[#00d294]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{freeMembersCount}</div>
          <p className="text-[11px] text-[#00d294] font-mono">Earned @ ${commissionRules.free_rate_per_100} / 100 members</p>
        </div>

        <div className="glass-card-interactive p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Paid VIP Conversions</span>
            <div className="w-8 h-8 rounded-xl bg-[#e39e2e]/15 border border-[#e39e2e]/30 flex items-center justify-center text-[#e39e2e]">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#e39e2e]">{paidVipCount}</div>
          <p className="text-[11px] text-slate-400 font-mono">Earned @ {commissionRules.paid_commission_pct}% VIP Commission</p>
        </div>

        <div className="glass-card-interactive p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total VIP Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">${totalRevenue.toFixed(2)}</div>
          <p className="text-[11px] text-[#38bdf8] font-mono">Gross Paid Subscriptions</p>
        </div>

        <div className="glass-card-interactive p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Associate Commissions</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400">${totalAssociateCommissions.toFixed(2)}</div>
          <p className="text-[11px] text-slate-400 font-mono">Total Associate Ledger</p>
        </div>
      </div>

      {/* Main View Container */}
      <div className="glass-panel p-6 space-y-6 border border-white/10">
        {/* Tab Switcher */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 bg-[#080a0f] p-1.5 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("MEMBERS_LOG")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "MEMBERS_LOG" ? "bg-[#e39e2e] text-[#0b0e14] shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Member Join & VIP Conversion Log ({filteredLog.length})
            </button>
            <button
              onClick={() => setActiveTab("ASSOCIATES_VAULT")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "ASSOCIATES_VAULT" ? "bg-[#e39e2e] text-[#0b0e14] shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Associates Roster ({associates.length})
            </button>
            <button
              onClick={() => setActiveTab("SETTINGS_VAULT")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "SETTINGS_VAULT" ? "bg-[#e39e2e] text-[#0b0e14] shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Package & Commission Settings Vault
            </button>
          </div>
        </div>

        {/* TAB 1: MEMBERS JOIN & VIP CONVERSION LOG */}
        {activeTab === "MEMBERS_LOG" && (
          <div className="space-y-5">
            {/* Multi-Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-[#080a0f] p-4 rounded-2xl border border-white/10">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Member ID / Name..."
                  className="w-full bg-[#121722] text-slate-100 text-xs pl-9 pr-3 py-2.5 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div>
                <select
                  value={selectedAssociate}
                  onChange={(e) => setSelectedAssociate(e.target.value)}
                  className="w-full bg-[#121722] text-slate-200 text-xs p-2.5 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none cursor-pointer"
                >
                  <option value="ALL">👤 All Associates</option>
                  {associates.map(asc => (
                    <option key={asc.id} value={asc.id}>{asc.name}</option>
                  ))}
                  <option value="Unattributed / Direct">Unattributed / Direct</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="w-full bg-[#121722] text-slate-200 text-xs p-2.5 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none cursor-pointer"
                >
                  <option value="ALL">⚡ All Member Tiers</option>
                  <option value="FREE_ONLY">🆓 Free Group Only</option>
                  <option value="PAID_VIP">💎 Upgraded to Paid VIP</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-[#121722] text-slate-200 text-xs p-2.5 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none cursor-pointer font-mono"
                >
                  <option value="ALL">📅 All Months & Dates</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-[#121722] text-slate-200 text-xs p-2.5 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none cursor-pointer"
                >
                  <option value="ALL">⚡ All Member Status</option>
                  <option value="ACTIVE">✅ Active in Group</option>
                  <option value="LEFT">🔴 Left Group</option>
                </select>
              </div>

              <div>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full bg-[#121722] text-slate-200 text-xs p-2.5 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none cursor-pointer"
                >
                  <option value="LATEST">📅 Latest Joined</option>
                  <option value="OLDEST">📅 Oldest Joined</option>
                  <option value="PKG_DESC">💰 Highest to Lowest Package</option>
                  <option value="PKG_ASC">💰 Lowest to Highest Package</option>
                </select>
              </div>
            </div>

            {/* Data Table */}
            {loading ? (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#080a0f] text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-white/10">
                    <tr>
                      <th scope="col" className="p-3.5">Member ID & Name</th>
                      <th scope="col" className="p-3.5">Associate Attribution</th>
                      <th scope="col" className="p-3.5">Member Tier</th>
                      <th scope="col" className="p-3.5">VIP Package & Revenue ($)</th>
                      <th scope="col" className="p-3.5">Free Comm ($30/100)</th>
                      <th scope="col" className="p-3.5">Paid 5% Comm ($)</th>
                      <th scope="col" className="p-3.5">Joined Timestamps</th>
                      <th scope="col" className="p-3.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    <SkeletonTableRows columns={8} rows={8} cellClassName="p-3.5" />
                  </tbody>
                </table>
              </div>
            ) : filteredLog.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <Users className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-semibold">No member entries found matching filters.</p>
              </div>
            ) : (
              <>
                <div ref={memberTableScrollRef} className="overflow-auto max-h-[70vh] rounded-2xl border border-white/10">

                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="sticky top-0 z-10 bg-[#080a0f] text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-white/10">
                    <tr>
                      <th scope="col" className="p-3.5">Member ID & Name</th>
                      <th scope="col" className="p-3.5">Associate Attribution</th>
                      <th scope="col" className="p-3.5">Member Tier</th>
                      <th scope="col" className="p-3.5">VIP Package & Revenue ($)</th>
                      <th scope="col" className="p-3.5">Free Comm ($30/100)</th>
                      <th scope="col" className="p-3.5">Paid 5% Comm ($)</th>
                      <th scope="col" className="p-3.5">Joined Timestamps</th>
                      <th scope="col" className="p-3.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {memberPaddingTop > 0 && (
                      <tr aria-hidden="true" style={{ height: `${memberPaddingTop}px` }}>
                        <td colSpan={8} style={{ padding: 0, border: 'none' }} />
                      </tr>
                    )}
                    {memberVirtualRows.map((virtualRow) => {
                      const item = filteredLog[virtualRow.index];
                      const totalComm = (Number(item.free_commission || 0.30) + Number(item.paid_commission || 0)).toFixed(2);
                      const isVip = item.member_tier === 'PAID_VIP';

                      return (
                        <tr
                          key={item.id}
                          data-index={virtualRow.index}
                          ref={memberRowVirtualizer.measureElement}
                          className="hover:bg-[#121722] transition-colors"
                        >
                          <td className="p-3.5 font-sans">
                            <div className="font-bold text-white text-xs">{item.first_name || 'Member'}</div>
                            <div className="text-[10px] text-[#38bdf8] font-mono">ID: {item.telegram_user_id} {item.telegram_handle}</div>
                          </td>
                          <td className="p-3.5 font-sans">
                            <span className={`font-bold ${item.associate_id ? 'text-[#00d294]' : 'text-slate-400'}`}>
                              {item.associate_name || 'Unattributed'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {isVip ? (
                              <span className="px-2.5 py-1 rounded text-[10px] font-black bg-gradient-to-r from-[#e39e2e] to-[#d5b895] text-[#0b0e14] uppercase flex items-center gap-1 w-max shadow-md">
                                <Sparkles className="w-3 h-3" /> PAID VIP
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00d294]/15 text-[#00d294] border border-[#00d294]/30 uppercase">
                                FREE ONLY
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-sans">
                            {isVip ? (
                              <div>
                                <div className="font-bold text-white text-xs">{item.package_name || 'VIP Package'}</div>
                                <div className="text-[11px] text-[#e39e2e] font-mono font-bold">${Number(item.paid_subscription_value || 200).toFixed(2)}</div>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">N/A (Free Group)</span>
                            )}
                          </td>
                          <td className="p-3.5 font-bold text-emerald-400">+${Number(item.free_commission || 0.30).toFixed(2)}</td>
                          <td className="p-3.5 font-bold text-[#e39e2e]">
                            {Number(item.paid_commission) > 0 ? `+$${Number(item.paid_commission).toFixed(2)}` : '$0.00'}
                          </td>
                          <td className="p-3.5 text-slate-300 text-[10px]">
                            <div>Free: {item.free_group_joined_at ? new Date(item.free_group_joined_at).toLocaleDateString() : 'N/A'}</div>
                            {item.paid_group_joined_at && <div className="text-[#e39e2e]">VIP: {new Date(item.paid_group_joined_at).toLocaleDateString()}</div>}
                          </td>
                          <td className="p-3.5 flex items-center gap-2">
                            {!isVip && (
                              <button
                                onClick={() => {
                                  setSelectedMemberForVip(item);
                                  setSelectedPkgId(packages[0]?.id || "CUSTOM");
                                  setIsVipModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#e39e2e]/15 hover:bg-[#e39e2e] text-[#e39e2e] hover:text-[#0b0e14] font-bold text-[10px] uppercase border border-[#e39e2e]/40 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Sparkles className="w-3 h-3" /> Upgrade VIP
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteMember(item.id, item.first_name || 'Member')}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1"
                              title="Delete Member Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {memberPaddingBottom > 0 && (
                      <tr aria-hidden="true" style={{ height: `${memberPaddingBottom}px` }}>
                        <td colSpan={8} style={{ padding: 0, border: 'none' }} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-center text-[11px] text-slate-500 font-mono py-2">
                Showing all {filteredLog.length} members — scroll to load more rows
              </p>
            </>
          )}

          </div>
        )}

        {/* TAB 2: ASSOCIATES ROSTER */}
        {activeTab === "ASSOCIATES_VAULT" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Crown className="w-5 h-5 text-[#e39e2e]" />
                  Associates Roster & Unique Link Mapping
                </h3>
                <p className="text-xs text-slate-400">
                  Each associate has a unique prebuilt Telegram invite link. Joins accrue $30/100 free members + 5% on Paid VIP upgrades.
                </p>
              </div>

              <button
                onClick={() => setIsAddAssociateModalOpen(true)}
                className="grad-button px-4 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                + Add New Associate
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {associates.map((asc) => {
                const ascMembers = membersLog.filter(m => m.associate_id === asc.id || m.associate_name === asc.name);
                const freeCount = ascMembers.filter(m => m.member_tier === 'FREE_ONLY' || !m.member_tier).length;
                const paidCount = ascMembers.filter(m => m.member_tier === 'PAID_VIP').length;
                const totalEarned = ascMembers.reduce((sum, m) => sum + (Number(m.free_commission || 0.30) + Number(m.paid_commission || 0)), 0);

                return (
                  <div key={asc.id} className="glass-panel p-6 space-y-4 border border-[#e39e2e]/40 relative overflow-hidden flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center text-[#0b0e14] font-black">
                            {asc.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="badge badge-gold font-mono text-[10px]">{asc.id}</span>
                            <h4 className="text-base font-bold text-white mt-0.5">{asc.name}</h4>
                          </div>
                        </div>
                        <span className="badge badge-emerald text-[10px]">Active</span>
                      </div>

                      <div className="space-y-2 bg-[#080a0f] p-3.5 rounded-xl border border-white/5 text-xs font-mono">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Assigned Prebuilt Invite Link:</span>
                          <span className="text-[#38bdf8] font-bold text-[11px] truncate block" title={asc.unique_invite_link}>
                            {asc.unique_invite_link}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-white/5">
                          <span className="text-slate-400">Free Group Joins:</span>
                          <span className="text-white font-bold">{freeCount} members</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Paid VIP Conversions:</span>
                          <span className="text-[#e39e2e] font-bold">{paidCount} members (5%)</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-white/5">
                          <span className="text-slate-400">Total Earned Balance:</span>
                          <span className="text-emerald-400 font-bold">${totalEarned.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[10px] font-mono">
                          Created: {asc.created_at ? new Date(asc.created_at).toLocaleDateString() : 'Active'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditAssociate(asc)}
                            className="p-1.5 rounded-lg bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20 border border-[#38bdf8]/30 cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: DYNAMIC EDITABLE PACKAGE & COMMISSION SETTINGS VAULT */}
        {activeTab === "SETTINGS_VAULT" && (
          <div className="space-y-6">
            {/* Global Commission Rules Manager */}
            <div className="glass-panel p-6 space-y-4 border border-white/10 bg-[#080a0f]">
              <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#00d294]" />
                Global Commission Rules Manager (Editable)
              </h3>
              <p className="text-xs text-slate-400">
                Change global default commission rates anytime. Edits take effect immediately for all new joins.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                <div className="space-y-1.5">
                  <label htmlFor="membertrackingdeskview-free-rate" className="text-slate-300 font-bold uppercase text-xs block">Free Group Commission ($ per 100 members)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono">$</span>
                    <input
                      id="membertrackingdeskview-free-rate"
                      type="number"
                      step="1.00"
                      value={commissionRules.free_rate_per_100}
                      onChange={(e) => setCommissionRules(prev => ({ ...prev, free_rate_per_100: e.target.value }))}
                      className="bg-[#121722] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#00d294] focus:outline-none font-mono text-sm w-full"
                    />
                    <span className="text-xs text-slate-400">/ 100 members</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="membertrackingdeskview-paid-pct" className="text-slate-300 font-bold uppercase text-xs block">Paid VIP Commission Percentage (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="membertrackingdeskview-paid-pct"
                      type="number"
                      step="0.5"
                      value={commissionRules.paid_commission_pct}
                      onChange={(e) => setCommissionRules(prev => ({ ...prev, paid_commission_pct: e.target.value }))}
                      className="bg-[#121722] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono text-sm w-full"
                    />
                    <span className="text-xs text-[#e39e2e] font-bold">% of VIP Package Value</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveCommissionRules}
                  disabled={saving}
                  className="grad-button px-5 py-2.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Save Commission Rules
                </button>
              </div>
            </div>

            {/* Dynamic Editable VIP Package Tiers Vault */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <Tag className="w-5 h-5 text-[#e39e2e]" />
                    VIP Package Tiers & Price Vault (Editable)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Add or edit package prices anytime. Associate 5% commissions recalculate automatically based on active package prices.
                  </p>
                </div>

                <button
                  onClick={() => setIsAddPkgModalOpen(true)}
                  className="grad-button px-4 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  + Create New Package Tier
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {packages.map((pkg) => {
                  const commAmount = Number(pkg.price) * (Number(commissionRules.paid_commission_pct) / 100);

                  return (
                    <div key={pkg.id} className="glass-panel p-6 space-y-4 border border-white/10 bg-[#0f141d] relative">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="badge badge-gold font-mono text-[10px]">{pkg.id}</span>
                          <h4 className="text-base font-black text-white mt-1">{pkg.name}</h4>
                          <span className="text-xs text-slate-400">{pkg.duration_months} Months Access</span>
                        </div>
                        <button
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2 bg-[#080a0f] p-3.5 rounded-xl border border-white/5 text-xs font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Package Price ($):</span>
                          <input
                            type="number"
                            value={pkg.price}
                            onChange={(e) => handleUpdatePackage(pkg.id, e.target.value, pkg.name)}
                            className="bg-[#121722] text-[#e39e2e] font-black text-sm px-2.5 py-1 rounded border border-white/10 w-28 text-right focus:outline-none"
                          />
                        </div>
                        <div className="flex justify-between pt-1 border-t border-white/5 text-[11px]">
                          <span className="text-slate-400">Associate 5% Bonus:</span>
                          <span className="text-emerald-400 font-bold">${commAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: VIP Upgrade Action */}
      {isVipModalOpen && selectedMemberForVip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 space-y-5 border border-[#e39e2e]/40 bg-[#0f141d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center text-[#0b0e14] font-black">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">Upgrade to Paid VIP</h3>
                  <p className="text-xs text-slate-400">Select package tier for member {selectedMemberForVip.first_name}</p>
                </div>
              </div>
              <button onClick={() => setIsVipModalOpen(false)} className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer">✕ Close</button>
            </div>

            <form onSubmit={handleProcessVipUpgrade} className="space-y-4 text-xs">
              <div className="bg-[#080a0f] p-3 rounded-xl border border-white/10 space-y-1 font-mono text-xs">
                <div className="text-slate-400">Original Referring Associate:</div>
                <div className="text-[#00d294] font-bold text-sm">{selectedMemberForVip.associate_name || 'Unattributed'}</div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="membertrackingdeskview-field-1" className="text-slate-300 font-bold uppercase tracking-wider block">Select VIP Package Tier *</label>
                <select id="membertrackingdeskview-field-1"
                  value={selectedPkgId}
                  onChange={(e) => setSelectedPkgId(e.target.value)}
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-bold"
                >
                  {packages.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ${p.price} (5% Comm = ${(Number(p.price)*0.05).toFixed(2)})</option>
                  ))}
                  <option value="CUSTOM">💎 Custom Deal Amount ($)</option>
                </select>
              </div>

              {selectedPkgId === "CUSTOM" && (
                <div className="space-y-1.5">
                  <label htmlFor="membertrackingdeskview-field-2" className="text-slate-300 font-bold uppercase tracking-wider block">Custom VIP Subscription Price ($) *</label>
                  <input id="membertrackingdeskview-field-2"
                    type="number"
                    required
                    value={customVipValue}
                    onChange={(e) => setCustomVipValue(e.target.value)}
                    placeholder="e.g. 500.00"
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsVipModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="grad-button px-5 py-2.5 rounded-xl font-black shadow-lg cursor-pointer flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Confirm VIP Conversion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create New Package Tier */}
      {isAddPkgModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 space-y-5 border border-[#e39e2e]/40 bg-[#0f141d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center text-[#0b0e14] font-black">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">Create New VIP Package Tier</h3>
                  <p className="text-xs text-slate-400">Add custom package duration and price</p>
                </div>
              </div>
              <button onClick={() => setIsAddPkgModalOpen(false)} className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer">✕ Close</button>
            </div>

            <form onSubmit={handleAddPackage} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="membertrackingdeskview-field-3" className="text-slate-300 font-bold uppercase tracking-wider block">Package Name *</label>
                <input id="membertrackingdeskview-field-3"
                  type="text"
                  required
                  value={newPkgName}
                  onChange={(e) => setNewPkgName(e.target.value)}
                  placeholder="e.g. Lifetime Platinum Access"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="membertrackingdeskview-field-4" className="text-slate-300 font-bold uppercase tracking-wider block">Duration (Months) *</label>
                <input id="membertrackingdeskview-field-4"
                  type="number"
                  required
                  value={newPkgDuration}
                  onChange={(e) => setNewPkgDuration(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="membertrackingdeskview-field-5" className="text-slate-300 font-bold uppercase tracking-wider block">Package Price ($) *</label>
                <input id="membertrackingdeskview-field-5"
                  type="number"
                  step="10.00"
                  required
                  value={newPkgPrice}
                  onChange={(e) => setNewPkgPrice(e.target.value)}
                  placeholder="600.00"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsAddPkgModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="grad-button px-5 py-2.5 rounded-xl font-black shadow-lg cursor-pointer flex items-center gap-2">
                  Create Package Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Associate */}
      {isAddAssociateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 space-y-5 border border-[#e39e2e]/40 bg-[#0f141d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center text-[#0b0e14] font-black">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">Register New Associate</h3>
                  <p className="text-xs text-slate-400">Map Associate to a prebuilt unique Telegram invite URL</p>
                </div>
              </div>
              <button onClick={() => setIsAddAssociateModalOpen(false)} className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer">✕ Close</button>
            </div>

            <form onSubmit={handleAddAssociate} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="membertrackingdeskview-field-6" className="text-slate-300 font-bold uppercase tracking-wider block">Associate Full Name *</label>
                <input id="membertrackingdeskview-field-6"
                  type="text"
                  required
                  value={newAscName}
                  onChange={(e) => setNewAscName(e.target.value)}
                  placeholder="e.g. Associate Alex"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="membertrackingdeskview-field-7" className="text-slate-300 font-bold uppercase tracking-wider block">Assigned Telegram Unique Invite URL *</label>
                <input id="membertrackingdeskview-field-7"
                  type="text"
                  required
                  value={newAscInviteLink}
                  onChange={(e) => setNewAscInviteLink(e.target.value)}
                  placeholder="e.g. https://t.me/+AbCdEfGh123"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="membertrackingdeskview-field-8" className="text-slate-300 font-bold uppercase tracking-wider block">Telegram Chat ID (Optional for Alerts)</label>
                <input id="membertrackingdeskview-field-8"
                  type="text"
                  value={newAscChatId}
                  onChange={(e) => setNewAscChatId(e.target.value)}
                  placeholder="e.g. 987654321"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsAddAssociateModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="grad-button px-5 py-2.5 rounded-xl font-black shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50">
                  Register Associate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Associate */}
      {isEditAssociateModalOpen && editingAsc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 space-y-5 border border-[#38bdf8]/40 bg-[#0f141d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#38bdf8]/20 border border-[#38bdf8]/40 flex items-center justify-center text-[#38bdf8] font-black">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">Edit Associate Profile</h3>
                  <p className="text-xs text-slate-400">Modify details for {editingAsc.id}</p>
                </div>
              </div>
              <button onClick={() => setIsEditAssociateModalOpen(false)} className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer">✕ Close</button>
            </div>

            <form onSubmit={handleSaveAssociateEdit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="membertrackingdeskview-field-9" className="text-slate-300 font-bold uppercase tracking-wider block">Associate Full Name *</label>
                <input id="membertrackingdeskview-field-9"
                  type="text"
                  required
                  value={editAscName}
                  onChange={(e) => setEditAscName(e.target.value)}
                  placeholder="e.g. Associate Alex"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="membertrackingdeskview-field-10" className="text-slate-300 font-bold uppercase tracking-wider block">Assigned Telegram Unique Invite URL *</label>
                <input id="membertrackingdeskview-field-10"
                  type="text"
                  required
                  value={editAscInviteLink}
                  onChange={(e) => setEditAscInviteLink(e.target.value)}
                  placeholder="e.g. https://t.me/+AbCdEfGh123"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="membertrackingdeskview-field-11" className="text-slate-300 font-bold uppercase tracking-wider block">Telegram Chat ID (For Direct Alerts)</label>
                <input id="membertrackingdeskview-field-11"
                  type="text"
                  value={editAscChatId}
                  onChange={(e) => setEditAscChatId(e.target.value)}
                  placeholder="e.g. 987654321"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="membertrackingdeskview-field-12" className="text-slate-300 font-bold uppercase tracking-wider block">Free Comm ($ / member)</label>
                  <input id="membertrackingdeskview-field-12"
                    type="number"
                    step="0.05"
                    value={editAscFreeRate}
                    onChange={(e) => setEditAscFreeRate(e.target.value)}
                    placeholder="0.30"
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="membertrackingdeskview-field-13" className="text-slate-300 font-bold uppercase tracking-wider block">Paid Comm %</label>
                  <input id="membertrackingdeskview-field-13"
                    type="number"
                    step="0.5"
                    value={editAscPaidPct}
                    onChange={(e) => setEditAscPaidPct(e.target.value)}
                    placeholder="5.00"
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsEditAssociateModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="grad-button px-5 py-2.5 rounded-xl font-black shadow-lg cursor-pointer flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Associate Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 border text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-mono flex items-center gap-3 animate-bounce ${
          toast.isError ? 'bg-rose-950 border-rose-500' : 'bg-slate-900 border-[#e39e2e]'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
