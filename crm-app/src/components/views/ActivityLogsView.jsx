import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Activity, Filter, Search, RefreshCw, CheckCircle2, AlertTriangle, Send, UserPlus, ShieldAlert, Clock, Layers, Loader2
} from 'lucide-react';
import { SkeletonTableRows } from '../Skeleton';

export default function ActivityLogsView({ creators = [], platforms = [] }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [filterCreator, setFilterCreator] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  // Realtime listener for live log stream
  useEffect(() => {
    const channel = supabase
      .channel('live-logs-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, (payload) => {
        setLogs(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
    setLoading(false);
  }

  const getEventBadge = (type) => {
    switch (type) {
      case 'ONBOARDING':
        return { label: 'USER ONBOARD', class: 'badge-emerald', icon: <UserPlus className="w-3 h-3" /> };
      case 'PLATFORM_ONBOARD':
        return { label: 'PLATFORM READY', class: 'badge-cyan', icon: <CheckCircle2 className="w-3 h-3" /> };
      case 'DISPATCH':
        return { label: 'DISPATCH SENT', class: 'badge-gold', icon: <Send className="w-3 h-3" /> };
      case 'TASK_COMPLETE':
        return { label: 'TASK DONE', class: 'badge-emerald', icon: <CheckCircle2 className="w-3 h-3" /> };
      case 'ISSUE_REPORTED':
        return { label: 'ISSUE REPORTED', class: 'badge-rose', icon: <AlertTriangle className="w-3 h-3" /> };
      case 'SLA_ALERT':
        return { label: 'SLA 60M TICKET', class: 'badge-rose', icon: <ShieldAlert className="w-3 h-3" /> };
      default:
        return { label: type || 'SYSTEM', class: 'badge-primary', icon: <Activity className="w-3 h-3" /> };
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'ALL' && log.event_type !== filterType) return false;
    if (filterCreator !== 'ALL' && log.creator_name !== filterCreator) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = log.message?.toLowerCase().includes(q);
      const matchCreator = log.creator_name?.toLowerCase().includes(q);
      const matchId = log.id?.toLowerCase().includes(q);
      if (!matchMsg && !matchCreator && !matchId) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-cyan">Live Operations Audit Stream</span>
            <span className="text-xs text-slate-400 font-mono">Realtime Log Events: {logs.length}</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2 uppercase">
            <Activity className="w-5 h-5 text-[#38bdf8]" />
            Dynamic Activity & Audit Trail Desk
          </h2>
          <p className="text-xs text-slate-400">
            Real-time filterable logs of user onboardings, platform setups, task dispatches, completions, and SLA alerts.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-4 py-2 rounded-xl bg-[#121722] hover:bg-[#1a2130] text-slate-200 text-xs font-bold border border-white/10 flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Stream
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-white/10 text-xs">
        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-slate-300">Filter Event:</span>
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#080a0f] text-slate-200 p-2 rounded-xl border border-white/10 focus:outline-none font-mono"
          >
            <option value="ALL">All Event Types</option>
            <option value="ONBOARDING">User Onboarding</option>
            <option value="PLATFORM_ONBOARD">Platform Setup</option>
            <option value="DISPATCH">Batch Dispatches</option>
            <option value="TASK_COMPLETE">Task Completions</option>
            <option value="ISSUE_REPORTED">Issue Tickets</option>
            <option value="SLA_ALERT">SLA Alerts</option>
          </select>

          <select
            value={filterCreator}
            onChange={(e) => setFilterCreator(e.target.value)}
            className="bg-[#080a0f] text-slate-200 p-2 rounded-xl border border-white/10 focus:outline-none font-mono"
          >
            <option value="ALL">All Creators / Systems</option>
            {creators.map(c => (
              <option key={c.id} value={c.publicName}>{c.publicName}</option>
            ))}
          </select>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search log activity..."
            className="w-full bg-[#080a0f] text-white pl-9 pr-3 py-2 rounded-xl border border-white/10 focus:outline-none font-sans"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel p-6 space-y-4 border border-white/10">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#080a0f] text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th scope="col" className="p-3">Log ID</th>
                  <th scope="col" className="p-3">Event Type</th>
                  <th scope="col" className="p-3">User / System</th>
                  <th scope="col" className="p-3">Log Message</th>
                  <th scope="col" className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                <SkeletonTableRows columns={5} rows={8} cellClassName="p-3" />
              </tbody>
            </table>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No system log events matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#080a0f] text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th scope="col" className="p-3">Log ID</th>
                  <th scope="col" className="p-3">Event Type</th>
                  <th scope="col" className="p-3">User / System</th>
                  <th scope="col" className="p-3">Log Message</th>
                  <th scope="col" className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {filteredLogs.map((log) => {
                  const badge = getEventBadge(log.event_type);
                  return (
                    <tr key={log.id} className="hover:bg-[#121722] transition-colors">
                      <td className="p-3 font-bold text-[#e39e2e]">{log.id}</td>
                      <td className="p-3">
                        <span className={`badge ${badge.class} text-[9px] flex items-center gap-1 w-fit`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3 font-sans font-semibold text-white">{log.creator_name || 'System'}</td>
                      <td className="p-3 font-sans text-slate-200 leading-relaxed">{log.message}</td>
                      <td className="p-3 text-slate-400 text-[11px]">
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
