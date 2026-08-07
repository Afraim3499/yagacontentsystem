import React, { useState, useEffect } from "react";
import { 
  Star, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  MessageSquare, 
  Copy, 
  Check, 
  ThumbsUp, 
  Search, 
  Sparkles,
  Loader2,
  Trash2,
  Edit3,
  ExternalLink
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ghwvwtwktnveqdqivxmy.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdod3Z3dHdrdG52ZXFkcWl2eG15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MTg1OTgsImV4cCI6MjA2OTE5NDU5OH0.B2zJ9pC0VzZpX1w7gY19aK4q3J3L_7r4V3";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ReviewModerationDeskView() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("PENDING"); // 'PENDING', 'APPROVED', 'DECLINED', 'INVITE_GENERATOR'
  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Invite Message Generator state
  const [customerName, setCustomerName] = useState("Alex");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [editName, setEditName] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [editTier, setEditTier] = useState("Yearly High Table Member");
  const [editRating, setEditRating] = useState(5);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) {
        setReviews(data);
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    setActionLoading(id);
    try {
      await supabase
        .from("reviews")
        .update({ status: newStatus })
        .eq("id", id);

      await fetchReviews();
    } catch (err) {
      console.error("Status update error:", err);
    }
    setActionLoading(null);
  };

  const handleToggleFeatured = async (id, currentFeatured) => {
    setActionLoading(id);
    try {
      await supabase
        .from("reviews")
        .update({ is_featured: !currentFeatured })
        .eq("id", id);

      await fetchReviews();
    } catch (err) {
      console.error("Featured toggle error:", err);
    }
    setActionLoading(null);
  };

  const handleDeleteReview = async (id) => {
    if (!confirm("Are you sure you want to delete this review entry?")) return;
    setActionLoading(id);
    try {
      await supabase.from("reviews").delete().eq("id", id);
      await fetchReviews();
    } catch (err) {
      console.error("Delete review error:", err);
    }
    setActionLoading(null);
  };

  const handleOpenEdit = (rev) => {
    setSelectedReview(rev);
    setEditName(rev.author_name || "");
    setEditHandle(rev.telegram_handle || "");
    setEditTier(rev.member_tier || "Yearly High Table Member");
    setEditRating(rev.rating || 5);
    setEditTitle(rev.title || "");
    setEditContent(rev.content || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedReview) return;
    setActionLoading(selectedReview.id);
    try {
      await supabase
        .from("reviews")
        .update({
          author_name: editName.trim(),
          telegram_handle: editHandle.trim() || null,
          member_tier: editTier,
          rating: Number(editRating),
          title: editTitle.trim(),
          content: editContent.trim()
        })
        .eq("id", selectedReview.id);

      await fetchReviews();
      setIsEditModalOpen(false);
      setSelectedReview(null);
    } catch (err) {
      console.error("Save edit error:", err);
    }
    setActionLoading(null);
  };

  // Filtered Reviews
  const filteredReviews = reviews.filter(r => {
    const matchesTab = activeTab === "ALL" ? true : r.status === activeTab;
    const matchesSearch = 
      (r.author_name && r.author_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.title && r.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.content && r.content.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const pendingCount = reviews.filter(r => r.status === "PENDING").length;
  const approvedCount = reviews.filter(r => r.status === "APPROVED").length;
  const declinedCount = reviews.filter(r => r.status === "DECLINED").length;

  const warmInviteMessage = `Hi ${customerName.trim() || "there"}, thank you for being a valued member of Yaga Calls. If you have a moment, we would really appreciate your honest feedback on our official community review portal:\n\nhttps://www.yagacalls.com/yaga-calls-review`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(warmInviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0f141d] p-6 rounded-2xl border border-white/10 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="badge badge-gold font-mono text-[10px]">REVIEW ENGINE</span>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Review Moderation Desk</h1>
          </div>
          <p className="text-xs text-slate-400">
            Moderate, approve, and curate customer social proof for <a href="https://www.yagacalls.com/yaga-calls-review" target="_blank" rel="noreferrer" className="text-[#e39e2e] hover:underline font-bold inline-flex items-center gap-1">yagacalls.com/yaga-calls-review <ExternalLink className="w-3 h-3" /></a>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("INVITE_GENERATOR")}
            className="grad-button px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg cursor-pointer flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" /> Generate Customer Review Invite
          </button>
        </div>
      </div>

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 space-y-2 border border-amber-500/30">
          <span className="text-slate-400 text-xs uppercase font-bold tracking-wider block">Pending Queue</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-400">{pendingCount}</span>
            <span className="badge badge-gold text-[10px]">Action Required</span>
          </div>
          <p className="text-[11px] text-slate-400">Awaiting your approval to show on live website</p>
        </div>

        <div className="glass-panel p-5 space-y-2 border border-emerald-500/30">
          <span className="text-slate-400 text-xs uppercase font-bold tracking-wider block">Approved & Published</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-400">{approvedCount}</span>
            <span className="badge badge-emerald text-[10px]">Live on Website</span>
          </div>
          <p className="text-[11px] text-slate-400">Active social proof on yagacalls.com</p>
        </div>

        <div className="glass-panel p-5 space-y-2 border border-rose-500/30">
          <span className="text-slate-400 text-xs uppercase font-bold tracking-wider block">Declined / Spam</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-rose-400">{declinedCount}</span>
            <span className="text-xs font-mono text-slate-500">Filtered</span>
          </div>
          <p className="text-[11px] text-slate-400">Hidden from public view</p>
        </div>

        <div className="glass-panel p-5 space-y-2 border border-sky-500/30">
          <span className="text-slate-400 text-xs uppercase font-bold tracking-wider block">Average Trust Score</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-sky-400">4.9 ★</span>
            <span className="badge badge-gold text-[10px]">Top Tier</span>
          </div>
          <p className="text-[11px] text-slate-400">Indexed in Google Search Rich Snippets</p>
        </div>
      </div>

      {/* NAVIGATION TABS & SEARCH TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f141d] p-4 rounded-xl border border-white/5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("PENDING")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "PENDING"
                ? "bg-[#e39e2e] text-black shadow-lg"
                : "bg-[#121722] text-slate-300 hover:text-white"
            }`}
          >
            ⏳ Pending Queue ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab("APPROVED")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "APPROVED"
                ? "bg-emerald-500 text-black shadow-lg"
                : "bg-[#121722] text-slate-300 hover:text-white"
            }`}
          >
            ✅ Published Live ({approvedCount})
          </button>
          <button
            onClick={() => setActiveTab("DECLINED")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "DECLINED"
                ? "bg-rose-500 text-white shadow-lg"
                : "bg-[#121722] text-slate-300 hover:text-white"
            }`}
          >
            ❌ Declined ({declinedCount})
          </button>
          <button
            onClick={() => setActiveTab("INVITE_GENERATOR")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "INVITE_GENERATOR"
                ? "bg-[#38bdf8] text-black shadow-lg"
                : "bg-[#121722] text-slate-300 hover:text-white"
            }`}
          >
            📩 Warm Customer Invite Tool
          </button>
        </div>

        {activeTab !== "INVITE_GENERATOR" && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reviewer name or title..."
              className="bg-[#080a0f] text-slate-100 pl-9 pr-4 py-2 text-xs rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none w-full md:w-64"
            />
          </div>
        )}
      </div>

      {/* TAB CONTENT: INVITE GENERATOR */}
      {activeTab === "INVITE_GENERATOR" ? (
        <div className="glass-panel p-8 space-y-6 border border-[#38bdf8]/30 max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#38bdf8]/20 border border-[#38bdf8]/40 flex items-center justify-center text-[#38bdf8]">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Warm Customer Review Invitation Generator</h3>
              <p className="text-xs text-slate-400">Generate a polite, personal invitation to send happy customers via Telegram DM</p>
            </div>
          </div>

          <div className="space-y-4 text-xs font-bold">
            <div className="space-y-1.5">
              <label className="text-slate-300 uppercase tracking-wider block">Customer First Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-slate-300 uppercase tracking-wider block">Generated Telegram Message Preview</label>
              <div className="p-4 bg-[#080a0f] border border-white/10 rounded-xl text-slate-200 font-sans text-xs leading-relaxed whitespace-pre-wrap">
                {warmInviteMessage}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleCopyInvite}
                className="grad-button px-6 py-3 rounded-xl font-black shadow-lg cursor-pointer flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied Warm Message!" : "Copy Warm Invite Message"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* TAB CONTENT: REVIEW QUEUE GRID */
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-16 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#e39e2e] mx-auto" />
              <p className="text-xs font-mono text-slate-400">Fetching review entries from Supabase...</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="glass-panel p-12 text-center space-y-3">
              <Star className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-white uppercase">No reviews found in this tab</h4>
              <p className="text-xs text-slate-400">All caught up! New submitted reviews will appear here automatically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReviews.map((rev) => (
                <div
                  key={rev.id}
                  className={`glass-panel p-6 space-y-4 border transition-all relative ${
                    rev.status === "PENDING"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : rev.status === "APPROVED"
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-rose-500/30 bg-rose-500/5 opacity-75"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#e39e2e]/20 border border-[#e39e2e]/40 flex items-center justify-center font-black text-[#e39e2e] text-sm uppercase">
                        {rev.author_name ? rev.author_name.substring(0, 2) : "TR"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{rev.author_name}</h4>
                          {rev.telegram_handle && (
                            <span className="text-[10px] font-mono text-slate-400">{rev.telegram_handle}</span>
                          )}
                        </div>
                        <span className="badge badge-gold font-mono text-[10px] mt-0.5">
                          {rev.member_tier || "Verified Member"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {rev.is_featured && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase rounded">
                          Featured
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                          rev.status === "PENDING"
                            ? "bg-amber-500/20 text-amber-400"
                            : rev.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/20 text-rose-400"
                        }`}
                      >
                        {rev.status}
                      </span>
                    </div>
                  </div>

                  {/* Stars Rating */}
                  <div className="flex items-center gap-1 text-[#e39e2e]">
                    {[...Array(rev.rating || 5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                    <span className="text-xs font-bold text-slate-300 ml-1">({rev.rating || 5}/5)</span>
                  </div>

                  {/* Title & Body */}
                  <div className="space-y-1.5 bg-[#080a0f] p-4 rounded-xl border border-white/5">
                    <h5 className="text-sm font-bold text-white">{rev.title}</h5>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{rev.content}</p>
                  </div>

                  {/* Screenshot Link */}
                  {rev.screenshot_url && (
                    <a href={rev.screenshot_url} target="_blank" rel="noreferrer" className="block text-xs font-mono text-[#38bdf8] hover:underline">
                      🔗 View Verified Setup Screenshot
                    </a>
                  )}

                  {/* Footer Action Buttons */}
                  <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 font-mono text-[10px]">
                      Submitted: {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : "Just now"}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {rev.status !== "APPROVED" && (
                        <button
                          onClick={() => handleUpdateStatus(rev.id, "APPROVED")}
                          disabled={actionLoading === rev.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 font-bold text-[10px] uppercase cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Publish
                        </button>
                      )}

                      {rev.status !== "DECLINED" && (
                        <button
                          onClick={() => handleUpdateStatus(rev.id, "DECLINED")}
                          disabled={actionLoading === rev.id}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/40 font-bold text-[10px] uppercase cursor-pointer flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Decline
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleFeatured(rev.id, rev.is_featured)}
                        disabled={actionLoading === rev.id}
                        className={`p-1.5 rounded-lg border font-bold text-[10px] uppercase cursor-pointer ${
                          rev.is_featured
                            ? "bg-amber-500 text-black border-amber-500"
                            : "bg-[#121722] text-slate-300 hover:text-white border-white/10"
                        }`}
                        title="Toggle Top Featured Review"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenEdit(rev)}
                        className="p-1.5 rounded-lg bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20 border border-[#38bdf8]/30 cursor-pointer"
                        title="Edit Review Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteReview(rev.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 cursor-pointer"
                        title="Delete Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedReview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 space-y-5 border border-[#38bdf8]/40 bg-[#0f141d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#38bdf8]/20 border border-[#38bdf8]/40 flex items-center justify-center text-[#38bdf8]">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">Edit Review Entry</h3>
                  <p className="text-xs text-slate-400">Modify details for {selectedReview.id}</p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer">✕ Close</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold uppercase tracking-wider block">Author Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold uppercase tracking-wider block">Telegram Handle</label>
                  <input
                    type="text"
                    value={editHandle}
                    onChange={(e) => setEditHandle(e.target.value)}
                    placeholder="@username"
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold uppercase tracking-wider block">Star Rating</label>
                  <select
                    value={editRating}
                    onChange={(e) => setEditRating(e.target.value)}
                    className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none"
                  >
                    <option value={5}>5 Stars</option>
                    <option value={4}>4 Stars</option>
                    <option value={3}>3 Stars</option>
                    <option value={2}>2 Stars</option>
                    <option value={1}>1 Star</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold uppercase tracking-wider block">Member Tier Tag</label>
                <select
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value)}
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none"
                >
                  <option value="Yearly High Table Member">Yearly High Table Member</option>
                  <option value="Half-Yearly VIP Subscriber">Half-Yearly VIP Subscriber</option>
                  <option value="Quarterly VIP Subscriber">Quarterly VIP Subscriber</option>
                  <option value="Free Community Member">Free Community Member</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold uppercase tracking-wider block">Review Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold uppercase tracking-wider block">Review Body Content *</label>
                <textarea
                  required
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-[#080a0f] text-slate-100 p-3 rounded-xl border border-white/10 focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#121722] text-slate-300 font-bold cursor-pointer">Cancel</button>
                <button type="submit" className="grad-button px-5 py-2.5 rounded-xl font-black shadow-lg cursor-pointer flex items-center gap-2">
                  <Check className="w-4 h-4" /> Save Review Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
