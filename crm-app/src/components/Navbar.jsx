import React, { useState, useEffect } from 'react';
import { Zap, Send, Clock, Activity, AlertTriangle, Radio, Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Navbar({ systemSettings, activeBatch, mobileMenuOpen, setMobileMenuOpen }) {
  const [tickerHeadlines, setTickerHeadlines] = useState([
    "⚡️ Yaga Calls Command Center Active • Realtime Monitoring Live",
    "📢 3-Batch Staggered Window: 11:00 AM - 02:00 PM EST",
    "🛡️ 60-Minute SLA Circuit Breaker Active"
  ]);
  const [tickerIndex, setTickerIndex] = useState(0);

  // Fetch live headlines from system_logs
  useEffect(() => {
    async function fetchLatestHeadlines() {
      try {
        const { data } = await supabase
          .from('system_logs')
          .select('message, event_type')
          .order('created_at', { ascending: false })
          .limit(8);

        if (data && data.length > 0) {
          setTickerHeadlines(data.map(d => d.message));
        }
      } catch (e) {}
    }
    fetchLatestHeadlines();

    // Subscribe to new logs for real-time headline updates
    const channel = supabase
      .channel('navbar-ticker-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, (payload) => {
        setTickerHeadlines(prev => [payload.new.message, ...prev.slice(0, 7)]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Ticker animation interval
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % tickerHeadlines.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [tickerHeadlines.length]);

  // Compute REAL live batch progress from activeBatch.tasks
  const tasks = activeBatch?.tasks || [];
  const b1 = tasks.filter(t => t.batch === 1);
  const b2 = tasks.filter(t => t.batch === 2);
  const b3 = tasks.filter(t => t.batch === 3);

  const getPct = (bTasks) => {
    if (bTasks.length === 0) return 0;
    const completed = bTasks.filter(t => t.status === 'Completed').length;
    return Math.round((completed / bTasks.length) * 100);
  };

  const b1Pct = getPct(b1);
  const b2Pct = getPct(b2);
  const b3Pct = getPct(b3);

  const b1Label = b1.length === 0 ? 'Ready' : `${b1Pct}%`;
  const b2Label = b2.length === 0 ? 'Pending' : `${b2Pct}%`;
  const b3Label = b3.length === 0 ? 'Pending' : `${b3Pct}%`;

  return (
    <header className="glass-panel sticky top-0 z-40 px-3.5 sm:px-6 py-3 mb-4 sm:mb-6 flex items-center justify-between border-b border-white/10 rounded-none border-x-0 border-t-0 bg-[#0f141d]/95 backdrop-blur-md">
      {/* Left Brand Logo & Mobile Toggle */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl bg-slate-800/80 border border-white/10 text-slate-200 hover:text-white"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5 text-[#e39e2e]" /> : <Menu className="w-5 h-5 text-slate-200" />}
        </button>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center shadow-lg shadow-[#e39e2e]/25 text-[#0b0e14]">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 sm:gap-2 uppercase">
              YAGA CALLS
              <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md bg-[#e39e2e]/20 text-[#e39e2e] border border-[#e39e2e]/35">
                CRM
              </span>
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium hidden xs:block">Chief System Command</p>
          </div>
        </div>
      </div>

      {/* Center: Live Running Operations News Ticker Banner (Fixed Width TV News Crawler) */}
      <div className="w-[480px] shrink-0 mx-4 hidden xl:block">
        <div className="bg-[#080a0f] h-10 px-3 rounded-xl border border-white/10 flex items-center gap-3 relative overflow-hidden shadow-inner">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#e39e2e]/20 text-[#e39e2e] border border-[#e39e2e]/40 text-[10px] font-black uppercase tracking-wider shrink-0 z-10 shadow-md">
            <Radio className="w-3 h-3 text-[#e39e2e] animate-pulse" />
            LIVE TICKER
          </div>

          <div className="flex-1 overflow-hidden h-full relative flex items-center">
            <div className="animate-ticker text-xs font-mono font-bold text-slate-200">
              {tickerHeadlines.join("   •   ") || "⚡️ Operations System Live • Realtime Monitoring Active"}
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls & Batch Status */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Live Staggered Batch Progress Gauge */}
        <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-xl bg-[#080a0f] border border-white/10 text-xs">
          <Clock className="w-4 h-4 text-[#e39e2e]" />
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">3-Batch Engine</div>
            <div className="font-mono text-slate-200 font-bold flex items-center gap-1.5">
              <span>B1:</span> <span className={b1Pct === 100 ? "text-[#00d294]" : b1Pct > 0 ? "text-[#e39e2e]" : "text-slate-400"}>{b1Label}</span>
              <span className="text-slate-600">•</span>
              <span>B2:</span> <span className={b2Pct === 100 ? "text-[#00d294]" : b2Pct > 0 ? "text-[#e39e2e]" : "text-slate-400"}>{b2Label}</span>
              <span className="text-slate-600">•</span>
              <span>B3:</span> <span className={b3Pct === 100 ? "text-[#00d294]" : b3Pct > 0 ? "text-[#e39e2e]" : "text-slate-400"}>{b3Label}</span>
            </div>
          </div>
        </div>

        {/* Telegram Bot Username Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#e39e2e]/10 border border-[#e39e2e]/30 text-[#e39e2e] text-xs font-bold">
          <Send className="w-3.5 h-3.5" />
          <span>{systemSettings.botUsername}</span>
        </div>

        {/* Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="w-8 h-8 rounded-full bg-[#121722] border border-[#e39e2e]/40 flex items-center justify-center text-xs font-black text-[#e39e2e]">
            YC
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-bold text-white">Yaga Owner</div>
            <div className="text-[10px] text-slate-400 font-medium">Chief Engineer</div>
          </div>
        </div>
      </div>
    </header>
  );
}

