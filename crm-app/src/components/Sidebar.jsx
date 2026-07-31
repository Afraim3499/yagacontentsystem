import React from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Layers, 
  MessageSquareCode, 
  AlertTriangle, 
  BarChart3, 
  Settings,
  Activity
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, openIssuesCount }) {
  const menuItems = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
    { id: 'studio', label: 'Content Studio', icon: CalendarDays, badge: '3-Batch' },
    { id: 'creators', label: 'Creators & Accounts', icon: Users },
    { id: 'playbooks', label: 'Platforms & Playbooks', icon: Layers },
    { id: 'logs', label: 'Activity Audit Desk', icon: Activity, badge: 'Live' },
    { id: 'engagement', label: 'Engagement Hub', icon: MessageSquareCode },
    { id: 'issues', label: 'Issue Resolution Desk', icon: AlertTriangle, count: openIssuesCount, alert: openIssuesCount > 0 },
    { id: 'analytics', label: 'Conversion Analytics', icon: BarChart3 },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 glass-panel p-4 flex flex-col justify-between shrink-0 min-h-[calc(100vh-6rem)] border border-white/10">
      <div className="space-y-1.5">
        <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Navigation Menu
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#e39e2e] to-[#d5b895] text-[#0b0e14] shadow-lg shadow-[#e39e2e]/25 border border-[#e39e2e]/40 font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#0b0e14]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              
              {item.badge && (
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                  isActive ? 'bg-[#0b0e14]/20 text-[#0b0e14]' : 'bg-[#e39e2e]/20 text-[#e39e2e] border border-[#e39e2e]/30'
                }`}>
                  {item.badge}
                </span>
              )}

              {item.count > 0 && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  item.alert ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-slate-700 text-slate-300'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer System Status Card */}
      <div className="p-4 rounded-xl bg-[#080a0f] border border-white/10 space-y-2.5 mt-6">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-semibold text-[11px]">Supabase DB</span>
          <span className="text-[#00d294] font-bold text-[11px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d294] animate-pulse" />
            Connected
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-semibold text-[11px]">Telegram Bot</span>
          <span className="text-[#00d294] font-bold text-[11px]">Active</span>
        </div>
        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1 border border-white/5">
          <div className="bg-gradient-to-r from-[#e39e2e] to-[#00d294] h-full w-[100%]" />
        </div>
        <div className="text-[10px] text-slate-400 text-center pt-1 font-mono uppercase tracking-widest font-bold">
          YAGA ENGINE #2026-v2.0
        </div>
      </div>
    </aside>
  );
}
