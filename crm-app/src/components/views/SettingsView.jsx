import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Settings, KeyRound, ShieldAlert, Cpu, Bell, Database, CheckCircle2, Lock, Eye, EyeOff, Save, RefreshCw, Crown, Plus, Trash2, Loader2
} from 'lucide-react';

export default function SettingsView({ systemSettings, owners = [], onSaveSettings }) {
  const [formState, setFormState] = useState({ ...systemSettings });
  const [isSaving, setIsSaving] = useState(false);
  const [showAnonKey, setShowAnonKey] = useState(false);

  // New Owner inline form
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerChatId, setNewOwnerChatId] = useState("");
  const [ownerList, setOwnerList] = useState(owners);

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      onSaveSettings(formState);
      setIsSaving(false);
    }, 600);
  };

  const handleAddOwner = async (e) => {
    e.preventDefault();
    if (!newOwnerName.trim() || !newOwnerChatId.trim()) return;

    const ownerId = `OWN-${Date.now().toString().substring(7)}`;
    await supabase.from('owners').upsert({
      id: ownerId,
      name: newOwnerName.trim(),
      telegram_chat_id: newOwnerChatId.trim(),
      active: true
    }, { onConflict: 'telegram_chat_id' });

    setOwnerList(prev => [...prev.filter(o => o.telegram_chat_id !== newOwnerChatId), {
      id: ownerId,
      name: newOwnerName.trim(),
      telegram_chat_id: newOwnerChatId.trim(),
      active: true
    }]);

    setNewOwnerName("");
    setNewOwnerChatId("");
  };

  const handleDeleteOwner = async (ownerId) => {
    if (!confirm(`Remove owner ${ownerId}?`)) return;
    await supabase.from('owners').delete().eq('id', ownerId);
    setOwnerList(prev => prev.filter(o => o.id !== ownerId));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-gold">Master Control & System Settings</span>
            <span className="text-xs text-slate-400 font-mono">System Status: OPERATIONAL</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2 uppercase">
            <Settings className="w-5 h-5 text-[#e39e2e]" />
            Operations System Configuration & Owner Vault
          </h2>
          <p className="text-xs text-slate-400">
            Manage global operational parameters, Supabase connection details, and registered System Owners.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="glass-panel p-6 space-y-5">
            <h3 className="text-base font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#e39e2e]" /> General Operational Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Company / Operation Name</label>
                <input
                  type="text"
                  value={formState.companyName}
                  onChange={(e) => setFormState({ ...formState, companyName: e.target.value })}
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Default Operational Timezone</label>
                <input
                  type="text"
                  value={formState.timezone}
                  onChange={(e) => setFormState({ ...formState, timezone: e.target.value })}
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Telegram Bot Username</label>
                <input
                  type="text"
                  value={formState.botUsername}
                  onChange={(e) => setFormState({ ...formState, botUsername: e.target.value })}
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Staggered Batch Interval (Mins)</label>
                <input
                  type="number"
                  value={formState.staggeredBatchIntervalMinutes}
                  onChange={(e) => setFormState({ ...formState, staggeredBatchIntervalMinutes: parseInt(e.target.value, 10) || 30 })}
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="grad-button px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Saving Settings...' : 'Save Settings'}
              </button>
            </div>
          </form>

          {/* SYSTEM OWNERS VAULT CARD */}
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#e39e2e]" /> Registered System Owners ({ownerList.length})
              </h3>
            </div>

            <form onSubmit={handleAddOwner} className="flex gap-2 text-xs">
              <input
                type="text"
                required
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                placeholder="Owner Name (e.g. Rizwan)"
                className="bg-[#080a0f] text-white p-2.5 rounded-xl border border-white/10 focus:outline-none flex-1 font-sans"
              />
              <input
                type="text"
                required
                value={newOwnerChatId}
                onChange={(e) => setNewOwnerChatId(e.target.value)}
                placeholder="Telegram Chat ID (e.g. 1617457685)"
                className="bg-[#080a0f] text-white p-2.5 rounded-xl border border-white/10 focus:outline-none flex-1 font-mono"
              />
              <button type="submit" className="grad-button px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add Owner
              </button>
            </form>

            <div className="space-y-2">
              {ownerList.map(o => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-xl bg-[#080a0f] border border-white/5 text-xs font-mono">
                  <div>
                    <span className="font-bold text-white font-sans block">{o.name}</span>
                    <span className="text-slate-400 text-[10px]">Chat ID: <strong className="text-[#38bdf8]">{o.telegram_chat_id}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-emerald text-[9px]">{o.active ? 'Active Alerts' : 'Disabled'}</span>
                    <button onClick={() => handleDeleteOwner(o.id)} className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Database Health & Connections */}
        <div className="space-y-6">
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <Database className="w-4 h-4 text-[#00d294]" /> Supabase Database Connection
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-white/5 font-mono">
                <span className="text-slate-400">Database Engine</span>
                <span className="text-white font-bold">PostgreSQL (aws-0)</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/5 font-mono">
                <span className="text-slate-400">Supabase Project</span>
                <span className="text-[#38bdf8] font-bold">ghwvwtwktnveqdqivxmy</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/5 font-mono">
                <span className="text-slate-400">Realtime Subscriptions</span>
                <span className="text-[#00d294] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active (Live Sync)
                </span>
              </div>

              <div className="space-y-1 pt-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Supabase Anon Key:</span>
                  <button onClick={() => setShowAnonKey(!showAnonKey)} className="text-[#e39e2e] hover:underline flex items-center gap-1 cursor-pointer">
                    {showAnonKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showAnonKey ? 'Hide Key' : 'Show Key'}
                  </button>
                </div>
                <div className="bg-[#080a0f] p-2.5 rounded-lg border border-white/10 font-mono text-[10px] text-slate-300 break-all">
                  {showAnonKey ? import.meta.env.VITE_SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Hidden)'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
