import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  BookOpen, Layers, CheckCircle2, ShieldAlert, Plus, Edit3, Trash2, Save, X, ExternalLink, KeyRound, Loader2
} from 'lucide-react';

export default function PlatformsPlaybooksView({ platforms: initialPlatforms }) {
  const [platforms, setPlatforms] = useState(initialPlatforms);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 4000);
  };

  // Form State for Add / Edit
  const [formState, setFormState] = useState({
    id: '',
    name: '',
    category: 'Social',
    dailyPostsReq: 1,
    articleFreq: 'None',
    engagementReq: 'Standard',
    status: 'Active',
    maxHeadlineChars: 100,
    maxBodyChars: 2000,
    securityKeyReq: false,
    setupInstruction: ''
  });

  const handleStartAdd = () => {
    setFormState({
      id: `PL-${Date.now().toString().substring(8)}`,
      name: '',
      category: 'Social',
      dailyPostsReq: 1,
      articleFreq: 'None',
      engagementReq: 'Standard',
      status: 'Active',
      maxHeadlineChars: 100,
      maxBodyChars: 2000,
      securityKeyReq: false,
      setupInstruction: '1. Create account on platform.\n2. Add official display name.\n3. Add approved bio & link.'
    });
    setIsAddModalOpen(true);
  };

  const handleStartEdit = (platform) => {
    setEditingId(platform.id);
    setFormState({
      id: platform.id,
      name: platform.name,
      category: platform.category || 'Social',
      dailyPostsReq: platform.dailyPostsReq || 1,
      articleFreq: platform.articleFreq || 'None',
      engagementReq: platform.engagementReq || 'Standard',
      status: platform.status || 'Active',
      maxHeadlineChars: platform.maxHeadlineChars || 100,
      maxBodyChars: platform.maxBodyChars || 2000,
      securityKeyReq: platform.securityKeyReq || false,
      setupInstruction: platform.setupInstruction || 'Follow setup guidelines.'
    });
  };

  const handleSavePlatform = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Upsert to Supabase platforms table
      const { error } = await supabase.from('platforms').upsert({
        id: formState.id,
        name: formState.name,
        category: formState.category,
        daily_posts_req: formState.dailyPostsReq,
        article_freq: formState.articleFreq,
        engagement_req: formState.engagementReq,
        status: formState.status
      }, { onConflict: 'id' });
      if (error) throw error;

      // Update local state
      if (editingId) {
        setPlatforms(prev => prev.map(p => p.id === editingId ? { ...p, ...formState } : p));
        setEditingId(null);
      } else {
        setPlatforms(prev => [...prev, { ...formState }]);
        setIsAddModalOpen(false);
      }
    } catch (err) {
      console.error('Save platform error:', err);
      showToast(`❌ Failed to save platform: ${err.message || err}`, true);
    }
    setSaving(false);
  };

  const handleDeletePlatform = async (platformId) => {
    if (!confirm(`Delete platform ${platformId}? This will remove it from CRM dispatch.`)) return;
    const { error } = await supabase.from('platforms').delete().eq('id', platformId);
    if (error) {
      console.error('Delete platform error:', error);
      showToast(`❌ Failed to delete platform: ${error.message}`, true);
      return;
    }
    setPlatforms(prev => prev.filter(p => p.id !== platformId));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-cyan">Platform Onboarding & Playbooks</span>
            <span className="text-xs text-slate-400 font-mono">Active Platforms: {platforms.length}</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2 uppercase">
            <BookOpen className="w-5 h-5 text-[#38bdf8]" />
            Target Platforms & Telegram Setup Guidelines
          </h2>
          <p className="text-xs text-slate-400">
            Define target platforms, posting requirements, character limits, and setup instructions sent to creators on Telegram.
          </p>
        </div>

        <button
          onClick={handleStartAdd}
          className="grad-button px-5 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          + Add New Platform
        </button>
      </div>

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {platforms.map((platform) => {
          const isEditing = editingId === platform.id;

          return (
            <div key={platform.id} className="glass-panel p-5 space-y-4 border border-white/10 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="badge badge-gold font-mono text-[10px]">{platform.id}</span>
                    <h3 className="text-base font-bold text-white mt-1">{platform.name}</h3>
                  </div>
                  <span className={`badge ${platform.status === 'Active' ? 'badge-emerald' : 'badge-rose'} text-[10px]`}>
                    {platform.status}
                  </span>
                </div>

                <div className="space-y-2 bg-[#080a0f] p-3 rounded-xl border border-white/5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Category:</span>
                    <span className="text-white font-semibold">{platform.category}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Daily Posts:</span>
                    <span className="text-[#38bdf8] font-bold">{platform.dailyPostsReq} / day</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Articles:</span>
                    <span className="text-slate-200">{platform.articleFreq}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#121722] border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Telegram Setup Instruction</span>
                  <p className="text-[11px] text-slate-300 whitespace-pre-line leading-relaxed font-mono">
                    {platform.setupInstruction || '1. Open platform website.\n2. Set approved display name & bio.\n3. Submit account handle.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                <button
                  onClick={() => handleStartEdit(platform)}
                  className="text-slate-400 hover:text-[#e39e2e] flex items-center gap-1 font-bold cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Config
                </button>
                <button
                  onClick={() => handleDeletePlatform(platform.id)}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Platform Modal */}
      {(isAddModalOpen || editingId) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 space-y-5 border border-[#38bdf8]/40 bg-[#0f141d]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#38bdf8]" />
                {editingId ? 'Edit Platform Configuration' : 'Add New Target Platform'}
              </h3>
              <button onClick={() => { setIsAddModalOpen(false); setEditingId(null); }} className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer">✕ Close</button>
            </div>

            <form onSubmit={handleSavePlatform} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="platformsplaybooksview-field-1" className="text-slate-300 font-bold uppercase tracking-wider">Platform Name *</label>
                  <input id="platformsplaybooksview-field-1"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="e.g. Substack / YouTube Shorts"
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="platformsplaybooksview-field-2" className="text-slate-300 font-bold uppercase tracking-wider">Category</label>
                  <select id="platformsplaybooksview-field-2"
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-sans"
                  >
                    <option value="Social">Social Media</option>
                    <option value="Article">Long-Form Article</option>
                    <option value="Exchange">Exchange / Community</option>
                    <option value="Video">Video Platform</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="platformsplaybooksview-field-3" className="text-slate-300 font-bold uppercase tracking-wider">Daily Posts Required</label>
                  <input id="platformsplaybooksview-field-3"
                    type="number"
                    min="1"
                    value={formState.dailyPostsReq}
                    onChange={(e) => setFormState({ ...formState, dailyPostsReq: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="platformsplaybooksview-field-4" className="text-slate-300 font-bold uppercase tracking-wider">Status</label>
                  <select id="platformsplaybooksview-field-4"
                    value={formState.status}
                    onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-sans"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="platformsplaybooksview-field-5" className="text-slate-300 font-bold uppercase tracking-wider">Telegram Setup Instruction Guidelines</label>
                <textarea id="platformsplaybooksview-field-5"
                  rows={4}
                  value={formState.setupInstruction}
                  onChange={(e) => setFormState({ ...formState, setupInstruction: e.target.value })}
                  placeholder="Enter setup steps sent to creator on Telegram..."
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-mono text-xs leading-relaxed resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingId(null); }}
                  className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="grad-button px-5 py-2.5 rounded-xl font-black shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Platform Config'}
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
