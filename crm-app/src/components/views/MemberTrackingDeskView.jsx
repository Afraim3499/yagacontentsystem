import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users,
  Download,
  DollarSign,
  Plus,
  Trash2,
  Crown,
  RefreshCw,
  Loader2,
  Sparkles,
  Edit3,
  Check,
  Tag,
  Settings
} from 'lucide-react';
import { useConfirm } from '../ConfirmDialogProvider';
import DataTable from '../data/DataTable';
import FilterBar from '../data/FilterBar';
import { useTableControls } from '../data/useTableControls';
import { exportCsv } from '../data/exportCsv';
import { fmtDateNice } from '../data/dates';
import { resolveRates, calcCommissions } from '../../lib/commissions';
import { logMemberEvent, recordMemberPayment } from '../../lib/memberLog';
import { useMember360 } from '../member360/Member360Context';

export default function MemberTrackingDeskView() {
  const confirm = useConfirm();
  const { openMember } = useMember360();
  const [activeTab, setActiveTab] = useState("MEMBERS_LOG"); // MEMBERS_LOG | ASSOCIATES_VAULT | SETTINGS_VAULT
  const [membersLog, setMembersLog] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [packages, setPackages] = useState([]);
  const [commissionRules, setCommissionRules] = useState({ free_rate_per_100: 30.00, paid_commission_pct: 5.00 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Filter / sort controls (shared infra) ──
  const tableConfig = useMemo(() => ({
    urlKey: 'members',
    searchPlaceholder: 'Search member ID, name, @handle, associate…',
    searchKeys: ['telegram_user_id', 'telegram_handle', 'first_name', 'associate_name'],
    filters: [
      {
        key: 'associate_id', type: 'multiselect', label: 'Associate', optionsFrom: 'associates',
        accessor: (m) => m.associate_id || 'DIRECT',
      },
      {
        key: 'member_tier', type: 'select', label: 'All tiers',
        accessor: (m) => m.member_tier || 'FREE_ONLY',
        options: [
          { value: 'FREE_ONLY', label: '🆓 Free group only' },
          { value: 'PAID_VIP', label: '💎 Paid VIP' },
          { value: 'PAID_VIP_PENDING', label: '⏳ VIP pending' },
        ],
      },
      {
        key: 'status', type: 'select', label: 'All member status',
        options: [
          { value: 'ACTIVE', label: '✅ Active in group' },
          { value: 'LEFT', label: '🔴 Left group' },
        ],
      },
      { key: 'value', type: 'numberrange', label: 'VIP $', accessor: (m) => Number(m.paid_subscription_value || 0) },
      {
        key: 'joined', type: 'daterange', label: 'Joined',
        accessor: (m) => m.paid_group_joined_at || m.free_group_joined_at || m.created_at,
      },
    ],
    sortAccessors: {
      joined_at: (m) => new Date(m.paid_group_joined_at || m.free_group_joined_at || m.created_at || 0).getTime(),
      value: (m) => Number(m.paid_subscription_value || 0),
      name: (m) => (m.first_name || '').toLowerCase(),
      associate: (m) => (m.associate_name || '').toLowerCase(),
      tier: (m) => (m.member_tier || ''),
    },
    defaultSort: [{ key: 'joined_at', dir: 'desc' }],
  }), []);
  const controls = useTableControls(tableConfig);

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
          .is('deleted_at', null)
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

  // Delete Member Entry — soft delete (record + history retained)
  const handleDeleteMember = async (memberLogId, memberName) => {
    if (!(await confirm(`Remove member log entry for "${memberName}"?\n\nSoft delete — the record and its history are kept.`))) return;
    try {
      const member = membersLog.find(m => m.id === memberLogId);
      const { error } = await supabase.from('community_members_log').update({
        deleted_at: new Date().toISOString(), deleted_by: 'crm', status: 'LEFT'
      }).eq('id', memberLogId);
      if (error) throw error;
      await logMemberEvent({
        memberId: memberLogId, telegramUserId: member?.telegram_user_id, memberName,
        type: 'deleted', source: 'CRM_MEMBER_DESK', note: 'Soft-deleted from member log',
      });
      setMembersLog(prev => prev.filter(m => m.id !== memberLogId));
    } catch (err) {
      console.error('Delete member error:', err);
      showToast(`❌ Failed to remove member: ${err.message || err}`, true);
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

    const rates = resolveRates(
      associates.find(a => a.id === selectedMemberForVip.associate_id),
      commissionRules,
    );
    const { associate_commission: paidComm, kabidul_commission: kabComm, snapshot } =
      calcCommissions(priceVal, rates);
    const now = new Date();

    try {
      const { error } = await supabase.from('community_members_log').update({
        member_tier: 'PAID_VIP',
        package_id: selectedPkgId,
        package_name: pkgName,
        paid_subscription_value: priceVal,
        paid_commission: paidComm,
        kabidul_commission: kabComm,
        paid_group_joined_at: now.toISOString(),
        first_converted_at: now.toISOString(),
        lifetime_value: priceVal
      }).eq('id', selectedMemberForVip.id);
      if (error) throw error;

      const paymentId = await recordMemberPayment({
        memberId: selectedMemberForVip.id, telegramUserId: selectedMemberForVip.telegram_user_id,
        memberName: selectedMemberForVip.first_name, paymentType: 'upgrade', amount: priceVal,
        termStart: now.toISOString(), packageId: selectedPkgId, packageName: pkgName,
        associateId: selectedMemberForVip.associate_id || null, associateName: selectedMemberForVip.associate_name,
        associateCommission: paidComm, kabidulCommission: kabComm, commissionSnapshot: snapshot,
        recordedBy: 'crm', source: 'CRM_MEMBER_DESK',
      });
      await logMemberEvent({
        memberId: selectedMemberForVip.id, telegramUserId: selectedMemberForVip.telegram_user_id,
        memberName: selectedMemberForVip.first_name, type: 'upgraded', source: 'CRM_MEMBER_DESK',
        paymentId, note: `Upgraded to VIP — ${pkgName} ($${priceVal})`,
        detail: { before: { member_tier: selectedMemberForVip.member_tier }, after: { member_tier: 'PAID_VIP', package_name: pkgName, paid_subscription_value: priceVal } },
      });

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

  // Filtered + sorted member log (shared client-side controls)
  const filteredLog = useMemo(() => controls.apply(membersLog), [controls, membersLog]);

  // Summary Metrics Calculations
  const freeMembersCount = membersLog.filter(m => m.member_tier === 'FREE_ONLY' || !m.member_tier).length;
  const paidVipCount = membersLog.filter(m => m.member_tier === 'PAID_VIP').length;
  const totalRevenue = membersLog.reduce((sum, m) => sum + (Number(m.paid_subscription_value) || 0), 0);
  const totalAssociateCommissions = membersLog.reduce((sum, m) => {
    const freeC = Number(m.free_commission) || 0.30;
    const paidC = Number(m.paid_commission) || 0;
    return sum + freeC + paidC;
  }, 0);


  // ── Column config — drives both the table and the CSV export ──
  const memberColumns = useMemo(() => [
    {
      key: 'member', header: 'Member ID & Name', sortKey: 'name', width: '20%',
      csv: (m) => m.first_name || 'Member',
      render: (m) => (
        <div className="font-sans">
          <div className="font-bold text-white text-xs">{m.first_name || 'Member'}</div>
          <div className="text-[10px] text-[#38bdf8] font-mono">ID: {m.telegram_user_id} {m.telegram_handle}</div>
        </div>
      ),
    },
    {
      key: 'associate', header: 'Associate Attribution', sortKey: 'associate',
      csv: (m) => m.associate_name || 'Unattributed',
      render: (m) => (
        <span className={`font-bold font-sans ${m.associate_id ? 'text-[#00d294]' : 'text-slate-400'}`}>
          {m.associate_name || 'Unattributed'}
        </span>
      ),
    },
    {
      key: 'tier', header: 'Member Tier', sortKey: 'tier',
      csv: (m) => m.member_tier || 'FREE_ONLY',
      render: (m) => (m.member_tier === 'PAID_VIP' ? (
        <span className="px-2.5 py-1 rounded text-[10px] font-black bg-gradient-to-r from-[#e39e2e] to-[#d5b895] text-[#0b0e14] uppercase inline-flex items-center gap-1 shadow-md">
          <Sparkles className="w-3 h-3" /> PAID VIP
        </span>
      ) : (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00d294]/15 text-[#00d294] border border-[#00d294]/30 uppercase">
          {(m.member_tier || 'FREE_ONLY').replace('_', ' ')}
        </span>
      )),
    },
    {
      key: 'package', header: 'VIP Package & Revenue ($)', sortKey: 'value',
      csv: (m) => (m.member_tier === 'PAID_VIP' ? Number(m.paid_subscription_value || 0) : ''),
      render: (m) => (m.member_tier === 'PAID_VIP' ? (
        <div className="font-sans">
          <div className="font-bold text-white text-xs">{m.package_name || 'VIP Package'}</div>
          <div className="text-[11px] text-[#e39e2e] font-mono font-bold">${Number(m.paid_subscription_value || 0).toFixed(2)}</div>
        </div>
      ) : <span className="text-slate-500 text-[11px]">N/A (Free Group)</span>),
    },
    {
      key: 'free_comm', header: 'Free Comm ($30/100)',
      csv: (m) => Number(m.free_commission || 0.30).toFixed(2),
      render: (m) => <span className="font-bold text-emerald-400">+${Number(m.free_commission || 0.30).toFixed(2)}</span>,
    },
    {
      key: 'paid_comm', header: 'Paid 5% Comm ($)',
      csv: (m) => Number(m.paid_commission || 0).toFixed(2),
      render: (m) => (
        <span className="font-bold text-[#e39e2e]">
          {Number(m.paid_commission) > 0 ? `+$${Number(m.paid_commission).toFixed(2)}` : '$0.00'}
        </span>
      ),
    },
    {
      key: 'joined', header: 'Joined Timestamps', sortKey: 'joined_at',
      csv: (m) => fmtDateNice(m.paid_group_joined_at || m.free_group_joined_at || m.created_at),
      render: (m) => (
        <div className="text-slate-300 text-[10px]">
          <div>Free: {m.free_group_joined_at ? fmtDateNice(m.free_group_joined_at) : 'N/A'}</div>
          {m.paid_group_joined_at && <div className="text-[#e39e2e]">VIP: {fmtDateNice(m.paid_group_joined_at)}</div>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', csv: (m) => m.status || 'ACTIVE' },
    { key: 'log_id', header: 'Log ID', csv: (m) => m.id },
    {
      key: 'actions', header: 'Action', align: 'right',
      render: (m) => (
        <div className="flex items-center justify-end gap-2">
          {m.member_tier !== 'PAID_VIP' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMemberForVip(m);
                setSelectedPkgId(packages[0]?.id || 'CUSTOM');
                setIsVipModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#e39e2e]/15 hover:bg-[#e39e2e] text-[#e39e2e] hover:text-[#0b0e14] font-bold text-[10px] uppercase border border-[#e39e2e]/40 transition-all cursor-pointer inline-flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Upgrade VIP
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteMember(m.id, m.first_name || 'Member'); }}
            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
            title="Delete Member Entry"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ], [packages]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCSV = () => exportCsv(filteredLog, memberColumns, 'community_member_tracking');

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
            <FilterBar
              config={tableConfig}
              controls={controls}
              associates={associates}
              facets={controls.facetCounts(membersLog)}
              matched={filteredLog.length}
              total={membersLog.length}
            />

            <DataTable
              rows={filteredLog}
              columns={memberColumns}
              sort={controls.sort}
              onToggleSort={controls.toggleSort}
              loading={loading}
              estimateRowHeight={64}
              rowKey={(m) => m.id}
              onRowClick={(m) => openMember(m.id, { onAfterChange: fetchData })}
              emptyState={(
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <Users className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-sm font-semibold">No member entries found matching filters.</p>
                </div>
              )}
            />

            <p className="text-center text-[11px] text-slate-500 font-mono py-2">
              Showing {filteredLog.length} of {membersLog.length} members
              {controls.activeCount > 0 ? ' (filtered)' : ''} — scroll for more
            </p>
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
                  {packages.map(p => {
                    const rt = resolveRates(associates.find(a => a.id === selectedMemberForVip?.associate_id), commissionRules);
                    const cc = calcCommissions(Number(p.price), rt);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} — ${p.price} ({rt.associate_pct}% Comm = ${cc.associate_commission.toFixed(2)})
                      </option>
                    );
                  })}
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
