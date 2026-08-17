import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Target, 
  Flame, 
  Zap, 
  Image as ImageIcon, 
  Edit3, 
  X,
  Send,
  Award,
  Layers,
  Calendar
} from 'lucide-react';
import Pagination, { usePagination } from '../Pagination';

export default function TradeSignalsDeskView() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [timeframe, setTimeframe] = useState("ALL"); // ALL | THIS_WEEK | THIS_MONTH | QUARTERLY | HALF_YEARLY | YEARLY
  const [selectedAudience, setSelectedAudience] = useState("ALL"); // ALL | HIGH_TABLE_VIP_ONLY | FREE_AND_VIP
  const [selectedStatus, setSelectedStatus] = useState("ALL"); // ALL | ACTIVE | WIN | LOSS

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // New Signal Form State
  const [newSymbol, setNewSymbol] = useState("");
  const [newEntry, setNewEntry] = useState("");
  const [newTp, setNewTp] = useState("");
  const [newSl, setNewSl] = useState("");
  const [newLeverage, setNewLeverage] = useState("1x-3x");
  const [newAudience, setNewAudience] = useState("HIGH_TABLE_VIP_ONLY");
  const [newNotes, setNewNotes] = useState("");
  const [newChartUrl, setNewChartUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Close Signal Form State
  const [closingSignal, setClosingSignal] = useState(null);
  const [closeStatusType, setCloseStatusType] = useState("TP2"); // TP1 | TP2 | TPF | SL | CUSTOM
  const [closePnlVal, setClosePnlVal] = useState("120");

  // Edit Signal Form State
  const [editingSignal, setEditingSignal] = useState(null);
  const [editSymbol, setEditSymbol] = useState("");
  const [editEntry, setEditEntry] = useState("");
  const [editTp, setEditTp] = useState("");
  const [editSl, setEditSl] = useState("");
  const [editLeverage, setEditLeverage] = useState("1x-3x");
  const [editAudience, setEditAudience] = useState("HIGH_TABLE_VIP_ONLY");
  const [editNotes, setEditNotes] = useState("");
  const [editChartUrl, setEditChartUrl] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editPnlVal, setEditPnlVal] = useState("0");

  useEffect(() => {
    fetchSignals();
  }, []);

  async function fetchSignals() {
    setLoading(true);
    try {
      // Page through results instead of a single unbounded .select('*') —
      // Supabase/PostgREST silently caps unranged queries at 1000 rows, so
      // as the signal log grows past that, older signals would silently
      // disappear from this desk with no error shown.
      const PAGE_SIZE = 1000;
      let allSignals = [];
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: page, error } = await supabase
          .from('trade_signals_log')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          console.error('Error fetching trade signals:', error);
          break;
        }
        if (!page || page.length === 0) break;
        allSignals = allSignals.concat(page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setSignals(allSignals);
    } catch (err) {
      console.error('fetchSignals exception:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSignals();
  };

  // Timeframe Filter Helper
  const filteredSignals = useMemo(() => {
    const now = new Date();

    return signals.filter(s => {
      // Search term filter
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search ||
        (s.symbol && s.symbol.toLowerCase().includes(search)) ||
        (s.entry_range && s.entry_range.toLowerCase().includes(search)) ||
        (s.custom_notes && s.custom_notes.toLowerCase().includes(search));

      // Audience Filter
      const matchesAudience = selectedAudience === "ALL" || s.target_audience === selectedAudience;

      // Status Filter
      let matchesStatus = true;
      if (selectedStatus === "ACTIVE") matchesStatus = s.status === "ACTIVE";
      else if (selectedStatus === "WIN") matchesStatus = s.status !== "ACTIVE" && Number(s.pnl_percentage || 0) > 0;
      else if (selectedStatus === "LOSS") matchesStatus = s.status !== "ACTIVE" && Number(s.pnl_percentage || 0) <= 0;

      // Timeframe Filter
      let matchesTimeframe = true;
      if (timeframe !== "ALL") {
        const createdAt = new Date(s.created_at);
        const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24);

        if (timeframe === "THIS_WEEK") matchesTimeframe = diffDays <= 7;
        else if (timeframe === "THIS_MONTH") matchesTimeframe = diffDays <= 30;
        else if (timeframe === "QUARTERLY") matchesTimeframe = diffDays <= 90;
        else if (timeframe === "HALF_YEARLY") matchesTimeframe = diffDays <= 180;
        else if (timeframe === "YEARLY") matchesTimeframe = diffDays <= 365;
      }

      return matchesSearch && matchesAudience && matchesStatus && matchesTimeframe;
    });
  }, [signals, searchTerm, timeframe, selectedAudience, selectedStatus]);

  // Overall Trade Performance Calculations
  const stats = useMemo(() => {
    let totalCalls = filteredSignals.length;
    let activeCalls = 0;
    let closedCalls = 0;
    let winningCalls = 0;
    let losingCalls = 0;
    let totalPnl = 0;
    let totalWinPnl = 0;
    let totalLossPnl = 0;
    let bestWin = 0;
    let maxLoss = 0;

    filteredSignals.forEach(s => {
      if (s.status === 'ACTIVE') {
        activeCalls++;
      } else {
        closedCalls++;
        const pnl = Number(s.pnl_percentage || 0);
        totalPnl += pnl;

        if (pnl > 0) {
          winningCalls++;
          totalWinPnl += pnl;
          if (pnl > bestWin) bestWin = pnl;
        } else {
          losingCalls++;
          totalLossPnl += pnl;
          if (pnl < maxLoss) maxLoss = pnl;
        }
      }
    });

    const winRate = closedCalls > 0 ? Number(((winningCalls / closedCalls) * 100).toFixed(1)) : 0;
    const avgWin = winningCalls > 0 ? Number((totalWinPnl / winningCalls).toFixed(1)) : 0;
    const avgLoss = losingCalls > 0 ? Number((totalLossPnl / losingCalls).toFixed(1)) : 0;

    return {
      totalCalls,
      activeCalls,
      closedCalls,
      winningCalls,
      losingCalls,
      winRate,
      totalPnl: Number(totalPnl.toFixed(2)),
      avgWin,
      avgLoss,
      bestWin,
      maxLoss
    };
  }, [filteredSignals]);

  // Bound the DOM to one page of rows at a time instead of rendering every
  // filtered signal at once.
  const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages, pageItems: paginatedSignals } = usePagination(filteredSignals);

  // Image Upload to Supabase Storage
  async function handleFileUpload(e, setUrlState) {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `signal_chart_${Date.now()}.${fileExt}`;
      const filePath = `signals/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('reviews')
        .upload(filePath, file);

      if (uploadErr) {
        alert('Image upload failed: ' + uploadErr.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('reviews')
          .getPublicUrl(filePath);

        setUrlState(publicUrlData.publicUrl);
      }
    } catch (err) {
      alert('Error uploading image: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  }

  // Helper function to call Telegram API from CRM
  async function callTelegramApi(method, payload) {
    const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || (typeof process !== 'undefined' ? process.env.TELEGRAM_BOT_TOKEN : '');
    if (!BOT_TOKEN) {
      console.warn('Telegram Bot Token not configured in VITE_TELEGRAM_BOT_TOKEN environment variable.');
      return { ok: false };
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('Telegram API error from CRM:', e);
      return { ok: false };
    }
  }

  // Create Trade Signal Handler with Live Broadcast to Telegram Channels
  async function handleCreateSignal(e) {
    e.preventDefault();
    if (!newSymbol || !newEntry) return alert('Please enter Symbol and Entry Range.');

    const sigId = `SIG-${Date.now().toString().substring(5)}`;
    const symClean = newSymbol.trim().toUpperCase().replace(/^\$/, '');
    
    // Format aesthetic markdown card
    let card = `💰 *$${symClean} TRADING SIGNAL*\n\n`;
    card += `📍 *ENTRY:* \`${newEntry.trim()}\`\n`;
    card += `🎯 *TP:* \`${newTp.trim() || 'Open Target'}\`\n`;
    card += `🛑 *SL:* \`${newSl.trim() || 'Strict SL'}\`\n`;
    card += `⚡️ *LEVERAGE:* \`${newLeverage.trim() || '1x-3x'}\`\n`;

    if (newNotes.trim()) {
      card += `\n💡 *SPECIALIZED SETUP NOTES:*\n_${newNotes.trim()}_\n`;
    }

    let vipMsgId = null;
    let freeMsgId = null;

    // 1. Broadcast live to High Table VIP (-1002607815374)
    if (newChartUrl.trim()) {
      const resVip = await callTelegramApi('sendPhoto', {
        chat_id: '-1002607815374',
        photo: newChartUrl.trim(),
        caption: card,
        parse_mode: 'Markdown'
      });
      if (resVip.ok && resVip.result) vipMsgId = resVip.result.message_id;
    } else {
      const resVip = await callTelegramApi('sendMessage', {
        chat_id: '-1002607815374',
        text: card,
        parse_mode: 'Markdown'
      });
      if (resVip.ok && resVip.result) vipMsgId = resVip.result.message_id;
    }

    // 2. Broadcast live to Free Group (-1002628054504) if target is BOTH
    if (newAudience === 'FREE_AND_VIP') {
      if (newChartUrl.trim()) {
        const resFree = await callTelegramApi('sendPhoto', {
          chat_id: '-1002628054504',
          photo: newChartUrl.trim(),
          caption: card,
          parse_mode: 'Markdown'
        });
        if (resFree.ok && resFree.result) freeMsgId = resFree.result.message_id;
      } else {
        const resFree = await callTelegramApi('sendMessage', {
          chat_id: '-1002628054504',
          text: card,
          parse_mode: 'Markdown'
        });
        if (resFree.ok && resFree.result) freeMsgId = resFree.result.message_id;
      }
    }

    // 3. Write record to Supabase PostgreSQL DB
    const { error } = await supabase.from('trade_signals_log').insert([{
      id: sigId,
      symbol: symClean,
      creator_type: 'OWNER',
      creator_name: 'CRM Web Desk',
      target_audience: newAudience,
      entry_range: newEntry.trim(),
      take_profit_targets: newTp.trim() || 'Open Target',
      stop_loss: newSl.trim() || 'Strict SL',
      leverage: newLeverage.trim() || '1x-3x',
      custom_notes: newNotes.trim(),
      chart_image_url: newChartUrl.trim() || null,
      status: 'ACTIVE',
      pnl_percentage: 0.00,
      vip_group_message_id: vipMsgId,
      free_group_message_id: freeMsgId,
      created_at: new Date().toISOString()
    }]);

    if (error) {
      alert('Error saving signal to DB: ' + error.message);
    } else {
      alert(`🚀 Trade Signal $${symClean} broadcasted live to Telegram channel(s) and logged to CRM!`);
      setIsCreateModalOpen(false);
      setNewSymbol("");
      setNewEntry("");
      setNewTp("");
      setNewSl("");
      setNewNotes("");
      setNewChartUrl("");
      fetchSignals();
    }
  }

  // Close Signal / Log Result Handler with Live Reply Dispatch
  async function handleCloseSignalSubmit(e) {
    e.preventDefault();
    if (!closingSignal) return;

    const pnlVal = Number(closePnlVal) || 0;
    let label = 'COMPLETED';
    let badge = '🔥 TP Hit!';

    if (closeStatusType === 'TP1') { label = 'TP1_HIT'; badge = '🔥 TP1 HIT'; }
    else if (closeStatusType === 'TP2') { label = 'TP2_HIT'; badge = '🚀 TP2 SMASHED!'; }
    else if (closeStatusType === 'TPF') { label = 'TP_FINAL_HIT'; badge = '🌕 FINAL TP SMASHED!'; }
    else if (closeStatusType === 'SL') { label = 'SL_HIT'; badge = '🛑 STOP LOSS HIT'; }

    const pnlFormatted = pnlVal > 0 ? `+${pnlVal.toFixed(2)}%` : `${pnlVal.toFixed(2)}%`;
    const summaryText = `${badge} (${pnlFormatted})`;

    const resultText = `🎯 *TRADE CALL RESULT ANNOUNCEMENT — $${closingSignal.symbol}*\n\nStatus: *${badge}*\nProfit / PnL: *${pnlFormatted}* ${pnlVal > 0 ? '🚀' : '🛑'}\n\nCongratulations to everyone who took this trade setup!`;

    // Dispatch reply to High Table VIP
    if (closingSignal.vip_group_message_id) {
      await callTelegramApi('sendMessage', {
        chat_id: '-1002607815374',
        text: resultText,
        reply_to_message_id: Number(closingSignal.vip_group_message_id),
        parse_mode: 'Markdown'
      });
    }

    // Dispatch reply to Free Group if applicable
    if (closingSignal.target_audience === 'FREE_AND_VIP' && closingSignal.free_group_message_id) {
      await callTelegramApi('sendMessage', {
        chat_id: '-1002628054504',
        text: resultText,
        reply_to_message_id: Number(closingSignal.free_group_message_id),
        parse_mode: 'Markdown'
      });
    }

    const { error } = await supabase.from('trade_signals_log').update({
      status: label,
      pnl_percentage: pnlVal,
      pnl_summary_text: summaryText,
      closed_at: new Date().toISOString()
    }).eq('id', closingSignal.id);

    if (error) {
      alert('Error closing signal: ' + error.message);
    } else {
      alert(`🎉 Successfully closed signal $${closingSignal.symbol} with ${summaryText} & published result announcement to channel(s)!`);
      setIsCloseModalOpen(false);
      setClosingSignal(null);
      fetchSignals();
    }
  }

  // Edit Signal Handler
  async function handleSaveEditSignal(e) {
    e.preventDefault();
    if (!editingSignal) return;

    const pnlVal = Number(editPnlVal) || 0;
    const pnlFormatted = pnlVal > 0 ? `+${pnlVal.toFixed(2)}%` : `${pnlVal.toFixed(2)}%`;
    const summaryText = editStatus === 'ACTIVE' ? null : `${editStatus} (${pnlFormatted})`;

    const { error } = await supabase.from('trade_signals_log').update({
      symbol: editSymbol.trim().toUpperCase().replace(/^\$/, ''),
      entry_range: editEntry.trim(),
      take_profit_targets: editTp.trim(),
      stop_loss: editSl.trim(),
      leverage: editLeverage.trim(),
      target_audience: editAudience,
      custom_notes: editNotes.trim(),
      chart_image_url: editChartUrl.trim() || null,
      status: editStatus,
      pnl_percentage: pnlVal,
      pnl_summary_text: summaryText
    }).eq('id', editingSignal.id);

    if (error) {
      alert('Error updating signal: ' + error.message);
    } else {
      alert(`🎉 Successfully updated signal $${editSymbol.toUpperCase()}!`);
      setIsEditModalOpen(false);
      setEditingSignal(null);
      fetchSignals();
    }
  }

  // Delete Signal Handler
  async function handleDeleteSignal(id, symbol) {
    if (!window.confirm(`⚠️ Are you sure you want to delete trade signal "$${symbol}"?`)) return;

    const { error } = await supabase.from('trade_signals_log').delete().eq('id', id);
    if (error) {
      alert('Error deleting signal: ' + error.message);
    } else {
      setSignals(prev => prev.filter(s => s.id !== id));
    }
  }

  // Export CSV Handler
  const exportToCSV = () => {
    if (filteredSignals.length === 0) return alert('No trade signal data to export.');
    const headers = ["Symbol", "Target Group", "Entry Range", "Take Profit Targets", "Stop Loss", "Leverage", "Status", "PnL %", "Custom Notes", "Date Posted", "Date Closed"];
    const rows = filteredSignals.map(s => [
      `"$${s.symbol}"`,
      `"${s.target_audience}"`,
      `"${s.entry_range}"`,
      `"${s.take_profit_targets}"`,
      `"${s.stop_loss}"`,
      `"${s.leverage}"`,
      `"${s.status}"`,
      s.pnl_percentage || 0,
      `"${(s.custom_notes || '').replace(/"/g, '""')}"`,
      `"${new Date(s.created_at).toLocaleDateString()}"`,
      `"${s.closed_at ? new Date(s.closed_at).toLocaleDateString() : '-'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Trade_Signals_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-slate-900 border border-emerald-500/20 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-lg shadow-emerald-500/20 text-slate-950">
            <BarChart3 className="w-8 h-8 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Trade Signals & Performance</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Trade Tracking
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Track active trading signals, log profit/loss performance, broadcast result cards, and view consolidated PnL reports.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl border border-slate-700/50 transition-all shadow-sm"
            title="Refresh Trade Signals"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm border border-slate-700/60 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Post Trade Signal</span>
          </button>
        </div>
      </div>

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Trade Win Rate</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.winRate}%</div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.winningCalls} Wins / {stats.losingCalls} Losses ({stats.closedCalls} Closed Trades)
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Cumulative PnL Return</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {stats.totalPnl >= 0 ? `+${stats.totalPnl}%` : `${stats.totalPnl}%`}
          </div>
          <div className="text-xs text-slate-500 mt-1">Consolidated Net Profit / Loss %</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Active Calls / Closed</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            <span className="text-amber-400">{stats.activeCalls} Active</span>
            <span className="text-slate-600 mx-1.5">/</span>
            <span className="text-slate-400 text-lg font-normal">{stats.closedCalls} Closed</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Currently Open Trade Signals</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase">Avg Win vs Avg Loss</span>
            <Zap className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span className="text-emerald-400">+{stats.avgWin}%</span>
            <span className="text-slate-600 font-normal text-xs">vs</span>
            <span className="text-red-400">{stats.avgLoss}%</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Best Win: +{stats.bestWin}%</div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl shadow-lg space-y-3 md:space-y-0 md:flex md:items-center md:justify-between gap-4 backdrop-blur-md">
        {/* Search Box */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search symbol e.g. $KGEN, BTC, SOL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500/50 text-slate-200 text-sm pl-10 pr-4 py-2 rounded-xl focus:outline-none transition-all placeholder:text-slate-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">All Time Reports</option>
              <option value="THIS_WEEK">📅 This Week (7 Days)</option>
              <option value="THIS_MONTH">📅 This Month (30 Days)</option>
              <option value="QUARTERLY">📅 Quarterly (90 Days)</option>
              <option value="HALF_YEARLY">📅 Half-Yearly (180 Days)</option>
              <option value="YEARLY">📅 Yearly (365 Days)</option>
            </select>
          </div>

          {/* Group Audience Filter */}
          <select
            value={selectedAudience}
            onChange={(e) => setSelectedAudience(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500/50"
          >
            <option value="ALL">All Target Groups</option>
            <option value="HIGH_TABLE_VIP_ONLY">👑 High Table VIP Only</option>
            <option value="FREE_AND_VIP">📢 Free & High Table VIP</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500/50"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">🔥 Active Calls Only</option>
            <option value="WIN">🚀 Winning Trades (+PnL)</option>
            <option value="LOSS">🛑 Stop Loss / Loss Trades</option>
          </select>
        </div>
      </div>

      {/* Main Signal Roster Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <span className="text-sm">Loading Trade Signal Roster...</span>
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <BarChart3 className="w-10 h-10 text-slate-600 mx-auto stroke-[1.5]" />
            <div className="text-base font-medium text-slate-300">No Trade Signals Found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || timeframe !== "ALL" || selectedAudience !== "ALL" || selectedStatus !== "ALL"
                ? "Try adjusting your search terms or timeframe filters."
                : "Post your first trade signal using the button above or Telegram Bot (@yagacontentbot)!"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th scope="col" className="py-3.5 px-4">Symbol & Setup Chart</th>
                  <th scope="col" className="py-3.5 px-4">Target Group</th>
                  <th scope="col" className="py-3.5 px-4">Entry / TP / SL / Lev</th>
                  <th scope="col" className="py-3.5 px-4">Custom Notes</th>
                  <th scope="col" className="py-3.5 px-4">Status & PnL %</th>
                  <th scope="col" className="py-3.5 px-4">Date Posted</th>
                  <th scope="col" className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {paginatedSignals.map((s) => {
                  const pnl = Number(s.pnl_percentage || 0);
                  const isWin = pnl > 0;
                  const isActive = s.status === 'ACTIVE';

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors group">
                      {/* Symbol & Image */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {s.chart_image_url ? (
                            <a href={s.chart_image_url} target="_blank" rel="noreferrer" className="block relative">
                              <img src={s.chart_image_url} alt={s.symbol} className="w-10 h-10 object-cover rounded-xl border border-slate-700/60 hover:scale-105 transition-transform" />
                            </a>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-sm">
                              ${s.symbol.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span>${s.symbol}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">ID: {s.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Target Group */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                          s.target_audience === 'FREE_AND_VIP'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {s.target_audience === 'FREE_AND_VIP' ? '📢 Free & VIP' : '👑 High Table VIP'}
                        </span>
                      </td>

                      {/* Entry / TP / SL / Lev */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs space-y-0.5 font-mono">
                          <div className="text-slate-300">📍 Entry: <span className="text-slate-100 font-semibold">{s.entry_range}</span></div>
                          <div className="text-emerald-400">🎯 TP: {s.take_profit_targets}</div>
                          <div className="text-red-400">🛑 SL: {s.stop_loss} ({s.leverage || '1x-3x'})</div>
                        </div>
                      </td>

                      {/* Custom Notes */}
                      <td className="py-3.5 px-4">
                        <p className="text-xs text-slate-400 max-w-xs truncate italic">
                          {s.custom_notes ? `"${s.custom_notes}"` : '-'}
                        </p>
                      </td>

                      {/* Status & PnL % */}
                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
                            <Clock className="w-3.5 h-3.5 animate-pulse" /> Active Trade
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold ${
                              isWin ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {isWin ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {s.pnl_summary_text || (isWin ? `+${pnl}%` : `${pnl}%`)}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Date Posted */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-slate-400 space-y-0.5">
                          <div>Posted: {new Date(s.created_at).toLocaleDateString()}</div>
                          {s.closed_at && <div className="text-slate-500">Closed: {new Date(s.closed_at).toLocaleDateString()}</div>}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isActive && (
                            <button
                              onClick={() => {
                                setClosingSignal(s);
                                setClosePnlVal("120");
                                setCloseStatusType("TP2");
                                setIsCloseModalOpen(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold transition-colors"
                              title="Log Result & Close Signal"
                            >
                              <Target className="w-3.5 h-3.5" /> Close Result
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingSignal(s);
                              setEditSymbol(s.symbol || "");
                              setEditEntry(s.entry_range || "");
                              setEditTp(s.take_profit_targets || "");
                              setEditSl(s.stop_loss || "");
                              setEditLeverage(s.leverage || "1x-3x");
                              setEditAudience(s.target_audience || "HIGH_TABLE_VIP_ONLY");
                              setEditNotes(s.custom_notes || "");
                              setEditChartUrl(s.chart_image_url || "");
                              setEditStatus(s.status || "ACTIVE");
                              setEditPnlVal(s.pnl_percentage || "0");
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 transition-colors"
                            title="Edit Signal Details"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          <button
                            onClick={() => handleDeleteSignal(s.id, s.symbol)}
                            className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete Signal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filteredSignals.length > 0 && (
        <Pagination
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={setItemsPerPage}
          totalCount={filteredSignals.length}
          itemLabel="signals"
        />
      )}

      {/* --- CREATE NEW TRADE SIGNAL MODAL --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Post New Trade Signal</h3>
                  <p className="text-xs text-slate-500">Log setup and broadcast to Telegram groups</p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSignal} className="space-y-4">
              {/* Symbol & Target Group */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Symbol *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KGEN or BTC"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Target Channel Group *
                  </label>
                  <select
                    value={newAudience}
                    onChange={(e) => setNewAudience(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  >
                    <option value="HIGH_TABLE_VIP_ONLY">👑 High Table VIP Only</option>
                    <option value="FREE_AND_VIP">📢 Both Free & High Table VIP</option>
                  </select>
                </div>
              </div>

              {/* Entry Range & TP Targets */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Entry Range *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0.24 - 0.20"
                    value={newEntry}
                    onChange={(e) => setNewEntry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Take Profit Targets
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0.35 - 0.70"
                    value={newTp}
                    onChange={(e) => setNewTp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-emerald-400 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Stop Loss & Leverage */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Stop Loss (SL)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0.13"
                    value={newSl}
                    onChange={(e) => setNewSl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-red-400 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Leverage
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1x-3x"
                    value={newLeverage}
                    onChange={(e) => setNewLeverage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Custom Notes / Analysis Commentary */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Specialized Setup Notes / Commentary
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Forming a bullish falling wedge on the 4H chart..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

              {/* Optional Setup Chart Photo */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Optional Chart Image (Upload or Paste URL)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={newChartUrl}
                    onChange={(e) => setNewChartUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-xs px-3.5 py-2 rounded-xl focus:outline-none font-mono"
                  />
                  <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-1.5 border border-slate-700">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{uploadingImage ? 'Uploading...' : 'Upload'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setNewChartUrl)} />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  Confirm & Save Signal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CLOSE SIGNAL / LOG RESULT MODAL --- */}
      {isCloseModalOpen && closingSignal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-slate-100">Log Result for ${closingSignal.symbol}</h3>
              </div>
              <button onClick={() => setIsCloseModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseSignalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Select Result Outcome
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setCloseStatusType("TP1"); setClosePnlVal("45"); }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      closeStatusType === "TP1" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md" : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    🔥 TP1 Hit (+45%)
                  </button>

                  <button
                    type="button"
                    onClick={() => { setCloseStatusType("TP2"); setClosePnlVal("120"); }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      closeStatusType === "TP2" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md" : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    🚀 TP2 Smashed (+120%)
                  </button>

                  <button
                    type="button"
                    onClick={() => { setCloseStatusType("TPF"); setClosePnlVal("250"); }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      closeStatusType === "TPF" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md" : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    🌕 Final TP (+250%)
                  </button>

                  <button
                    type="button"
                    onClick={() => { setCloseStatusType("SL"); setClosePnlVal("-15"); }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      closeStatusType === "SL" ? "bg-red-500/20 border-red-500 text-red-400 shadow-md" : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    🛑 SL Hit (-15%)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Profit / Loss Percentage (PnL %) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={closePnlVal}
                  onChange={(e) => setClosePnlVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-emerald-400 font-bold text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-md"
                >
                  Confirm & Close Signal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT SIGNAL MODAL --- */}
      {isEditModalOpen && editingSignal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100">Edit Trade Signal ${editingSignal.symbol}</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSignal} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Symbol
                  </label>
                  <input
                    type="text"
                    required
                    value={editSymbol}
                    onChange={(e) => setEditSymbol(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  >
                    <option value="ACTIVE">🔥 Active Call</option>
                    <option value="TP1_HIT">🔥 TP1 Hit</option>
                    <option value="TP2_HIT">🚀 TP2 Smashed</option>
                    <option value="TP_FINAL_HIT">🌕 Final TP Hit</option>
                    <option value="SL_HIT">🛑 Stop Loss Hit</option>
                    <option value="CANCELLED">❌ Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Entry Range
                  </label>
                  <input
                    type="text"
                    required
                    value={editEntry}
                    onChange={(e) => setEditEntry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    PnL Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPnlVal}
                    onChange={(e) => setEditPnlVal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-emerald-400 font-bold text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    TP Targets
                  </label>
                  <input
                    type="text"
                    value={editTp}
                    onChange={(e) => setEditTp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Stop Loss
                  </label>
                  <input
                    type="text"
                    value={editSl}
                    onChange={(e) => setEditSl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Custom Setup Notes
                </label>
                <textarea
                  rows="2"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

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
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
