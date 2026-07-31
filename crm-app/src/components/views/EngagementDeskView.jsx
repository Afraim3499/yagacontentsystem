import React from 'react';
import { MessageSquareCode, CheckCircle2, Clock, Sparkles, User } from 'lucide-react';

export default function EngagementDeskView({ creators }) {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2">
          <span className="badge badge-cyan">Engagement Operations</span>
          <span className="text-xs text-slate-400 font-mono">Requirement: 2 Responses / Creator / Day</span>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
          <MessageSquareCode className="w-5 h-5 text-cyan-400" />
          Medium & Social Engagement Prompt Hub
        </h2>
        <p className="text-xs text-slate-400">
          Monitor creator daily engagement completions across Medium, LinkedIn, X, and CoinMarketCap.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {creators.map((c) => (
          <div key={c.id} className="glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-white text-sm">
                  {c.publicName.substring(0, 2)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{c.publicName}</h3>
                  <span className="text-[11px] text-slate-400 font-mono">{c.id}</span>
                </div>
              </div>
              <span className="badge badge-emerald text-[10px]">2 / 2 Done</span>
            </div>

            <div className="space-y-2 bg-slate-900/80 p-4 rounded-xl border border-white/5 text-xs">
              <div className="text-[11px] font-bold text-cyan-300 uppercase">Today's Medium Engagement Status</div>
              <div className="flex items-center justify-between text-slate-300 py-1 border-b border-white/5">
                <span>Response 1 (Market Story)</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>
              </div>
              <div className="flex items-center justify-between text-slate-300 py-1">
                <span>Response 2 (Psychology Article)</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
              ⚡️ Prompt delivered to Telegram bot at 09:00 AM.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
