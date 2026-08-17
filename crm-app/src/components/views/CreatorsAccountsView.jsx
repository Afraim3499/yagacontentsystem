import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, ShieldCheck, KeyRound, CheckCircle2, ExternalLink, Plus, Search, Lock,
  Eye, EyeOff, Edit3, Save, Trash2, X, UserPlus, Loader2, ToggleLeft, ToggleRight, Crown, Shield
} from 'lucide-react';
import { useConfirm } from '../ConfirmDialogProvider';

export default function CreatorsAccountsView({ creators: initialCreators, owners: initialOwners = [], accounts: initialAccounts, platforms, onRefreshData }) {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState("CREATORS");
  const [creators, setCreators] = useState(initialCreators);
  const [owners, setOwners] = useState(initialOwners);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 4000);
  };

  // New Owner Form State
  const [isAddOwnerModalOpen, setIsAddOwnerModalOpen] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerChatId, setNewOwnerChatId] = useState("");

  useEffect(() => { setCreators(initialCreators); }, [initialCreators]);
  useEffect(() => { setOwners(initialOwners); }, [initialOwners]);
  useEffect(() => { setAccounts(initialAccounts); }, [initialAccounts]);

  const activeAccounts = accounts.filter(a => a.status === 'Active').length;

  // ── START EDITING A CREATOR ──
  const startEdit = (creator) => {
    setEditingId(creator.id);
    setEditForm({
      publicName: creator.publicName,
      realName: creator.realName,
      title: creator.title,
      email: creator.email,
      tone: creator.voiceProfile?.tone || '',
      sentenceLength: creator.voiceProfile?.sentenceLength || '',
      vocabulary: creator.voiceProfile?.vocabulary || '',
      humor: creator.voiceProfile?.humor || '',
      ctaStyle: creator.voiceProfile?.ctaStyle || '',
    });
  };

  // ── SAVE CREATOR EDITS TO SUPABASE ──
  const saveCreator = async (creatorId) => {
    setSaving(true);
    try {
      const { error: creatorError } = await supabase.from('creators').update({
        public_name: editForm.publicName,
        real_name: editForm.realName,
        title: editForm.title,
        email: editForm.email || null,
      }).eq('id', creatorId);
      if (creatorError) throw creatorError;

      const { error: voiceError } = await supabase.from('voice_profiles').upsert({
        creator_id: creatorId,
        tone: editForm.tone,
        sentence_length: editForm.sentenceLength,
        vocabulary: editForm.vocabulary,
        humor: editForm.humor,
        cta_style: editForm.ctaStyle,
      }, { onConflict: 'creator_id' });
      if (voiceError) throw voiceError;

      setCreators(prev => prev.map(c => {
        if (c.id === creatorId) {
          return {
            ...c,
            publicName: editForm.publicName,
            realName: editForm.realName,
            title: editForm.title,
            email: editForm.email,
            voiceProfile: {
              tone: editForm.tone,
              sentenceLength: editForm.sentenceLength,
              vocabulary: editForm.vocabulary,
              humor: editForm.humor,
              ctaStyle: editForm.ctaStyle,
            }
          };
        }
        return c;
      }));

      setEditingId(null);
    } catch (err) {
      console.error('Save creator error:', err);
      showToast(`❌ Failed to save creator: ${err.message || err}`, true);
    }
    setSaving(false);
  };

  // ── TOGGLE CREATOR ACTIVE ──
  const toggleActive = async (creatorId, currentActive) => {
    const { error } = await supabase.from('creators').update({ active: !currentActive }).eq('id', creatorId);
    if (error) {
      console.error('Toggle creator active error:', error);
      showToast(`❌ Failed to update status: ${error.message}`, true);
      return;
    }
    setCreators(prev => prev.map(c => c.id === creatorId ? { ...c, active: !currentActive } : c));
  };

  // ── DELETE CREATOR ──
  const deleteCreator = async (creatorId) => {
    if (!(await confirm(`Delete creator ${creatorId}? This removes their voice profile and unlinks all accounts.`))) return;
    const { error: voiceDelError } = await supabase.from('voice_profiles').delete().eq('creator_id', creatorId);
    if (voiceDelError) {
      console.error('Delete voice profile error:', voiceDelError);
      showToast(`❌ Failed to delete creator: ${voiceDelError.message}`, true);
      return;
    }
    const { error: creatorDelError } = await supabase.from('creators').delete().eq('id', creatorId);
    if (creatorDelError) {
      console.error('Delete creator error:', creatorDelError);
      showToast(`❌ Failed to delete creator: ${creatorDelError.message}`, true);
      return;
    }
    setCreators(prev => prev.filter(c => c.id !== creatorId));
  };

  // ── ASSIGN PLATFORM TO CREATOR ──
  const assignPlatform = async (creatorId, platformId) => {
    const accountId = `AC-${platformId.replace('PL-','')}-${creatorId.replace('CR-','CR')}`;
    const platform = platforms.find(p => p.id === platformId);
    const creator = creators.find(c => c.id === creatorId);
    
    const { error } = await supabase.from('accounts').upsert({
      id: accountId,
      creator_id: creatorId,
      platform_id: platformId,
      handle: `@${(creator?.publicName || 'user').replace(/\s+/g, '_').toLowerCase()}_${platform?.name?.split(' ')[0].toLowerCase() || 'platform'}`,
      status: 'Active',
      posting_ready: true,
    }, { onConflict: 'id' });

    if (!error) {
      setAccounts(prev => [...prev.filter(a => a.id !== accountId), {
        id: accountId, creatorId, platformId,
        handle: `@${(creator?.publicName || 'user').replace(/\s+/g, '_').toLowerCase()}_${platform?.name?.split(' ')[0].toLowerCase() || ''}`,
        status: 'Active', postingReady: true
      }]);
      setCreators(prev => prev.map(c => {
        if (c.id === creatorId && !c.assignedPlatforms.includes(platformId)) {
          return { ...c, assignedPlatforms: [...c.assignedPlatforms, platformId] };
        }
        return c;
      }));
    } else {
      console.error('Assign platform error:', error);
      showToast(`❌ Failed to assign platform: ${error.message}`, true);
    }
  };

  // ── REMOVE PLATFORM FROM CREATOR ──
  const removePlatform = async (creatorId, platformId) => {
    const accountId = `AC-${platformId.replace('PL-','')}-${creatorId.replace('CR-','CR')}`;
    const { error } = await supabase.from('accounts').delete().eq('id', accountId);
    if (error) {
      console.error('Remove platform error:', error);
      showToast(`❌ Failed to remove platform: ${error.message}`, true);
      return;
    }
    setAccounts(prev => prev.filter(a => a.id !== accountId));
    setCreators(prev => prev.map(c => {
      if (c.id === creatorId) {
        return { ...c, assignedPlatforms: c.assignedPlatforms.filter(p => p !== platformId) };
      }
      return c;
    }));
  };

  // ── ADD NEW OWNER ──
  const handleAddOwner = async (e) => {
    e.preventDefault();
    if (!newOwnerName.trim() || !newOwnerChatId.trim()) return;
    setSaving(true);

    const ownerId = `OWN-${Date.now().toString().substring(7)}`;
    try {
      const { error } = await supabase.from('owners').upsert({
        id: ownerId,
        name: newOwnerName.trim(),
        telegram_chat_id: newOwnerChatId.trim(),
        active: true
      }, { onConflict: 'telegram_chat_id' });
      if (error) throw error;

      setOwners(prev => [...prev.filter(o => o.telegram_chat_id !== newOwnerChatId), {
        id: ownerId,
        name: newOwnerName.trim(),
        telegram_chat_id: newOwnerChatId.trim(),
        active: true,
        created_at: new Date().toISOString()
      }]);

      setNewOwnerName("");
      setNewOwnerChatId("");
      setIsAddOwnerModalOpen(false);
    } catch (err) {
      console.error('Add owner error:', err);
      showToast(`❌ Failed to add owner: ${err.message || err}`, true);
    }
    setSaving(false);
  };

  // ── TOGGLE OWNER ACTIVE ──
  const toggleOwnerActive = async (ownerId, currentActive) => {
    const { error } = await supabase.from('owners').update({ active: !currentActive }).eq('id', ownerId);
    if (error) {
      console.error('Toggle owner active error:', error);
      showToast(`❌ Failed to update owner: ${error.message}`, true);
      return;
    }
    setOwners(prev => prev.map(o => o.id === ownerId ? { ...o, active: !currentActive } : o));
  };

  // ── DELETE OWNER ──
  const deleteOwner = async (ownerId) => {
    if (!(await confirm(`Delete owner record ${ownerId}? They will stop receiving Telegram broadcast alerts.`))) return;
    const { error } = await supabase.from('owners').delete().eq('id', ownerId);
    if (error) {
      console.error('Delete owner error:', error);
      showToast(`❌ Failed to delete owner: ${error.message}`, true);
      return;
    }
    setOwners(prev => prev.filter(o => o.id !== ownerId));
  };

  // ── EDIT FIELD HELPER ──
  const EditField = ({ label, field, placeholder, multiline }) => {
    const fieldId = `creatorsaccountsview-editfield-${field}`;
    return (
      <div className="space-y-1">
        <label htmlFor={fieldId} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
        {multiline ? (
          <textarea
            id={fieldId}
            rows={2}
            value={editForm[field] || ''}
            onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
            placeholder={placeholder}
            className="w-full bg-[#080a0f] text-slate-100 text-xs p-2.5 rounded-lg border border-white/10 focus:border-[#e39e2e] focus:outline-none resize-none font-sans"
          />
        ) : (
          <input
            id={fieldId}
            type="text"
            value={editForm[field] || ''}
            onChange={(e) => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
            placeholder={placeholder}
            className="w-full bg-[#080a0f] text-slate-100 text-xs p-2.5 rounded-lg border border-white/10 focus:border-[#e39e2e] focus:outline-none font-sans"
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="glass-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-gold">Roster & Credential CRM</span>
            <span className="text-xs text-slate-400 font-mono">Creators: {creators.length} • Owners: {owners.length}</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2 uppercase">
            <Users className="w-5 h-5 text-[#e39e2e]" />
            Team Member Roster, Owners & Account Vault
          </h2>
          <p className="text-xs text-slate-400">
            Team members auto-register on Telegram (/registration). Owners auto-register via /owner. All changes persist to Supabase in real time.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-[#080a0f] p-1.5 rounded-xl border border-white/10 flex-wrap">
          <button onClick={() => setActiveTab("CREATORS")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "CREATORS" ? "bg-[#e39e2e] text-[#0b0e14] shadow-md font-bold" : "text-slate-400 hover:text-white"
            }`}>Team Creators ({creators.length})</button>

          <button onClick={() => setActiveTab("OWNERS")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "OWNERS" ? "bg-[#e39e2e] text-[#0b0e14] shadow-md font-bold" : "text-slate-400 hover:text-white"
            }`}>System Owners ({owners.length})</button>

          <button onClick={() => setActiveTab("ACCOUNTS")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "ACCOUNTS" ? "bg-[#e39e2e] text-[#0b0e14] shadow-md font-bold" : "text-slate-400 hover:text-white"
            }`}>Platform Accounts ({accounts.length})</button>
        </div>
      </div>

      {/* TAB 1: CREATORS ROSTER */}
      {activeTab === "CREATORS" && (
        <div className="space-y-5">
          {creators.length === 0 ? (
            <div className="glass-panel p-12 text-center space-y-4">
              <UserPlus className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-400">No creators onboarded yet.</p>
              <p className="text-xs text-slate-500">Send your bot link <span className="text-[#e39e2e] font-mono">t.me/yagacontentbot</span> to team members. They type <code className="text-white">/registration</code> on Telegram and appear here instantly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
              {creators.map((creator) => {
                const isEditing = editingId === creator.id;
                const unassignedPlatforms = platforms.filter(p => !creator.assignedPlatforms.includes(p.id));

                return (
                  <div key={creator.id} className={`glass-panel p-6 space-y-4 relative overflow-hidden border flex flex-col justify-between ${
                    !creator.active ? 'border-slate-700/50 opacity-60' : 
                    creator.voiceProfile?.tone === 'To be configured' ? 'border-[#e39e2e]/50' : 'border-white/10'
                  }`}>
                    {creator.voiceProfile?.tone === 'To be configured' && creator.active && (
                      <div className="absolute top-3 right-3">
                        <span className="px-2 py-0.5 rounded bg-[#e39e2e]/20 border border-[#e39e2e]/40 text-[#e39e2e] text-[9px] font-black uppercase tracking-wider animate-pulse">
                          ⚡ New — Configure
                        </span>
                      </div>
                    )}

                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center text-[#0b0e14] text-sm font-black shadow-md">
                            {creator.publicName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            {isEditing ? (
                              <div className="space-y-1">
                                <input type="text" value={editForm.publicName} onChange={(e) => setEditForm(p => ({...p, publicName: e.target.value}))}
                                  className="bg-[#080a0f] text-white text-xs font-bold p-1 rounded border border-[#e39e2e] focus:outline-none w-36" />
                                <input type="text" value={editForm.title} onChange={(e) => setEditForm(p => ({...p, title: e.target.value}))}
                                  placeholder="Title / Role" className="bg-[#080a0f] text-slate-300 text-[10px] p-1 rounded border border-white/10 focus:outline-none w-36" />
                              </div>
                            ) : (
                              <>
                                <h3 className="text-sm font-bold text-white leading-snug">{creator.publicName}</h3>
                                <p className="text-[11px] text-slate-400">{creator.title}</p>
                                <p className="text-[10px] font-mono text-[#e39e2e]">{creator.id}</p>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button onClick={() => toggleActive(creator.id, creator.active)}
                            title={creator.active ? 'Deactivate' : 'Activate'}
                            className="cursor-pointer text-slate-400 hover:text-white">
                            {creator.active 
                              ? <ToggleRight className="w-5 h-5 text-[#00d294]" /> 
                              : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                          </button>
                        </div>
                      </div>

                      {/* Voice Profile */}
                      {isEditing ? (
                        <div className="space-y-2 bg-[#080a0f] p-3 rounded-xl border border-[#e39e2e]/30 text-xs">
                          <div className="text-[10px] font-bold text-[#e39e2e] uppercase">Edit Voice Profile</div>
                          <EditField label="Tone" field="tone" placeholder="Authoritative, sharp" />
                          <EditField label="Sentence Style" field="sentenceLength" placeholder="Short punchy statements" />
                          <EditField label="Vocabulary" field="vocabulary" placeholder="Crypto terms, risk-reward" />
                          <EditField label="CTA Style" field="ctaStyle" placeholder="Direct market action" />

                          <div className="flex items-center gap-2 pt-2">
                            <button onClick={() => saveCreator(creator.id)} disabled={saving}
                              className="grad-button px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1">
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg bg-[#121722] text-slate-300 text-xs font-bold cursor-pointer">
                              Cancel
                            </button>
                            <button onClick={() => deleteCreator(creator.id)} className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-bold cursor-pointer border border-rose-500/30 ml-auto">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 bg-[#080a0f] p-3 rounded-xl border border-white/5 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold text-[#e39e2e] uppercase tracking-wider">Voice Profile</div>
                            <button onClick={() => startEdit(creator)} className="text-[10px] text-slate-400 hover:text-[#e39e2e] cursor-pointer flex items-center gap-1">
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          </div>
                          <div><span className="text-slate-400 text-[11px]">Tone:</span> <span className="text-white font-medium text-[11px]">{creator.voiceProfile.tone}</span></div>
                          <div><span className="text-slate-400 text-[11px]">Sentences:</span> <span className="text-slate-300 text-[11px]">{creator.voiceProfile.sentenceLength}</span></div>
                          <div><span className="text-slate-400 text-[11px]">CTA:</span> <span className="text-[#38bdf8] font-medium text-[11px]">{creator.voiceProfile.ctaStyle}</span></div>
                        </div>
                      )}

                      {/* Assigned Platforms */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Assigned Platforms ({creator.assignedPlatforms.length})</div>
                        <div className="flex flex-wrap gap-1">
                          {creator.assignedPlatforms.map((p) => {
                            const platform = platforms.find(pl => pl.id === p);
                            return (
                              <span key={p} className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#121722] text-slate-200 border border-white/10 flex items-center gap-1 group">
                                {platform?.name || p.replace('PL-', '')}
                                <button onClick={() => removePlatform(creator.id, p)} className="text-slate-500 hover:text-rose-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            );
                          })}

                          {unassignedPlatforms.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) assignPlatform(creator.id, e.target.value); }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#e39e2e]/10 text-[#e39e2e] border border-[#e39e2e]/30 cursor-pointer focus:outline-none"
                            >
                              <option value="">+ Assign</option>
                              {unassignedPlatforms.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-between items-center text-[10px] text-slate-400 border-t border-white/10 font-mono">
                      <span>Telegram: {creator.telegramHandle}</span>
                      <span>ChatID: {creator.telegramChatId}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SYSTEM OWNERS VAULT */}
      {activeTab === "OWNERS" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#e39e2e]" />
                System Owners & Administrators Vault
              </h3>
              <p className="text-xs text-slate-400">
                All registered Owners receive personalized Telegram alerts for batch dispatches, problem tickets, and SLA overdue events.
              </p>
            </div>

            <button
              onClick={() => setIsAddOwnerModalOpen(true)}
              className="grad-button px-4 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + Add System Owner
            </button>
          </div>

          {owners.length === 0 ? (
            <div className="glass-panel p-12 text-center space-y-4">
              <Crown className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-400">No System Owners registered yet.</p>
              <p className="text-xs text-slate-500">To register on Telegram, type <code className="text-[#e39e2e] font-mono">/owner</code> and send your name. Or click <strong className="text-white">+ Add System Owner</strong> above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {owners.map((owner) => (
                <div key={owner.id} className="glass-panel p-6 space-y-4 border border-[#e39e2e]/40 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center text-[#0b0e14] font-black shadow-md">
                          <Crown className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="badge badge-gold font-mono text-[10px]">{owner.id}</span>
                          <h4 className="text-base font-bold text-white mt-0.5">{owner.name}</h4>
                        </div>
                      </div>

                      <button onClick={() => toggleOwnerActive(owner.id, owner.active)}
                        title={owner.active ? 'Deactivate Alerts' : 'Activate Alerts'}
                        className="cursor-pointer text-slate-400 hover:text-white">
                        {owner.active 
                          ? <ToggleRight className="w-6 h-6 text-[#00d294]" /> 
                          : <ToggleLeft className="w-6 h-6 text-slate-500" />}
                      </button>
                    </div>

                    <div className="space-y-2 bg-[#080a0f] p-3.5 rounded-xl border border-white/5 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Telegram Chat ID:</span>
                        <span className="text-[#38bdf8] font-bold">{owner.telegram_chat_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Telegram Broadcasts:</span>
                        <span className={owner.active ? 'text-[#00d294] font-bold' : 'text-slate-500'}>
                          {owner.active ? '✅ Active' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[10px] font-mono">
                      {owner.created_at ? new Date(owner.created_at).toLocaleDateString() : 'Active Owner'}
                    </span>
                    <button
                      onClick={() => deleteOwner(owner.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 cursor-pointer"
                      title="Delete Owner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PLATFORM ACCOUNTS */}
      {activeTab === "ACCOUNTS" && (
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">All Creator Accounts ({accounts.length})</h3>
            <span className="text-xs text-slate-400 font-mono">{activeAccounts} active / {accounts.length} total</span>
          </div>

          {accounts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No accounts yet. Assign platforms to creators from the Team Creators tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#080a0f] text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-white/10">
                  <tr>
                    <th scope="col" className="p-3">Account ID</th>
                    <th scope="col" className="p-3">Creator</th>
                    <th scope="col" className="p-3">Platform</th>
                    <th scope="col" className="p-3">Handle</th>
                    <th scope="col" className="p-3">Ready</th>
                    <th scope="col" className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {accounts.map((acc) => {
                    const creator = creators.find(c => c.id === acc.creatorId);
                    const platform = platforms.find(p => p.id === acc.platformId);
                    return (
                      <tr key={acc.id} className="hover:bg-[#121722] transition-colors">
                        <td className="p-3 font-bold text-[#e39e2e]">{acc.id}</td>
                        <td className="p-3 font-sans text-white font-semibold">{creator?.publicName || acc.creatorId}</td>
                        <td className="p-3 font-bold text-[#38bdf8]">{platform?.name || acc.platformId}</td>
                        <td className="p-3 text-slate-200">{acc.handle}</td>
                        <td className="p-3">
                          {acc.postingReady ? (
                            <span className="text-[#00d294] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                            </span>
                          ) : (
                            <span className="text-[#e39e2e] font-bold">Pending Setup</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="badge badge-emerald text-[10px]">{acc.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add New Owner Modal */}
      {isAddOwnerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 space-y-5 border border-[#e39e2e]/40 bg-[#0f141d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#e39e2e] to-[#d5b895] flex items-center justify-center text-[#0b0e14] font-black">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">Add System Owner / Admin</h3>
                  <p className="text-xs text-slate-400">Stores owner record for Telegram alerts</p>
                </div>
              </div>
              <button onClick={() => setIsAddOwnerModalOpen(false)} className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer">✕ Close</button>
            </div>

            <form onSubmit={handleAddOwner} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="creatorsaccountsview-field-1" className="text-slate-300 font-bold uppercase tracking-wider block">Owner Full Name *</label>
                <input id="creatorsaccountsview-field-1"
                  type="text"
                  required
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  placeholder="e.g. Rizwan / System Admin"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="creatorsaccountsview-field-2" className="text-slate-300 font-bold uppercase tracking-wider block">Telegram Chat ID *</label>
                <input id="creatorsaccountsview-field-2"
                  type="text"
                  required
                  value={newOwnerChatId}
                  onChange={(e) => setNewOwnerChatId(e.target.value)}
                  placeholder="e.g. 1617457685"
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
                <span className="text-[10px] text-slate-500 block">Owner can also register directly on Telegram by typing <code className="text-[#e39e2e]">/owner</code></span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsAddOwnerModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="grad-button px-5 py-2.5 rounded-xl font-black shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {saving ? 'Saving...' : 'Add Owner Record'}
                </button>
              </div>
            </form>
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
