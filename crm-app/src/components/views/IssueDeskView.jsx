import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  User, 
  Clock, 
  ShieldAlert, 
  MessageSquare,
  Sparkles
} from 'lucide-react';

export default function IssueDeskView({ issues, onResolveIssue }) {
  const [selectedIssue, setSelectedIssue] = useState(issues[0] || null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const openIssues = issues.filter(i => i.status === 'OPEN');
  const resolvedIssues = issues.filter(i => i.status === 'RESOLVED');

  const handleSendReply = async () => {
    if (!selectedIssue || !replyText.trim()) return;

    setIsSending(true);
    try {
      // Call Live Telegram Bot API endpoint to message creator in Telegram
      const res = await fetch('http://localhost:3001/api/reply-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selectedIssue.id,
          creatorId: selectedIssue.creatorId,
          replyText: replyText
        })
      });
      const data = await res.json();
      console.log('Reply API Response:', data);

      onResolveIssue(selectedIssue.id, replyText);
      setReplyText("");
    } catch (err) {
      console.error('Error sending Telegram reply:', err);
      onResolveIssue(selectedIssue.id, replyText);
      setReplyText("");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-rose">Support & Help Desk</span>
            <span className="text-xs font-mono text-slate-300">Live Telegram Sync</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2 uppercase">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            Telegram Issue Resolution Desk
          </h2>
          <p className="text-xs text-slate-400">
            Real-time problem ticket management. Send direct Telegram responses back to creators' personal Telegram chats.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#080a0f] border border-white/10 text-xs">
            <span className="text-slate-400 font-semibold">Open Tickets: </span>
            <span className="font-black text-rose-400 font-mono text-sm">{openIssues.length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-[#080a0f] border border-white/10 text-xs">
            <span className="text-slate-400 font-semibold">Resolved: </span>
            <span className="font-black text-[#00d294] font-mono text-sm">{resolvedIssues.length}</span>
          </div>
        </div>
      </div>

      {/* Main Support Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tickets List */}
        <div className="glass-panel p-5 space-y-4 border border-white/10">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            Incoming Telegram Tickets
          </h3>

          <div className="space-y-3">
            {issues.map((ticket) => {
              const isSelected = selectedIssue && selectedIssue.id === ticket.id;
              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedIssue(ticket)}
                  className={`p-4 rounded-xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#121722] border-[#e39e2e] shadow-lg shadow-[#e39e2e]/15'
                      : 'bg-[#080a0f] border-white/5 hover:bg-[#121722]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#e39e2e]">{ticket.id}</span>
                    <span className={`badge ${ticket.status === 'OPEN' ? 'badge-rose' : 'badge-emerald'} text-[10px]`}>
                      {ticket.status}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-white mt-2">{ticket.creatorName}</div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{ticket.description}</div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-3 pt-2 border-t border-white/5 font-mono">
                    <span>{ticket.platformName}</span>
                    <span>{ticket.createdAt}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Ticket Details & Telegram Reply */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-6 border border-white/10">
          {selectedIssue ? (
            <>
              {/* Ticket Top Info */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-[#e39e2e]">{selectedIssue.id}</span>
                    <span className={`badge ${selectedIssue.status === 'OPEN' ? 'badge-rose' : 'badge-emerald'}`}>
                      {selectedIssue.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">{selectedIssue.issueType}</h3>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                  <Clock className="w-4 h-4 text-[#e39e2e]" />
                  <span>Logged: {selectedIssue.createdAt}</span>
                </div>
              </div>

              {/* Creator Info Banner */}
              <div className="p-4 rounded-xl bg-[#080a0f] border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center font-black text-[#0b0e14]">
                    {selectedIssue.creatorName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{selectedIssue.creatorName}</div>
                    <div className="text-slate-400 font-mono text-[11px]">{selectedIssue.platformName} • Account ID: {selectedIssue.accountId}</div>
                  </div>
                </div>
                <span className="badge badge-cyan">Telegram Linked</span>
              </div>

              {/* Problem Description Box */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Creator Problem Description</span>
                <div className="p-4 rounded-xl bg-[#080a0f] border border-rose-500/30 text-slate-200 text-xs leading-relaxed font-sans">
                  "{selectedIssue.description}"
                </div>
              </div>

              {/* Existing Response or Response Form */}
              {selectedIssue.status === 'RESOLVED' ? (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-[#00d294] uppercase tracking-wider block flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Resolved Response Dispatched via Telegram
                  </span>
                  <div className="p-4 rounded-xl bg-[#00d294]/10 border border-[#00d294]/30 text-slate-200 text-xs leading-relaxed font-mono">
                    "{selectedIssue.ownerResponse}"
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#e39e2e]" />
                    Dispatch Owner Resolution Reply (Sends Live Message to Creator's Telegram)
                  </span>

                  <textarea
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your resolution instructions or confirmation here. This text will be sent directly to the creator's Telegram chat..."
                    className="w-full bg-[#080a0f] text-slate-200 text-xs p-4 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none resize-none leading-relaxed font-sans"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={handleSendReply}
                      disabled={isSending || !replyText.trim()}
                      className="grad-button px-6 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {isSending ? 'Sending to Telegram...' : 'Dispatch Reply via Telegram & Resolve Ticket'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
              <ShieldAlert className="w-10 h-10 text-slate-600 mb-2" />
              <span>Select an issue ticket from the left panel to inspect details.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
