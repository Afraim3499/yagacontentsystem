import React from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Star,
  Layers, 
  MessageSquareCode, 
  AlertTriangle, 
  BarChart3, 
  Settings,
  Activity,
  X
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, openIssuesCount, mobileOpen, onClose }) {
  const menuItems = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
    { id: 'studio', label: 'Content Studio', icon: CalendarDays, badge: '3-Batch' },
    { id: 'members', label: 'Member Intelligence', icon: Users, badge: 'Live' },
    { id: 'reviews', label: 'Review Moderation', icon: Star, badge: 'New' },
    { id: 'creators', label: 'Creators & Accounts', icon: Users },
    { id: 'playbooks', label: 'Platforms & Playbooks', icon: Layers },
    { id: 'logs', label: 'Activity Audit Desk', icon: Activity },
    { id: 'engagement', label: 'Engagement Hub', icon: MessageSquareCode },
    { id: 'issues', label: 'Issue Resolution Desk', icon: AlertTriangle, count: openIssuesCount, alert: openIssuesCount > 0 },
    { id: 'analytics', label: 'Conversion Analytics', icon: BarChart3 },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  const quickMobileItems = [
    { id: 'dashboard', label: 'Command', icon: LayoutDashboard },
    { id: 'studio', label: 'Studio', icon: CalendarDays },
    { id: 'creators', label: 'Creators', icon: Users },
    { id: 'issues', label: 'Issues', icon: AlertTriangle, count: openIssuesCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSelect = (id) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full">
      <div className="space-y-1.5">
        <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
          <span>Navigation Menu</span>
          {onClose && (
            <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
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
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on screens < md) */}
      <aside className="hidden md:flex w-64 glass-panel p-4 flex-col justify-between shrink-0 min-h-[calc(100vh-6rem)] border border-white/10">
        {navContent}
      </aside>

      {/* Mobile Slide-Over Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop Blur */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-xs bg-[#0b0e14] p-4 h-full shadow-2xl border-r border-white/10 z-10 overflow-y-auto">
            {navContent}
          </div>
        </div>
      )}

      {/* Fixed Bottom Mobile Navigation Bar for Quick Access */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0f141d]/95 backdrop-blur-md border-t border-white/10 px-2 py-1.5 flex items-center justify-around">
        {quickMobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all relative ${
                isActive ? 'text-[#e39e2e]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-0.5">{item.label}</span>
              {item.count > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}

