import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Crown,
  Users,
  Download,
  DollarSign,
  CheckCircle2,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Edit3,
  Calendar,
  Clock,
  AlertTriangle,
  RotateCw,
  Briefcase,
  X
} from 'lucide-react';
import { useConfirm } from '../ConfirmDialogProvider';
import DataTable from '../data/DataTable';
import FilterBar from '../data/FilterBar';
import { useTableControls } from '../data/useTableControls';
import { exportCsv } from '../data/exportCsv';
import { computeLiveStatus, LIVE_STATUS_LABEL, fmtDateNice } from '../data/dates';
import { resolveRates, calcCommissions, DEFAULT_RATES } from '../../lib/commissions';
import { logMemberEvent, recordMemberPayment, diffFields } from '../../lib/memberLog';
import { renewMember } from '../../lib/memberActions';
import { useMember360 } from '../member360/Member360Context';

export default function VipMembersDeskView() {
  const confirm = useConfirm();
  const { openMember } = useMember360();
  const [vipMembers, setVipMembers] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [commissionRules, setCommissionRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Resolve the commission rates for a given associate id (override → rules → default)
  const ratesFor = (associateId) =>
    resolveRates(associates.find((a) => a.id === associateId), commissionRules);

  // ── Filter / sort controls (shared infra) ──
  const tableConfig = useMemo(() => ({
    urlKey: 'vip',
    searchPlaceholder: 'Search member name, @handle, ID, associate…',
    searchKeys: ['first_name', 'telegram_handle', 'telegram_user_id', 'associate_name'],
    filters: [
      {
        key: 'live_status', type: 'select', label: 'All statuses',
        accessor: (m) => computeLiveStatus(m),
        options: [
          { value: 'ACTIVE', label: '🟢 Active' },
          { value: 'EXPIRING_SOON', label: '⚠️ Expiring soon (≤7d)' },
          { value: 'EXPIRED', label: '🔴 Expired' },
        ],
      },
      {
        key: 'associate_id', type: 'multiselect', label: 'Associate', optionsFrom: 'associates',
        accessor: (m) => m.associate_id || 'DIRECT',
      },
      {
        key: 'package', type: 'select', label: 'All tiers',
        accessor: (m) => {
          const v = Number(m.paid_subscription_value || 0);
          if (v === 200) return '200';
          if (v === 250) return '250';
          if (v === 350) return '350';
          if (v === 700) return '700';
          return v > 0 ? 'CUSTOM' : '0';
        },
        options: [
          { value: '200', label: '$200' },
          { value: '250', label: '$250 (Quarterly)' },
          { value: '350', label: '$350 (Half-Yearly)' },
          { value: '700', label: '$700 (Yearly)' },
          { value: 'CUSTOM', label: 'Custom tier' },
        ],
      },
      { key: 'value', type: 'numberrange', label: 'Value $', accessor: (m) => Number(m.paid_subscription_value || 0) },
      { key: 'duration', type: 'numberrange', label: 'Months', accessor: (m) => Number(m.subscription_duration_months || 0) },
      { key: 'joined', type: 'daterange', label: 'Joined', accessor: (m) => m.paid_group_joined_at || m.created_at },
      { key: 'expires', type: 'daterange', label: 'Expires', accessor: (m) => m.subscription_expiration_date },
    ],
    sortAccessors: {
      joined_at: (m) => new Date(m.paid_group_joined_at || m.created_at || 0).getTime(),
      expires_at: (m) => new Date(m.subscription_expiration_date || 0).getTime(),
      value: (m) => Number(m.paid_subscription_value || 0),
      name: (m) => (m.first_name || '').toLowerCase(),
      associate: (m) => (m.associate_name || '').toLowerCase(),
    },
    defaultSort: [{ key: 'joined_at', dir: 'desc' }],
  }), []);
  const controls = useTableControls(tableConfig);

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
          .is('deleted_at', null)
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

      const { data: ruleData } = await supabase
        .from('commission_rules').select('*').eq('id', 'RULE-DEFAULT').maybeSingle();
      if (ruleData) setCommissionRules(ruleData);

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

  // Filtered + sorted VIP roster (shared client-side controls)
  const filteredVips = useMemo(() => controls.apply(vipMembers), [controls, vipMembers]);

  // Overall Stat Calculations
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCommission = 0;
    let totalKabidulCommission = 0;
    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;

    const now = new Date();
    vipMembers.forEach(m => {
      const val = Number(m.paid_subscription_value || 0);
      const comm = Number(m.paid_commission || val * DEFAULT_RATES.associate_pct / 100);
      const kabComm = Number(m.kabidul_commission || val * DEFAULT_RATES.kabidul_pct / 100);
      totalRevenue += val;
      totalCommission += comm;
      totalKabidulCommission += kabComm;

      const st = computeLiveStatus(m, now);
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
    const c = calcCommissions(subVal, ratesFor(m.associate_id));
    setEditAssociateComm(m.paid_commission || c.associate_commission.toFixed(2));
    setEditKabidulComm(m.kabidul_commission || c.kabidul_commission.toFixed(2));

    setIsEditModalOpen(true);
  };

  // Helper when Package Sub Value changes in Edit Modal
  const handleEditSubValChange = (val) => {
    setEditSubVal(val);
    const c = calcCommissions(Number(val) || 0, ratesFor(editAssociateId));
    setEditAssociateComm(c.associate_commission.toFixed(2));
    setEditKabidulComm(c.kabidul_commission.toFixed(2));
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

    const after = {
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
    };
    const { error } = await supabase.from('community_members_log').update(after).eq('id', editingMember.id);

    if (error) {
      alert('Error updating member details: ' + error.message);
    } else {
      const diff = diffFields(editingMember, after, [
        'first_name', 'telegram_handle', 'telegram_user_id', 'associate_name',
        'paid_subscription_value', 'paid_commission', 'kabidul_commission',
        'subscription_duration_months', 'subscription_expiration_date', 'subscription_status',
      ]);
      await logMemberEvent({
        memberId: editingMember.id, telegramUserId: after.telegram_user_id, memberName: editName.trim(),
        type: 'edited', source: 'CRM_VIP_DESK', note: `Edited ${Object.keys(diff).length} field(s)`,
        detail: { diff },
      });
      // A price / associate change on an existing term is a money adjustment
      const priceChanged = Number(editingMember.paid_subscription_value || 0) !== subVal;
      if (priceChanged) {
        await recordMemberPayment({
          memberId: editingMember.id, telegramUserId: after.telegram_user_id, memberName: editName.trim(),
          paymentType: 'adjustment', amount: subVal - Number(editingMember.paid_subscription_value || 0),
          durationMonths: months, termEnd: expDateObj.toISOString(),
          associateId: editAssociateId || null, associateName: ascName,
          associateCommission: commVal - Number(editingMember.paid_commission || 0),
          kabidulCommission: kabCommVal - Number(editingMember.kabidul_commission || 0),
          recordedBy: 'crm', source: 'CRM_VIP_DESK', note: 'Manual edit — subscription value changed',
        });
      }
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
    const months = Number(durationMonths) || 6;
    const { associate_commission: commVal, kabidul_commission: kabidulCommVal, snapshot } =
      calcCommissions(subVal, ratesFor(targetAssociateId));

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
      subscription_status: 'ACTIVE',
      first_converted_at: now.toISOString(),
      lifetime_value: subVal,
      renewal_count: 0
    }]);

    if (error) {
      alert('Error enrolling VIP member: ' + error.message);
    } else {
      const paymentId = await recordMemberPayment({
        memberId: logId, telegramUserId: userId, memberName: memberName.trim(),
        paymentType: 'new', amount: subVal, durationMonths: months,
        termStart: now.toISOString(), termEnd: expDate.toISOString(),
        associateId: targetAssociateId || null, associateName: ascName,
        associateCommission: commVal, kabidulCommission: kabidulCommVal,
        commissionSnapshot: snapshot, recordedBy: 'crm', source: 'CRM_VIP_DESK',
      });
      await logMemberEvent({
        memberId: logId, telegramUserId: userId, memberName: memberName.trim(),
        type: 'enrolled', source: 'CRM_VIP_DESK', paymentId,
        note: `Enrolled at $${subVal} for ${months} months`,
        detail: { after: { paid_subscription_value: subVal, months, associate: ascName } },
      });
      alert(`🎉 Successfully Enrolled VIP Member: ${memberName} ($${subVal} Tier - ${months} Months)!\n💼 Kabidul's ${snapshot.kabidul_pct}% Commission: $${kabidulCommVal}`);
      setIsEnrollModalOpen(false);
      setMemberName("");
      setTelegramHandle("");
      setTelegramUserId("");
      setTargetAssociateId("");
      fetchVipData();
    }
  }

  // Renewal Handler — delegates to the shared lifecycle action so the CRM
  // desk, the Member 360 panel, and the bot all renew the same way.
  async function handleRenewSubscription(e) {
    e.preventDefault();
    if (!renewingMember) return;

    const months = Number(renewDurationMonths) || 6;
    const res = await renewMember(renewingMember, {
      tierValue: renewTierValue, months, associates, commissionRules, source: 'CRM_VIP_DESK',
    });
    if (res?.error) {
      alert('Error renewing subscription: ' + res.error.message);
    } else {
      alert(`🎉 Renewed ${renewingMember.first_name}'s VIP Subscription for ${months} Months!\n💼 Kabidul's commission: $${Number(res.kabidul_commission || 0).toFixed(2)}`);
      setIsRenewModalOpen(false);
      setRenewingMember(null);
      fetchVipData();
    }
  }

  // Delete Member Handler — soft delete (keeps the row + its history)
  async function handleDeleteMember(memberId, name) {
    if (!(await confirm(`⚠️ Remove VIP member "${name}" from the roster?\n\nThis is a soft delete — the record and its history are kept and can be restored.`))) return;

    const member = vipMembers.find(m => m.id === memberId);
    const { error } = await supabase.from('community_members_log').update({
      deleted_at: new Date().toISOString(),
      deleted_by: 'crm',
      status: 'LEFT'
    }).eq('id', memberId);
    if (error) {
      alert('Error removing member: ' + error.message);
    } else {
      await logMemberEvent({
        memberId, telegramUserId: member?.telegram_user_id, memberName: name,
        type: 'deleted', source: 'CRM_VIP_DESK', note: 'Soft-deleted from VIP roster',
      });
      setVipMembers(prev => prev.filter(m => m.id !== memberId));
    }
  }

  // ── Column config — drives both the table and the CSV export ──
  const columns = useMemo(() => [
    {
      key: 'member', header: 'Member Info', sortKey: 'name', width: '22%',
      csv: (m) => m.first_name || 'VIP Member',
      render: (m) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-sm shrink-0">
            {m.first_name ? m.first_name.charAt(0).toUpperCase() : 'V'}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-200 truncate">{m.first_name || 'VIP Member'}</div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              {m.telegram_handle && <span className="text-amber-400/80 truncate">{m.telegram_handle}</span>}
              {m.telegram_user_id && <span className="text-slate-600 font-mono text-[10px]">ID: {m.telegram_user_id}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'associate', header: 'Referred Associate', sortKey: 'associate',
      csv: (m) => m.associate_name || 'Unattributed / Direct',
      render: (m) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs font-medium text-slate-300">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          {m.associate_name || 'Unattributed / Direct'}
        </span>
      ),
    },
    {
      key: 'package', header: 'Package & Duration', sortKey: 'value',
      csv: (m) => `$${Number(m.paid_subscription_value || 0)} / ${m.subscription_duration_months || 6}mo`,
      render: (m) => {
        const val = Number(m.paid_subscription_value || 0);
        const dur = m.subscription_duration_months || 6;
        const promo = dur === 8 || dur === 14;
        return (
          <div className="font-semibold text-emerald-400 flex items-center gap-1">
            <DollarSign className="w-4 h-4 stroke-[2.5]" />{val}
            <span className="text-xs font-normal text-slate-400 ml-1">({dur} Months {promo ? '🎁' : ''})</span>
          </div>
        );
      },
    },
    {
      key: 'dates', header: 'Joined & Expiration', sortKey: 'joined_at',
      csv: (m) => fmtDateNice(m.paid_group_joined_at || m.created_at),
      render: (m) => {
        const exp = m.subscription_expiration_date ? new Date(m.subscription_expiration_date) : null;
        return (
          <div className="text-xs space-y-0.5">
            <div className="text-slate-300 flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-500" />Joined: {fmtDateNice(m.paid_group_joined_at || m.created_at)}</div>
            <div className="text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400" />Expires: {exp ? fmtDateNice(exp) : 'N/A'}</div>
          </div>
        );
      },
    },
    {
      key: 'status', header: 'Status', sortKey: 'expires_at',
      csv: (m) => LIVE_STATUS_LABEL[computeLiveStatus(m)],
      render: (m) => {
        const st = computeLiveStatus(m);
        if (st === 'EXPIRING_SOON') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> Expiring Soon</span>;
        if (st === 'EXPIRED') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold"><Clock className="w-3.5 h-3.5" /> Expired</span>;
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>;
      },
    },
    {
      key: 'commissions', header: 'Commissions (5% / 25%)',
      csv: (m) => {
        const val = Number(m.paid_subscription_value || 0);
        return `${Number(m.paid_commission || val * DEFAULT_RATES.associate_pct / 100).toFixed(2)} / ${Number(m.kabidul_commission || val * DEFAULT_RATES.kabidul_pct / 100).toFixed(2)}`;
      },
      render: (m) => {
        const val = Number(m.paid_subscription_value || 0);
        const comm = Number(m.paid_commission || val * DEFAULT_RATES.associate_pct / 100);
        const kab = Number(m.kabidul_commission || val * DEFAULT_RATES.kabidul_pct / 100);
        return (
          <div className="text-xs space-y-0.5">
            <div className="font-medium text-emerald-400 flex items-center gap-1"><Sparkles className="w-3 h-3" />5%: ${comm.toFixed(2)}</div>
            <div className="font-semibold text-amber-400 flex items-center gap-1"><Briefcase className="w-3 h-3" />25%: ${kab.toFixed(2)}</div>
          </div>
        );
      },
    },
    { key: 'tg_handle', header: 'Telegram Handle', csv: (m) => m.telegram_handle || '' },
    { key: 'tg_id', header: 'Telegram User ID', csv: (m) => m.telegram_user_id || '' },
    {
      key: 'actions', header: 'Actions', align: 'right',
      render: (m) => (
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(m); }} className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-lg text-xs font-medium transition-colors" title="Edit VIP Member Details">
            <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRenewingMember(m);
              setRenewTierValue(m.paid_subscription_value || '350');
              setRenewDurationMonths(m.subscription_duration_months || '8');
              setIsRenewModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-medium transition-colors"
            title="Renew Subscription"
          >
            <RotateCw className="w-3.5 h-3.5" /> Renew
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteMember(m.id, m.first_name); }} className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors" title="Delete Member">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportToCSV = () => {
    if (filteredVips.length === 0) return alert('No VIP data to export.');
    exportCsv(filteredVips, columns, 'VIP_Members_Roster');
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
      <FilterBar
        config={tableConfig}
        controls={controls}
        associates={associates}
        facets={controls.facetCounts(vipMembers)}
        matched={filteredVips.length}
        total={vipMembers.length}
      />

      {/* Main VIP Roster Table */}
      <DataTable
        rows={filteredVips}
        columns={columns}
        sort={controls.sort}
        onToggleSort={controls.toggleSort}
        loading={loading}
        estimateRowHeight={72}
        rowKey={(m) => m.id}
        onRowClick={(m) => openMember(m.id, { onAfterChange: fetchVipData })}
        emptyState={(
          <div className="p-16 text-center text-slate-400 space-y-3">
            <Crown className="w-10 h-10 text-slate-600 mx-auto stroke-[1.5]" />
            <div className="text-base font-medium text-slate-300">No VIP Members Found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {controls.activeCount > 0
                ? 'Try adjusting your search terms or filters.'
                : 'Enroll your first VIP member using the button above!'}
            </p>
          </div>
        )}
      />

      {!loading && filteredVips.length > 0 && (
        <p className="text-center text-[11px] text-slate-500 font-mono py-2">
          Showing {filteredVips.length} of {vipMembers.length} VIP members
          {controls.activeCount > 0 ? ' (filtered)' : ''} — scroll for more
        </p>
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
                This will reset the member's status to 🟢 ACTIVE, record a renewal payment, calculate Kabidul's{' '}
                {calcCommissions(Number(renewTierValue) || 0, ratesFor(renewingMember?.associate_id)).snapshot.kabidul_pct}% commission
                {' '}(${calcCommissions(Number(renewTierValue) || 0, ratesFor(renewingMember?.associate_id)).kabidul_commission.toFixed(2)}),
                and set a new expiration date starting from today.
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
