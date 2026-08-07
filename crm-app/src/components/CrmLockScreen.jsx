import React, { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function CrmLockScreen({ onAuthenticated }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setErrorMsg("");

    try {
      // Query Supabase crm_settings for crm_password
      const { data, error } = await supabase
        .from("crm_settings")
        .select("value")
        .eq("key", "crm_password")
        .single();

      if (error || !data) {
        console.error("Auth query error:", error);
        setErrorMsg("Failed to verify credentials with database. Please try again.");
        setLoading(false);
        return;
      }

      if (data.value === password.trim()) {
        sessionStorage.setItem("yaga_crm_authenticated", "true");
        onAuthenticated();
      } else {
        setErrorMsg("Access Denied: Invalid CRM Access Password.");
      }
    } catch (err) {
      console.error("Auth Exception:", err);
      setErrorMsg("An unexpected connection error occurred.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100 flex items-center justify-center p-4 selection:bg-[#e39e2e] selection:text-black">
      {/* Glow Backdrop */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#e39e2e]/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-[#0f141d] border border-white/10 p-8 rounded-3xl space-y-6 shadow-2xl relative z-10">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#e39e2e]/10 border border-[#e39e2e]/30 flex items-center justify-center text-[#e39e2e] mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <span className="badge badge-gold font-mono text-[10px] uppercase tracking-widest">
              RESTRICTED ACCESS
            </span>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight mt-1">
              Yaga Calls CRM
            </h1>
            <p className="text-xs text-slate-400 font-medium pt-1">
              Enter your database administrative access key to unlock command center
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-bold animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="text-slate-300 font-bold uppercase tracking-wider block">
              CRM Access Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-[#080a0f] text-slate-100 pl-10 pr-10 py-3 rounded-xl border border-white/10 focus:border-[#e39e2e] focus:outline-none font-mono text-sm tracking-wide"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="grad-button w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-black shadow-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                Verifying Database Key...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> Authenticate & Access CRM
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-white/5 text-center">
          <p className="text-[10px] text-slate-500 font-mono">
            Verified via Supabase PostgreSQL Auth • IP Protected
          </p>
        </div>
      </div>
    </div>
  );
}
