import React from 'react';
import { 
  Zap, 
  Clock, 
  CheckCircle2, 
  Send, 
  Users, 
  Layers, 
  AlertTriangle, 
  TrendingUp, 
  ChevronRight,
  ShieldCheck,
  Flame,
  ArrowUpRight
} from 'lucide-react';

export default function DashboardView({ 
  systemSettings, 
  creators, 
  platforms, 
  accounts, 
  dailyBatch, 
  issues,
  onPhaseToggle,
  onNavigateTab
}) {
  const activeAccountsCount = accounts.filter(a => a.status === 'Active').length;
  const totalRequiredAccounts = creators.length * platforms.length;
  const onboardingPercent = Math.round((activeAccountsCount / totalRequiredAccounts) * 100);

  const completedTasks = dailyBatch.tasks.filter(t => t.status === 'Completed').length;
  const totalBatchTasks = dailyBatch.tasks.length;
  const completionPercent = Math.round((completedTasks / totalBatchTasks) * 100);

  const openIssues = issues.filter(i => i.status === 'OPEN');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Executive Command Header */}
      <div className="glass-panel p-4 sm:p-8 bg-gradient-to-r from-[#121720] via-[#090c10] to-[#121720] border border-[#e39e2e]/30 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-[#e39e2e]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6 relative z-10">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="badge badge-gold font-mono text-[10px] sm:text-xs">Operations Command Center</span>
              <span className="text-[10px] sm:text-xs text-[#a7b0c0] font-mono">Date: {dailyBatch.date}</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-black text-[#eaf2ff] tracking-tight uppercase">
              Yaga Calls Multi-Creator Engine
            </h2>
            <p className="text-xs sm:text-sm text-[#a7b0c0] max-w-3xl leading-relaxed">
              Automated 3-batch Telegram dispatch hub managing <span className="text-white font-bold">{creators.length} Creators</span> across <span className="text-white font-bold">{platforms.length} Target Platforms</span>.
            </p>
          </div>

          <div className="flex items-center justify-between w-full lg:w-auto gap-3 sm:gap-4 bg-[#090c10] p-3 sm:p-4 rounded-2xl border border-white/10 shrink-0">
            <div className="text-left lg:text-right">
              <div className="text-[9px] sm:text-[10px] text-[#a7b0c0] uppercase font-bold tracking-widest">System Phase</div>
              <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#00d294] animate-pulse" />
                {systemSettings.systemPhase.replace('_', ' ')}
              </div>
            </div>
            <button
              onClick={onPhaseToggle}
              className="grad-button px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black shadow-lg cursor-pointer flex items-center gap-1.5 sm:gap-2"
            >
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              Toggle Phase
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        {/* Card 1: Onboarding Gate */}
        <div className="glass-card-interactive p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-[#a7b0c0] uppercase tracking-wider">Onboarding Gate</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#00d294]/15 border border-[#00d294]/30 flex items-center justify-center text-[#00d294]">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white">{activeAccountsCount}</span>
            <span className="text-xs text-[#a7b0c0] font-semibold">/ {totalRequiredAccounts} Accounts</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[#a7b0c0]">Readiness Gate</span>
              <span className="font-bold text-[#00d294]">{onboardingPercent}% Active</span>
            </div>
            <div className="w-full bg-[#090c10] h-2.5 rounded-full overflow-hidden border border-white/5">
              <div className="bg-gradient-to-r from-[#00d294] to-[#e39e2e] h-full" style={{ width: `${onboardingPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Card 2: Today's Dispatch */}
        <div className="glass-card-interactive p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-[#a7b0c0] uppercase tracking-wider">Today's Dispatch</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#e39e2e]/15 border border-[#e39e2e]/30 flex items-center justify-center text-[#e39e2e]">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white">{completedTasks}</span>
            <span className="text-xs text-[#a7b0c0] font-semibold">/ {totalBatchTasks} Tasks Done</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[#a7b0c0]">3-Batch Progress</span>
              <span className="font-bold text-[#e39e2e]">{completionPercent}% Done</span>
            </div>
            <div className="w-full bg-[#090c10] h-2.5 rounded-full overflow-hidden border border-white/5">
              <div className="bg-gradient-to-r from-[#e39e2e] to-[#d5b895] h-full" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Card 3: Active Creators */}
        <div className="glass-card-interactive p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-[#a7b0c0] uppercase tracking-wider">Active Team</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8]">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white">{creators.length}</span>
            <span className="text-xs text-[#a7b0c0] font-semibold">Creators Active</span>
          </div>
          <p className="text-xs text-slate-300 font-medium">
            Alex Vance, Elena Rostova, Marcus Thorne
          </p>
        </div>

        {/* Card 4: Issue Tickets */}
        <div className="glass-card-interactive p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-[#a7b0c0] uppercase tracking-wider">Support Desk</span>
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ${
              openIssues.length > 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-[#090c10] text-[#a7b0c0]'
            }`}>
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white">{openIssues.length}</span>
            <span className="text-xs text-[#a7b0c0] font-semibold">Open Problem Tickets</span>
          </div>
          <div className="text-xs font-bold">
            {openIssues.length > 0 ? (
              <span className="text-rose-400 cursor-pointer hover:underline flex items-center gap-1" onClick={() => onNavigateTab('issues')}>
                Requires Attention <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            ) : (
              <span className="text-[#00d294]">All Systems Operating Cleanly</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 3-Batch Timeline Visualizer (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#e39e2e]" />
                Staggered 3-Batch Engine
              </h3>
              <p className="text-xs text-[#a7b0c0]">
                Daily posts partitioned into 3 equal batches every 30 minutes.
              </p>
            </div>
            <button 
              onClick={() => onNavigateTab('studio')}
              className="px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#e39e2e]/10 border border-[#e39e2e]/35 hover:bg-[#e39e2e]/20 text-[#e39e2e] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-end sm:self-auto"
            >
              Open Studio <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
            {[1, 2, 3].map((batchNum) => {
              const batchTasks = dailyBatch.tasks.filter(t => t.batch === batchNum);
              const completed = batchTasks.filter(t => t.status === 'Completed').length;
              const total = batchTasks.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const batchKey = `batch${batchNum}Status`;
              const status = dailyBatch[batchKey] || 'PENDING';
              const timeLabel = batchNum === 1 ? '11:00 AM EST' : batchNum === 2 ? '11:30 AM EST' : '12:00 PM EST';
              const offsetLabel = batchNum === 1 ? 'T+0m' : batchNum === 2 ? '+30m' : '+60m';
              const isDone = status === 'COMPLETED' || pct === 100;
              const isActive = status === 'IN_PROGRESS' || status === 'DISPATCHED';
              const borderColor = isDone ? '[#00d294]/40' : isActive ? '[#e39e2e]/40' : 'white/10';
              const badgeClass = isDone ? 'badge-emerald' : isActive ? 'badge-gold' : 'badge-primary';
              const barColor = isDone ? '[#00d294]' : '[#e39e2e]';

              return (
                <div key={batchNum} className={`p-4 sm:p-5 rounded-2xl bg-[#090c10] border border-${borderColor} space-y-2.5 sm:space-y-3 relative overflow-hidden`}>
                  <div className="flex items-center justify-between">
                    <span className={`badge ${badgeClass} text-[10px]`}>Batch {batchNum} ({offsetLabel})</span>
                    {isDone ? <CheckCircle2 className="w-4 h-4 text-[#00d294]" /> : 
                     isActive ? <span className="w-2.5 h-2.5 rounded-full bg-[#e39e2e] animate-pulse" /> :
                     <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />}
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black text-white">
                      {batchNum === 1 ? 'Immediate' : batchNum === 2 ? 'Staggered' : 'Final'} Dispatch
                    </div>
                    <div className="text-xs text-[#a7b0c0] font-mono">
                      {total > 0 ? `${completed}/${total} done • ${timeLabel}` : `Awaiting dispatch • ${timeLabel}`}
                    </div>
                  </div>
                  <div className="w-full bg-[#121720] h-2 rounded-full overflow-hidden border border-white/5">
                    <div className={`bg-${barColor} h-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-[11px] font-bold ${isDone ? 'text-[#00d294]' : isActive ? 'text-[#e39e2e]' : 'text-slate-500'}`}>
                    {isDone ? 'All tasks completed' : isActive ? `${pct}% in progress` : total === 0 ? 'No tasks yet' : 'Waiting to dispatch'}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Task Completion Stream */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-black text-[#a7b0c0] uppercase tracking-wider">Live Task Completion Stream</div>
            <div className="space-y-2">
              {dailyBatch.tasks.slice(0, 4).map((task) => (
                <div key={task.id} className="p-3 sm:p-4 rounded-xl bg-[#090c10] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 text-xs">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-[#e39e2e] font-bold">{task.id}</span>
                    <span className="font-bold text-white text-sm">{task.creatorName}</span>
                    <span className="text-[#a7b0c0] font-medium">({task.platformName})</span>
                  </div>
                  <div className="flex items-center justify-between w-full sm:w-auto gap-3 self-end sm:self-auto">
                    <span className="text-[#a7b0c0] font-mono text-[11px]">{task.publishTime}</span>
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                      task.status === 'Completed' ? 'bg-[#00d294]/20 text-[#00d294] border border-[#00d294]/40' : 'bg-[#e39e2e]/20 text-[#e39e2e]'
                    }`}>
                      {task.status === 'Completed' ? '[Done]' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Active Creators Roster */}
        <div className="glass-panel p-4 sm:p-6 space-y-4">
          <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#e39e2e]" />
            Team Roster & Voice Status
          </h3>

          <div className="space-y-3">
            {creators.map((c) => (
              <div key={c.id} className="p-3.5 sm:p-4.5 rounded-2xl bg-[#090c10] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center font-black text-[#090c10] text-xs sm:text-sm shadow-md">
                      {c.publicName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-white">{c.publicName}</div>
                      <div className="text-[11px] sm:text-xs text-[#a7b0c0] font-medium">{c.title}</div>
                    </div>
                  </div>
                  <span className="badge badge-emerald text-[9px] sm:text-[10px]">Active</span>
                </div>
                <div className="text-xs text-slate-200 bg-[#121720] p-2.5 sm:p-3 rounded-xl border border-white/5 leading-relaxed font-sans">
                  <span className="text-[#a7b0c0] font-semibold text-[10px] block uppercase mb-0.5">Voice Style:</span>
                  {c.voiceProfile.tone}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigateTab('creators')}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-[#121720] hover:bg-[#19202d] text-white text-xs font-bold transition-all border border-white/10 cursor-pointer shadow-md"
          >
            Manage Creators & Vault ➔
          </button>
        </div>
      </div>
    </div>
  );
}

