import React, { useState, useEffect, useMemo } from 'react';
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
  ShieldCheck
} from 'lucide-react';

export default function MemberTrackingDeskView() {
  const [activeTab, setActiveTab] = useState("MEMBERS_LOG"); // MEMBERS_LOG | ASSOCIATES_VAULT
  const [membersLog, setMembersLog] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssociate, setSelectedAssociate] = useState("ALL");
  const [selectedMonth, setSelectedMonth] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedLink, setSelectedLink] = useState("ALL");

  // New Associate Modal State
  const [isAddAssociateModalOpen, setIsAddAssociateModalOpen] = useState(false);
  const [newAscName, setNewAscName] = useState("");
  const [newAscChatId, setNewAscChatId] = useState("");
  const [newAscInviteLink, setNewAscInviteLink] = useState("");
  const [newAscCommission, setNewAscCommission] = useState("5.00");
  const [saving, setSaving] = useState(false);

  // Fetch Data from Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: ascData } = await supabase.from('associates').select('*').order('created_at', { ascending: false });
      setAssociates(ascData || []);

      const { data: memData } = await supabase.from('community_members_log').select('*').order('joined_at', { ascending: false });
      setMembersLog(memData || []);
    } catch (err) {
      console.error('Error fetching member tracking data:', err);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();

    // Supabase Real-time Subscription for Live Member Joins
    const subscription = supabase
      .channel('community_members_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_members_log' }, (payload) => {
        setMembersLog(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
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
      await supabase.from('associates').insert({
        id: ascId,
        name: newAscName.trim(),
        telegram_chat_id: newAscChatId.trim() || null,
        unique_invite_link: newAscInviteLink.trim(),
        commission_per_member: parseFloat(newAscCommission) || 5.00,
        status: 'ACTIVE'
      });

      await fetchData();
      setNewAscName("");
      setNewAscChatId("");
      setNewAscInviteLink("");
      setNewAscCommission("5.00");
      setIsAddAssociateModalOpen(false);
    } catch (err) {
      console.error('Add associate error:', err);
    }
    setSaving(false);
  };

  // Delete Associate
  const handleDeleteAssociate = async (ascId) => {
    if (!confirm(`Delete associate ${ascId}? This will remove their assigned invite link.`)) return;
    await supabase.from('associates').delete().eq('id', ascId);
    setAssociates(prev => prev.filter(a => a.id !== ascId));
  };

  // Unique Months for Dropdown Filter
  const availableMonths = useMemo(() => {
    const months = new Set();
    membersLog.forEach(m => {
      if (m.joined_at) {
        const d = new Date(m.joined_at);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthKey);
      }
    });
    return Array.from(months).sort().reverse();
  }, [membersLog]);

  // Unique Links for Dropdown Filter
  const availableLinks = useMemo(() => {
    const links = new Set();
    membersLog.forEach(m => { if (m.used_invite_link) links.add(m.used_invite_link); });
    return Array.from(links);
  }, [membersLog]);

  // Filtered Members Log Data
  const filteredLog = useMemo(() => {
    return membersLog.filter(item => {
      // Search by Telegram User ID, Handle, or First Name
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        item.telegram_user_id?.toLowerCase().includes(searchLower) ||
        item.telegram_handle?.toLowerCase().includes(searchLower) ||
        item.first_name?.toLowerCase().includes(searchLower) ||
        item.associate_name?.toLowerCase().includes(searchLower);

      // Associate Filter
      const matchesAssociate = selectedAssociate === "ALL" || item.associate_id === selectedAssociate || item.associate_name === selectedAssociate;

      // Month Filter
      const matchesMonth = selectedMonth === "ALL" || (item.joined_at && item.joined_at.startsWith(selectedMonth));

      // Status Filter
      const matchesStatus = selectedStatus === "ALL" || item.status === selectedStatus;

      // Invite Link Filter
      const matchesLink = selectedLink === "ALL" || item.used_invite_link === selectedLink;

      return matchesSearch && matchesAssociate && matchesMonth && matchesStatus && matchesLink;
    });
  }, [membersLog, searchTerm, selectedAssociate, selectedMonth, selectedStatus, selectedLink]);

  // Summary Metrics Calculations
  const activeMembersCount = membersLog.filter(m => m.status === 'ACTIVE').length;
  const totalCommissions = membersLog.reduce((sum, m) => sum + (Number(m.commission_amount) || 5), 0);

  // CSV Export Function
  const exportCSV = () => {
    const headers = ['Log ID', 'Telegram User ID', 'First Name', 'Handle', 'Associate Name', 'Used Invite Link', 'Group Name', 'Joined Date & Time', 'Status', 'Commission ($)'];
    const rows = filteredLog.map(m => [
      m.id,
      m.telegram_user_id,
      `"${m.first_name || ''}"`,
      `"${m.telegram_handle || ''}"`,
      `"${m.associate_name || ''}"`,
      `"${m.used_invite_link || ''}"`,
      `"${m.group_name || ''}"`,
      m.joined_at ? new Date(m.joined_at).toLocaleString() : '',
      m.status,
      m.commission_amount || 5.00
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `community_members_tracking_${new Date().toISOString().split('T')[0]}.csv`);
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
            <span className="badge badge-gold">Member Intelligence & Referral Desk</span>
            <span className="text-xs text-slate-400 font-mono">Live Real-time Sync Active</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2 uppercase">
            <Users className="w-6 h-6 text-[#e39e2e]" />
            Community Member Tracking & Associate Audit
          </h2>
          <p className="text-xs text-slate-400">
            Real-time audit log of Telegram group joins, exact prebuilt invite links used, associate attribution, and live commission ledgers.
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
            Export Filtered CSV
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
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Members Tracked</span>
            <div className="w-8 h-8 rounded-xl bg-[#e39e2e]/15 border border-[#e39e2e]/30 flex items-center justify-center text-[#e39e2e]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{membersLog.length}</div>
          <p className="text-[11px] text-slate-400 font-mono">Captured Telegram Joins</p>
        </div>

        <div className="glass-card-interactive p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Group Members</span>
            <div className="w-8 h-8 rounded-xl bg-[#00d294]/15 border border-[#00d294]/30 flex items-center justify-center text-[#00d294]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#00d294]">{activeMembersCount}</div>
          <p className="text-[11px] text-slate-400 font-mono">{membersLog.length - activeMembersCount} left group</p>
        </div>

        <div className="glass-card-interactive p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Associates</span>
            <div className="w-8 h-8 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8]">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{associates.length}</div>
          <p className="text-[11px] text-slate-400 font-mono">Assigned Unique Links</p>
        </div>

        <div className="glass-card-interactive p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Commissions</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400">${totalCommissions.toFixed(2)}</div>
          <p className="text-[11px] text-slate-400 font-mono">Accrued Referral Value</p>
        </div>
      </div>

      {/* Main View Container */}
      <div className="glass-panel p-6 space-y-6 border border-white/10">
        {/* Tab Switcher & Filter Controls */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 bg-[#080a0f] p-1.5 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("MEMBERS_LOG")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "MEMBERS_LOG" ? "bg-[#e39e2e] text-[#0b0e14] shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Member Join Log ({filteredLog.length})
            </button>
            <button
              onClick={() => setActiveTab("ASSOCIATES_VAULT")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "ASSOCIATES_VAULT" ? "bg-[#e39e2e] text-[#0b0e14] shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Associates & Unique Links ({associates.length})
            </button>
          </div>

          {activeTab === "MEMBERS_LOG" && (
            <div className="text-xs text-slate-400 font-mono">
              Showing {filteredLog.length} of {membersLog.length} entries
            </div>
          )}
        </div>

        {/* TAB 1: MEMBERS JOIN AUDIT LOG & MULTI-FILTERS */}
        {activeTab === "MEMBERS_LOG" && (
          <div className="space-y-5">
            {/* Multi-Filter Control Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#080a0f] p-4 rounded-2xl border border-white/10">
              {/* Filter 1: Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Member ID / Username..."
                  className="w-full bg-[#121722] text-slate-100 text-xs pl-9 pr-3 py-2.5 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              {/* Filter 2: Associate Filter */}
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

              {/* Filter 3: Month Filter */}
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

              {/* Filter 4: Unique Link Source */}
              <div>
                <select
                  value={selectedLink}
                  onChange={(e) => setSelectedLink(e.target.value)}
                  className="w-full bg-[#121722] text-slate-200 text-xs p-2.5 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none cursor-pointer font-mono"
                >
                  <option value="ALL">🔗 All Invite Links</option>
                  {availableLinks.map(link => (
                    <option key={link} value={link}>{link}</option>
                  ))}
                </select>
              </div>

              {/* Filter 5: Member Status */}
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
            </div>

            {/* Data Table */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-[#e39e2e] animate-spin" />
                <span className="ml-3 text-sm text-slate-400">Loading member tracking log...</span>
              </div>
            ) : filteredLog.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <Users className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-semibold">No member entries found matching filters.</p>
                <p className="text-xs text-slate-600">Try adjusting your search criteria or date selection.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#080a0f] text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-3.5">Log ID</th>
                      <th className="p-3.5">Member Telegram ID & Name</th>
                      <th className="p-3.5">Associate Assigned</th>
                      <th className="p-3.5">Used Invite Link</th>
                      <th className="p-3.5">Joined Date & Time</th>
                      <th className="p-3.5">Group</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Commission ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {filteredLog.map((item) => (
                      <tr key={item.id} className="hover:bg-[#121722] transition-colors">
                        <td className="p-3.5 font-bold text-[#e39e2e]">{item.id}</td>
                        <td className="p-3.5 font-sans">
                          <div className="font-bold text-white text-xs">{item.first_name || 'Member'}</div>
                          <div className="text-[10px] text-[#38bdf8] font-mono">ID: {item.telegram_user_id} {item.telegram_handle}</div>
                        </td>
                        <td className="p-3.5 font-sans">
                          <span className={`font-bold ${item.associate_id ? 'text-[#00d294]' : 'text-slate-400'}`}>
                            {item.associate_name || 'Unattributed'}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400 text-[11px]">
                          <span className="truncate max-w-[200px] block" title={item.used_invite_link}>
                            {item.used_invite_link || 'Direct/Unknown'}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-300 text-[11px]">
                          {item.joined_at ? new Date(item.joined_at).toLocaleString() : 'N/A'}
                        </td>
                        <td className="p-3.5 font-sans text-xs text-slate-300">{item.group_name || 'VIP Group'}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.status === 'ACTIVE' ? 'bg-[#00d294]/15 text-[#00d294] border border-[#00d294]/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-emerald-400">+${Number(item.commission_amount || 5.00).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ASSOCIATES & UNIQUE INVITE LINKS VAULT */}
        {activeTab === "ASSOCIATES_VAULT" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Crown className="w-5 h-5 text-[#e39e2e]" />
                  Associates Roster & Unique Link Mapping
                </h3>
                <p className="text-xs text-slate-400">
                  Every Associate is mapped to their unique prebuilt Telegram invite link URL. When a new user enters via that link, commissions accrue instantly.
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

            {associates.length === 0 ? (
              <div className="glass-panel p-12 text-center space-y-4 border border-white/10">
                <Crown className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-400">No Associates registered yet.</p>
                <p className="text-xs text-slate-500">Click <strong className="text-white">+ Add New Associate</strong> above to assign a prebuilt Telegram unique link.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {associates.map((asc) => {
                  const referralsCount = membersLog.filter(m => m.associate_id === asc.id || m.associate_name === asc.name).length;
                  const earnedCommissions = referralsCount * (Number(asc.commission_per_member) || 5);

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
                            <span className="text-slate-400">Commission / Member:</span>
                            <span className="text-emerald-400 font-bold">${Number(asc.commission_per_member).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Referrals Logged:</span>
                            <span className="text-white font-bold">{referralsCount} Members</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Earned Balance:</span>
                            <span className="text-emerald-400 font-bold">${earnedCommissions.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[10px] font-mono">
                          Created: {asc.created_at ? new Date(asc.created_at).toLocaleDateString() : 'Active'}
                        </span>
                        <button
                          onClick={() => handleDeleteAssociate(asc.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 cursor-pointer"
                          title="Delete Associate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

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
                <label className="text-slate-300 font-bold uppercase tracking-wider block">Associate Full Name *</label>
                <input
                  type="text"
                  required
                  value={newAscName}
                  onChange={(e) => setNewAscName(e.target.value)}
                  placeholder="e.g. Associate Alex"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold uppercase tracking-wider block">Assigned Telegram Unique Invite URL *</label>
                <input
                  type="text"
                  required
                  value={newAscInviteLink}
                  onChange={(e) => setNewAscInviteLink(e.target.value)}
                  placeholder="e.g. https://t.me/+AbCdEfGh123"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold uppercase tracking-wider block">Telegram Chat ID (Optional for Alerts)</label>
                <input
                  type="text"
                  value={newAscChatId}
                  onChange={(e) => setNewAscChatId(e.target.value)}
                  placeholder="e.g. 987654321"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold uppercase tracking-wider block">Commission per Member ($)</label>
                <input
                  type="number"
                  step="0.50"
                  required
                  value={newAscCommission}
                  onChange={(e) => setNewAscCommission(e.target.value)}
                  placeholder="5.00"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsAddAssociateModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="grad-button px-5 py-2.5 rounded-xl font-black shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {saving ? 'Saving...' : 'Register Associate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
