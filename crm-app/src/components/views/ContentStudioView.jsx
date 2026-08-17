import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  CalendarDays, 
  Send, 
  Plus, 
  Sparkles, 
  Image as ImageIcon, 
  Clock, 
  CheckCircle2, 
  FileText,
  ExternalLink,
  Trash2,
  Layers,
  Check,
  FileSpreadsheet,
  Upload,
  Bold,
  Italic,
  List,
  CalendarPlus,
  Loader2,
  UserCheck,
  UserX,
  UserPlus,
  AlertTriangle
} from 'lucide-react';
import { SkeletonCardList } from '../Skeleton';

// Platform Character & Headline Limits Table
const PLATFORM_LIMITS = {
  'PL-X': { name: 'X (Twitter)', maxBody: 280, maxHeadline: 0, maxSubheadline: 0 },
  'PL-LINKEDIN': { name: 'LinkedIn', maxBody: 3000, maxHeadline: 120, maxSubheadline: 0 },
  'PL-MEDIUM': { name: 'Medium', maxBody: 25000, maxHeadline: 100, maxSubheadline: 140 },
  'PL-BINANCE': { name: 'Binance Square', maxBody: 5000, maxHeadline: 100, maxSubheadline: 0 },
  'PL-[#CMC]': { name: 'CMC Community', maxBody: 5000, maxHeadline: 100, maxSubheadline: 0 },
  'DEFAULT': { name: 'Social Platform', maxBody: 2000, maxHeadline: 100, maxSubheadline: 0 }
};

function getPlatformLimit(platformId) {
  return PLATFORM_LIMITS[platformId] || PLATFORM_LIMITS['DEFAULT'];
}

function getCharCountBadge(currentLength, maxLength) {
  if (!maxLength) return null;
  const pct = (currentLength / maxLength) * 100;
  let colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (pct > 100) {
    colorClass = 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse';
  } else if (pct >= 85) {
    colorClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  }

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${colorClass}`}>
      {currentLength} / {maxLength} chars {pct > 100 ? '⚠️ OVER LIMIT' : ''}
    </span>
  );
}

export default function ContentStudioView({ creators, platforms, dailyBatch, onSendToTeam }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [availableDates, setAvailableDates] = useState([]);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isNewTopicModalOpen, setIsNewTopicModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Bulk Import text & options state
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [bulkSelectedCreators, setBulkSelectedCreators] = useState([]);

  // Single Topic Form state (with Headline, Subheadline, Body Content)
  const [newTopic, setNewTopic] = useState("");
  const [newHeadline, setNewHeadline] = useState("");
  const [newSubheadline, setNewSubheadline] = useState("");
  const [newBodyContent, setNewBodyContent] = useState("");
  const [newPlatformId, setNewPlatformId] = useState("PL-X");
  const [newContentType, setNewContentType] = useState("Text Post");
  const [newSlot, setNewSlot] = useState("11:00 AM EST");
  const [newDriveLink, setNewDriveLink] = useState("");
  const [newSelectedCreators, setNewSelectedCreators] = useState([]);

  // Content Rows from Supabase
  const [contentRows, setContentRows] = useState([]);

  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 4000);
  };

  useEffect(() => {
    if (creators && creators.length > 0) {
      const activeIds = creators.filter(c => c.active).map(c => c.id);
      setNewSelectedCreators(activeIds);
      setBulkSelectedCreators(activeIds);
    }
  }, [creators]);

  // ── FETCH AVAILABLE DATES ──
  useEffect(() => {
    async function fetchDates() {
      const { data } = await supabase
        .from('content_days')
        .select('date')
        .order('date', { ascending: false })
        .limit(10);
      
      const dates = (data || []).map(d => d.date);
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const allDates = [...new Set([...dates, today, tomorrowStr])].sort().reverse();
      setAvailableDates(allDates);
    }
    fetchDates();
  }, []);

  // ── FETCH CONTENT FOR SELECTED DATE FROM SUPABASE ──
  const fetchContentForDate = useCallback(async (dateStr) => {
    setLoading(true);
    const dayId = `DAY-${dateStr.replace(/-/g, '')}`;

    try {
      const { data: baseContent } = await supabase
        .from('base_content')
        .select('*')
        .eq('day_id', dayId)
        .order('created_at');

      if (!baseContent || baseContent.length === 0) {
        setContentRows([]);
        setLoading(false);
        return;
      }

      const contentIds = baseContent.map(c => c.id);
      const { data: captions } = await supabase
        .from('creator_captions')
        .select('*')
        .in('content_id', contentIds);

      const rows = baseContent.map(bc => {
        const platform = platforms.find(p => p.id === bc.platform_id);
        const rowCaptions = {};
        (captions || [])
          .filter(cap => cap.content_id === bc.id)
          .forEach(cap => { rowCaptions[cap.creator_id] = cap.caption; });

        return {
          id: bc.id,
          platformId: bc.platform_id,
          platformName: platform?.name || bc.platform_id,
          contentType: bc.content_type,
          slot: bc.publish_time || bc.slot || '11:00 AM EST',
          sharedTopic: bc.shared_topic,
          headline: bc.headline || '',
          subheadline: bc.subheadline || '',
          bodyContent: bc.body_content || '',
          driveLink: bc.drive_link || '',
          creatorCaptions: rowCaptions
        };
      });

      setContentRows(rows);
    } catch (err) {
      console.error('Error fetching content:', err);
    }
    setLoading(false);
  }, [platforms]);

  useEffect(() => {
    if (selectedDate && platforms.length > 0) {
      fetchContentForDate(selectedDate);
    }
  }, [selectedDate, platforms, fetchContentForDate]);

  // ── SAVE SINGLE TOPIC TO SUPABASE ──
  const handleAddTopic = async (e) => {
    e.preventDefault();
    if (!newTopic.trim()) return;
    setSaving(true);

    const dayId = `DAY-${selectedDate.replace(/-/g, '')}`;
    const platformObj = platforms.find(p => p.id === newPlatformId) || { name: "X (Twitter)" };
    
    const existingCount = contentRows.length;
    const newId = `CNT-${selectedDate.replace(/-/g, '')}-${String(existingCount + 1).padStart(3, '0')}`;

    try {
      const { error: dayError } = await supabase.from('content_days').upsert({
        id: dayId,
        date: selectedDate,
        status: 'Draft',
        total_assignments: existingCount + 1
      }, { onConflict: 'id' });
      if (dayError) throw dayError;

      // Build initial caption from Headline + Subheadline + Body Content or Topic
      let defaultCaptionText = '';
      if (newHeadline) defaultCaptionText += `**${newHeadline.toUpperCase()}**\n\n`;
      if (newSubheadline) defaultCaptionText += `_${newSubheadline}_\n\n`;
      if (newBodyContent) defaultCaptionText += `${newBodyContent}`;
      else defaultCaptionText += `**${platformObj.name}:** ${newTopic}`;

      const { error: contentError } = await supabase.from('base_content').insert({
        id: newId,
        day_id: dayId,
        platform_id: newPlatformId,
        content_type: newContentType,
        slot: newSlot,
        publish_time: newSlot,
        shared_topic: newTopic,
        headline: newHeadline || null,
        subheadline: newSubheadline || null,
        body_content: newBodyContent || null,
        drive_link: newDriveLink || null
      });
      if (contentError) throw contentError;

      const targetCreatorIds = newSelectedCreators.length > 0 ? newSelectedCreators : creators.map(c => c.id);
      const captionInserts = targetCreatorIds.map(cId => ({
        content_id: newId,
        creator_id: cId,
        caption: defaultCaptionText,
        headline: newHeadline || null,
        subheadline: newSubheadline || null
      }));

      if (captionInserts.length > 0) {
        const { error: captionError } = await supabase.from('creator_captions').insert(captionInserts);
        if (captionError) throw captionError;
      }

      // Reset form
      setNewTopic("");
      setNewHeadline("");
      setNewSubheadline("");
      setNewBodyContent("");
      setNewDriveLink("");
      setIsNewTopicModalOpen(false);
      await fetchContentForDate(selectedDate);

      if (!availableDates.includes(selectedDate)) {
        setAvailableDates(prev => [...new Set([...prev, selectedDate])].sort().reverse());
      }
    } catch (err) {
      console.error('Error saving topic:', err);
      showToast(`❌ Failed to save topic: ${err.message || err}`, true);
    }
    setSaving(false);
  };

  // ── BULK IMPORT FROM CSV/CHATGPT TO SUPABASE ──
  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!bulkCsvText.trim()) return;
    setSaving(true);

    const dayId = `DAY-${selectedDate.replace(/-/g, '')}`;
    const targetCreatorIds = bulkSelectedCreators.length > 0 ? bulkSelectedCreators : creators.map(c => c.id);

    try {
      const lines = bulkCsvText.trim().split('\n');
      let startIdx = contentRows.length;
      const newRows = [];

      const { error: dayError } = await supabase.from('content_days').upsert({
        id: dayId,
        date: selectedDate,
        status: 'Draft',
        total_assignments: 0
      }, { onConflict: 'id' });
      if (dayError) throw dayError;

      let rowFailures = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && (line.toLowerCase().includes('platform') || line.toLowerCase().includes('topic'))) continue;

        const parts = line.split(/\t|\|/).map(s => s.trim().replace(/^["']|["']$/g, ''));
        if (parts.length < 2) continue;

        const topic = parts[0] || "Crypto Market Update";
        const platformName = parts[1] || "X (Twitter)";
        const slot = parts[2] || "11:00 AM EST";
        const caption = parts[3] || topic;
        const driveLink = parts[4] || "";

        const platformObj = platforms.find(p => 
          p.name.toLowerCase().includes(platformName.toLowerCase()) ||
          platformName.toLowerCase().includes(p.name.toLowerCase())
        ) || { id: 'PL-X', name: platformName };

        startIdx++;
        const newId = `CNT-${selectedDate.replace(/-/g, '')}-${String(startIdx).padStart(3, '0')}`;

        const { error: bcErr } = await supabase.from('base_content').insert({
          id: newId,
          day_id: dayId,
          platform_id: platformObj.id,
          content_type: 'Text Post',
          slot: slot,
          publish_time: slot,
          shared_topic: topic,
          drive_link: driveLink || null
        });

        if (bcErr) {
          console.error('Insert base_content error:', bcErr);
          rowFailures++;
          continue;
        }

        const captionInserts = targetCreatorIds.map(cId => ({
          content_id: newId,
          creator_id: cId,
          caption: caption
        }));

        if (captionInserts.length > 0) {
          const { error: captionErr } = await supabase.from('creator_captions').insert(captionInserts);
          if (captionErr) {
            console.error('Insert creator_captions error:', captionErr);
            rowFailures++;
          }
        }
        newRows.push(newId);
      }

      const { error: updateError } = await supabase.from('content_days').update({
        total_assignments: contentRows.length + newRows.length
      }).eq('id', dayId);
      if (updateError) throw updateError;

      setBulkCsvText("");
      setIsBulkImportModalOpen(false);
      await fetchContentForDate(selectedDate);

      if (!availableDates.includes(selectedDate)) {
        setAvailableDates(prev => [...new Set([...prev, selectedDate])].sort().reverse());
      }

      if (rowFailures > 0) {
        showToast(`⚠️ Imported with ${rowFailures} row(s) failed — check console for details.`, true);
      } else {
        showToast(`✅ Imported ${newRows.length} content row(s).`);
      }
    } catch (err) {
      console.error('Bulk import error:', err);
      showToast(`❌ Bulk import failed: ${err.message || err}`, true);
    }
    setSaving(false);
  };

  // ── DELETE TOPIC ROW ──
  const handleDeleteRow = async (contentId) => {
    const { error } = await supabase.from('base_content').delete().eq('id', contentId);
    if (error) {
      console.error('Delete content row error:', error);
      showToast(`❌ Failed to delete row: ${error.message}`, true);
      return;
    }
    setContentRows(prev => prev.filter(r => r.id !== contentId));
  };

  // ── ASSIGN/UNASSIGN CREATOR FOR A TOPIC ──
  const handleToggleCreatorTarget = async (rowIndex, creatorId) => {
    const row = contentRows[rowIndex];
    const isAssigned = row.creatorCaptions && row.creatorCaptions[creatorId] !== undefined;

    if (isAssigned) {
      const { error } = await supabase.from('creator_captions')
        .delete()
        .eq('content_id', row.id)
        .eq('creator_id', creatorId);
      if (error) {
        console.error('Unassign creator error:', error);
        showToast(`❌ Failed to unassign creator: ${error.message}`, true);
        return;
      }

      const updated = [...contentRows];
      const newCaptions = { ...updated[rowIndex].creatorCaptions };
      delete newCaptions[creatorId];
      updated[rowIndex].creatorCaptions = newCaptions;
      setContentRows(updated);
    } else {
      const platformName = row.platformName || 'Platform';
      let defaultCaption = '';
      if (row.headline) defaultCaption += `**${row.headline.toUpperCase()}**\n\n`;
      if (row.subheadline) defaultCaption += `_${row.subheadline}_\n\n`;
      if (row.bodyContent) defaultCaption += `${row.bodyContent}`;
      else defaultCaption += `**${platformName}:** ${row.sharedTopic}`;

      const { error } = await supabase.from('creator_captions').insert({
        content_id: row.id,
        creator_id: creatorId,
        caption: defaultCaption,
        headline: row.headline || null,
        subheadline: row.subheadline || null
      });
      if (error) {
        console.error('Assign creator error:', error);
        showToast(`❌ Failed to assign creator: ${error.message}`, true);
        return;
      }

      const updated = [...contentRows];
      updated[rowIndex] = {
        ...updated[rowIndex],
        creatorCaptions: {
          ...updated[rowIndex].creatorCaptions,
          [creatorId]: defaultCaption
        }
      };
      setContentRows(updated);
    }
  };

  // ── DEBOUNCED CAPTION UPDATE ──
  const updateCaption = useCallback(
    (() => {
      const timers = {};
      return (contentId, creatorId, newCaption) => {
        const key = `${contentId}-${creatorId}`;
        clearTimeout(timers[key]);
        timers[key] = setTimeout(async () => {
          const { error } = await supabase
            .from('creator_captions')
            .upsert({ content_id: contentId, creator_id: creatorId, caption: newCaption },
              { onConflict: 'content_id,creator_id' });
          if (error) {
            console.error('Autosave caption error:', error);
            showToast(`❌ Autosave failed for this caption: ${error.message}`, true);
          }
        }, 800);
      };
    })(),
    []
  );

  const handleCaptionChange = (rowIndex, creatorId, newCaption) => {
    const updated = [...contentRows];
    updated[rowIndex] = {
      ...updated[rowIndex],
      creatorCaptions: { ...updated[rowIndex].creatorCaptions, [creatorId]: newCaption }
    };
    setContentRows(updated);
    updateCaption(updated[rowIndex].id, creatorId, newCaption);
  };

  // ── ADD NEW DATE ──
  const handleAddDate = async () => {
    const newDate = prompt("Enter new date (YYYY-MM-DD):", selectedDate);
    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    
    const dayId = `DAY-${newDate.replace(/-/g, '')}`;
    const { error } = await supabase.from('content_days').upsert({
      id: dayId,
      date: newDate,
      status: 'Draft',
      total_assignments: 0
    }, { onConflict: 'id' });

    if (error) {
      console.error('Add date error:', error);
      showToast(`❌ Failed to add date: ${error.message}`, true);
      return;
    }

    setAvailableDates(prev => [...new Set([...prev, newDate])].sort().reverse());
    setSelectedDate(newDate);
  };

  // ── DISPATCH ──
  const confirmDispatch = async () => {
    setIsDispatching(true);
    setIsDispatchModalOpen(false);
    onSendToTeam();

    try {
      await fetch('http://localhost:3001/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
      });
    } catch (err) {
      console.error('Dispatch trigger error:', err);
    }
    setIsDispatching(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Bar */}
      <div className="glass-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-cyan">Content Creation Studio</span>
            <span className="text-xs font-mono text-[#d5b895] font-bold">Active Date: {selectedDate}</span>
            {saving && <span className="text-[10px] text-[#e39e2e] font-mono animate-pulse">Saving to Supabase...</span>}
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2 uppercase">
            <CalendarDays className="w-6 h-6 text-[#e39e2e]" />
            Multi-Creator Content & Task Matrix
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Assign topics to specific creator(s). Platform character & headline limits are validated in real time.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
          <div className="flex items-center bg-[#080a0f] p-1 rounded-xl border border-white/10 flex-wrap gap-1">
            {availableDates.slice(0, 7).map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                  selectedDate === date ? 'bg-[#e39e2e] text-[#0b0e14]' : 'text-slate-400 hover:text-white'
                }`}
              >
                {date}
              </button>
            ))}
            <button
              onClick={handleAddDate}
              className="px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-[#e39e2e] cursor-pointer"
              title="Add new date"
            >
              <CalendarPlus className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => setIsBulkImportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#121722] hover:bg-[#1a2130] text-slate-200 font-bold text-xs transition-all border border-[#38bdf8]/40 flex items-center gap-2 cursor-pointer shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#38bdf8]" />
            Bulk Paste ChatGPT / CSV
          </button>

          <button 
            onClick={() => setIsNewTopicModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#121722] hover:bg-[#1a2130] text-white font-bold text-xs transition-all border border-[#e39e2e]/40 flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4 text-[#e39e2e]" />
            + Single Topic
          </button>
          
          <button 
            onClick={() => setIsDispatchModalOpen(true)}
            disabled={contentRows.length === 0}
            className="grad-button px-5 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
            Send to Team (3 Batches)
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card-interactive p-5 flex items-center gap-4 border border-white/10">
          <div className="w-11 h-11 rounded-xl bg-[#e39e2e]/15 border border-[#e39e2e]/30 flex items-center justify-center text-[#e39e2e]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Scheduled Topics</div>
            <div className="text-xl font-black text-white">{contentRows.length} Topics Total</div>
          </div>
        </div>

        <div className="glass-card-interactive p-5 flex items-center gap-4 border border-white/10">
          <div className="w-11 h-11 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Posting Window EST</div>
            <div className="text-xl font-black text-[#38bdf8]">11:00 AM - 02:00 PM EST</div>
          </div>
        </div>

        <div className="glass-card-interactive p-5 flex items-center gap-4 border border-white/10">
          <div className="w-11 h-11 rounded-xl bg-[#00d294]/15 border border-[#00d294]/30 flex items-center justify-center text-[#00d294]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">3-Batch Dispatch</div>
            <div className="text-xl font-black text-white">Batch 1 (11:00) • B2 (11:30) • B3 (12:00)</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="glass-panel p-6 space-y-6 border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#e39e2e]" />
              Scheduled Content Matrix & Platform Validation ({selectedDate})
            </h3>
            <p className="text-xs text-slate-400">
              Each topic can have a Headline, Subheadline, and Body Content. Live character limits validate per platform.
            </p>
          </div>
        </div>

        {loading ? (
          <SkeletonCardList count={3} />
        ) : contentRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
            <FileText className="w-12 h-12 text-slate-600" />
            <p className="text-sm font-semibold">No content created for {selectedDate} yet.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsNewTopicModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#e39e2e]/10 border border-[#e39e2e]/30 text-[#e39e2e] text-xs font-bold cursor-pointer"
              >
                + Add Single Topic
              </button>
              <button 
                onClick={() => setIsBulkImportModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[#38bdf8] text-xs font-bold cursor-pointer"
              >
                Bulk Import CSV
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {contentRows.map((row, index) => {
              const assignedCreatorCount = Object.keys(row.creatorCaptions || {}).length;
              const limitRules = getPlatformLimit(row.platformId);

              return (
                <div key={row.id} className="p-6 rounded-2xl bg-[#080a0f] border border-white/10 space-y-5">
                  {/* Header & Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="badge badge-gold font-mono text-xs">{row.id}</span>
                      <span className="badge badge-cyan">{row.platformName}</span>
                      <span className="text-xs font-bold text-white">{row.contentType}</span>
                      <span className="badge badge-emerald font-mono text-xs">⏰ EST: {row.slot}</span>
                      <span className="badge badge-primary text-xs font-mono">
                        Targeted: {assignedCreatorCount} / {creators.length} Creators
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {row.driveLink ? (
                        <a href={row.driveLink} target="_blank" rel="noreferrer" className="text-[#e39e2e] hover:underline flex items-center gap-1.5 font-mono text-xs font-bold">
                          <ImageIcon className="w-4 h-4 text-[#e39e2e]" />
                          Drive Asset <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-500 font-mono text-xs flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                          Text Only
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        title="Delete Topic Row"
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Shared Base Topic & Structured Fields */}
                  <div className="bg-[#121722] p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Topic & Objective</span>
                        <span className="text-sm font-bold text-[#d5b895]">{row.sharedTopic}</span>
                        
                        {/* Display Headline & Subheadline if present */}
                        {row.headline && (
                          <div className="mt-1 text-xs font-black text-[#e39e2e] uppercase tracking-wide">
                            📌 Headline: {row.headline}
                          </div>
                        )}
                        {row.subheadline && (
                          <div className="text-[11px] text-slate-300 italic">
                            _{row.subheadline}_
                          </div>
                        )}
                      </div>

                      {/* Creator Target Pills */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target:</span>
                        {creators.map(c => {
                          const isAssigned = row.creatorCaptions && row.creatorCaptions[c.id] !== undefined;
                          return (
                            <button
                              key={c.id}
                              onClick={() => handleToggleCreatorTarget(index, c.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                isAssigned 
                                  ? 'bg-[#e39e2e] text-[#080a0f] shadow-md' 
                                  : 'bg-[#080a0f] text-slate-400 hover:text-white border border-white/10'
                              }`}
                              title={isAssigned ? `Unassign ${c.publicName}` : `Assign ${c.publicName}`}
                            >
                              {isAssigned ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5 text-slate-500" />}
                              {c.publicName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Creator Captions Grid - Dynamic Responsive for any N creators */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                    {creators.map((c) => {
                      const isAssigned = row.creatorCaptions && row.creatorCaptions[c.id] !== undefined;

                      if (!isAssigned) {
                        return (
                          <div 
                            key={c.id} 
                            onClick={() => handleToggleCreatorTarget(index, c.id)}
                            className="p-6 rounded-2xl bg-[#080a0f]/60 border border-dashed border-white/10 hover:border-[#e39e2e]/50 flex flex-col items-center justify-center text-center space-y-2 cursor-pointer transition-all group"
                          >
                            <div className="w-9 h-9 rounded-xl bg-white/5 group-hover:bg-[#e39e2e]/20 text-slate-500 group-hover:text-[#e39e2e] flex items-center justify-center font-bold">
                              <UserPlus className="w-5 h-5" />
                            </div>
                            <div className="text-xs font-bold text-slate-400 group-hover:text-white">
                              + Assign {c.publicName}
                            </div>
                            <p className="text-[10px] text-slate-500">Unassigned for this topic</p>
                          </div>
                        );
                      }

                      const currentCaption = row.creatorCaptions[c.id] || '';
                      const charCount = currentCaption.length;

                      return (
                        <div key={c.id} className="p-4.5 rounded-2xl bg-[#121722] border border-[#e39e2e]/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-[#e39e2e] text-[#080a0f] flex items-center justify-center font-black text-xs">
                                {c.publicName.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="text-xs font-bold text-white">{c.publicName}</span>
                            </div>

                            <button
                              onClick={() => handleToggleCreatorTarget(index, c.id)}
                              className="text-[10px] text-rose-400 hover:text-rose-300 font-mono font-bold flex items-center gap-1 cursor-pointer bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20"
                            >
                              <UserX className="w-3 h-3" /> Unassign
                            </button>
                          </div>

                          {/* Toolbar & Character Limit Counter */}
                          <div className="flex items-center justify-between bg-[#080a0f] p-1.5 rounded-lg border border-white/5 text-[10px]">
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-slate-300 font-mono">
                                <Bold className="w-3 h-3 text-[#e39e2e]" /> **bold**
                              </span>
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-slate-300 font-mono">
                                <Italic className="w-3 h-3 text-[#38bdf8]" /> *italic*
                              </span>
                            </div>

                            {/* Real-time Character Counter Badge */}
                            {getCharCountBadge(charCount, limitRules.maxBody)}
                          </div>

                          <textarea
                            rows={6}
                            value={currentCaption}
                            onChange={(e) => handleCaptionChange(index, c.id, e.target.value)}
                            placeholder={`Enter formatted content for ${c.publicName}...`}
                            className="w-full bg-[#080a0f] text-slate-100 text-xs p-3.5 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none resize-none font-mono leading-relaxed"
                          />

                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span>EST: <strong className="text-white font-mono">{row.slot}</strong></span>
                            <span className="text-[#00d294] font-mono font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Supabase ✓
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Bulk Import from ChatGPT / CSV */}
      {isBulkImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full p-6 space-y-5 border border-[#38bdf8]/40 bg-[#0f141d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8]">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase">Bulk Import from ChatGPT / CSV</h3>
                  <p className="text-xs text-slate-400 font-mono">Date: {selectedDate}</p>
                </div>
              </div>
              <button onClick={() => setIsBulkImportModalOpen(false)} className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer">✕ Close</button>
            </div>

            <form onSubmit={handleBulkImport} className="space-y-4 text-xs">
              <div className="space-y-1.5 p-3 rounded-xl bg-[#080a0f] border border-white/10">
                <label className="text-slate-300 font-bold uppercase tracking-wider block">Target Creators for Bulk Import</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {creators.map(c => {
                    const isSelected = bulkSelectedCreators.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) setBulkSelectedCreators(bulkSelectedCreators.filter(id => id !== c.id));
                          else setBulkSelectedCreators([...bulkSelectedCreators, c.id]);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                          isSelected ? 'bg-[#38bdf8] text-[#080a0f]' : 'bg-[#121722] text-slate-400 border border-white/10'
                        }`}
                      >
                        {isSelected ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                        {c.publicName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contentstudioview-field-1" className="text-slate-300 font-bold uppercase tracking-wider block">Paste Table Data / CSV Text Here *</label>
                <textarea id="contentstudioview-field-1"
                  rows={8}
                  required
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  placeholder={`BTC Demand Accumulation | X (Twitter) | 11:00 AM EST | **Institutional Alert**: BTC holding key $64k support... | https://drive.google.com/file/d/graphic-1.png`}
                  className="w-full bg-[#080a0f] text-slate-100 p-4 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-mono text-xs leading-relaxed resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsBulkImportModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving || bulkSelectedCreators.length === 0} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#38bdf8] to-[#0284c7] text-[#0b0e14] font-black shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {saving ? 'Saving...' : `Import for ${bulkSelectedCreators.length} Creator(s)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Single Topic with Structured Fields (Headline, Subheadline, Body Content) */}
      {isNewTopicModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-xl w-full p-6 space-y-5 border border-[#e39e2e]/40 bg-[#0f141d] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#e39e2e]" />
                Add Single Topic for {selectedDate}
              </h3>
              <button onClick={() => setIsNewTopicModalOpen(false)} className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer">✕ Close</button>
            </div>

            <form onSubmit={handleAddTopic} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="contentstudioview-field-2" className="text-slate-300 font-bold uppercase tracking-wider">Base Topic / Objective *</label>
                <input id="contentstudioview-field-2"
                  type="text"
                  required
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. SOL 4H Bullish Pennant Breakout & Solana Ecosystem Volume"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-sans"
                />
              </div>

              {/* STRUCTURED FIELDS: Headline, Subheadline, Body Content */}
              <div className="p-4 rounded-xl bg-[#080a0f] border border-white/10 space-y-3">
                <span className="text-[10px] font-bold text-[#e39e2e] uppercase tracking-wider block">Structured Content Fields (Optional)</span>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label htmlFor="contentstudioview-field-headline" className="text-slate-400 font-semibold text-[11px]">Headline / Title</label>
                    {getCharCountBadge(newHeadline.length, getPlatformLimit(newPlatformId).maxHeadline)}
                  </div>
                  <input
                    id="contentstudioview-field-headline"
                    type="text"
                    value={newHeadline}
                    onChange={(e) => setNewHeadline(e.target.value)}
                    placeholder="e.g. INSTITUTIONAL ACCUMULATION IN SOLANA"
                    className="w-full bg-[#121722] text-slate-100 p-2.5 rounded-lg border border-white/10 focus:border-[#e39e2e] focus:outline-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label htmlFor="contentstudioview-field-subheadline" className="text-slate-400 font-semibold text-[11px]">Subheadline / Tagline</label>
                    {getCharCountBadge(newSubheadline.length, getPlatformLimit(newPlatformId).maxSubheadline)}
                  </div>
                  <input
                    id="contentstudioview-field-subheadline"
                    type="text"
                    value={newSubheadline}
                    onChange={(e) => setNewSubheadline(e.target.value)}
                    placeholder="e.g. Key 4H breakout levels confirmed before 2:00 PM EST"
                    className="w-full bg-[#121722] text-slate-100 p-2.5 rounded-lg border border-white/10 focus:border-[#e39e2e] focus:outline-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label htmlFor="contentstudioview-field-bodycontent" className="text-slate-400 font-semibold text-[11px]">Body Content / Outline</label>
                    {getCharCountBadge(newBodyContent.length, getPlatformLimit(newPlatformId).maxBody)}
                  </div>
                  <textarea
                    id="contentstudioview-field-bodycontent"
                    rows={4}
                    value={newBodyContent}
                    onChange={(e) => setNewBodyContent(e.target.value)}
                    placeholder="Enter main post content body or key bullet points..."
                    className="w-full bg-[#121722] text-slate-100 p-3 rounded-lg border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Creator Selection */}
              <div className="space-y-1.5 p-3 rounded-xl bg-[#080a0f] border border-white/10">
                <label className="text-slate-300 font-bold uppercase tracking-wider block">Assign to Creators *</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {creators.map(c => {
                    const isSelected = newSelectedCreators.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) setNewSelectedCreators(newSelectedCreators.filter(id => id !== c.id));
                          else setNewSelectedCreators([...newSelectedCreators, c.id]);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                          isSelected ? 'bg-[#e39e2e] text-[#080a0f]' : 'bg-[#121722] text-slate-400 border border-white/10'
                        }`}
                      >
                        {isSelected ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                        {c.publicName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="contentstudioview-field-3" className="text-slate-300 font-bold uppercase tracking-wider">Target Platform</label>
                  <select id="contentstudioview-field-3"
                    value={newPlatformId}
                    onChange={(e) => setNewPlatformId(e.target.value)}
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-sans"
                  >
                    {platforms.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="contentstudioview-field-4" className="text-slate-300 font-bold uppercase tracking-wider">Target EST Publish Time</label>
                  <input id="contentstudioview-field-4"
                    type="text"
                    value={newSlot}
                    onChange={(e) => setNewSlot(e.target.value)}
                    placeholder="e.g. 11:30 AM EST"
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contentstudioview-field-5" className="text-slate-300 font-bold uppercase tracking-wider">Google Drive Asset Link (Optional)</label>
                <input id="contentstudioview-field-5"
                  type="url"
                  value={newDriveLink}
                  onChange={(e) => setNewDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/file/d/your-chart-graphic.png"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsNewTopicModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving || newSelectedCreators.length === 0} className="grad-button px-5 py-2.5 rounded-xl font-black shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {saving ? 'Saving...' : `Add Topic for ${newSelectedCreators.length} Creator(s)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Dispatch Confirmation */}
      {isDispatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 space-y-5 border border-[#e39e2e]/40 bg-[#0f141d]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center text-[#0b0e14] font-black">
                <Send className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase">Confirm 3-Batch Staggered Distribution</h3>
                <p className="text-xs text-slate-400 font-mono">Date: {selectedDate} • {contentRows.length} Topics • {creators.length} Creators</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#080a0f] border border-white/10 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Content Topics</span>
                <span className="font-bold text-white">{contentRows.length} Topics (from Supabase)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Active Creators</span>
                <span className="font-bold text-white">{creators.length} Creators</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Posting Window EST</span>
                <span className="font-bold text-[#38bdf8]">11:00 AM - 02:00 PM EST</span>
              </div>
              <div className="flex justify-between py-1 text-[#e39e2e] font-bold">
                <span>Staggered Batches</span>
                <span>B1 (11:00) • B2 (11:30) • B3 (12:00)</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-[#e39e2e]/10 p-3.5 rounded-xl border border-[#e39e2e]/25 leading-relaxed font-medium">
              ⚡️ Bot will send real content to assigned creators and dispatch an instant summary card to the Owner on Telegram.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setIsDispatchModalOpen(false)} disabled={isDispatching} className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 text-xs font-bold cursor-pointer">Cancel</button>
              <button onClick={confirmDispatch} disabled={isDispatching} className="grad-button px-5 py-2.5 rounded-xl text-xs font-black shadow-lg cursor-pointer flex items-center gap-2">
                {isDispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isDispatching ? 'Dispatching...' : 'Confirm & Dispatch 3 Batches'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 border text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-mono flex items-center gap-3 animate-bounce ${
          toast.isError ? 'bg-rose-950 border-rose-500' : 'bg-slate-900 border-[#e39e2e]'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
