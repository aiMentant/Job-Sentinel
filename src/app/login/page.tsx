"use client";

import React, { useState } from "react";
import { Cpu, Lock, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simple delay for modern interface response feel
    setTimeout(() => {
      if (username.toLowerCase() === "wenban" && password === "pixel") {
        // Set cookie valid for 7 days
        document.cookie = "auth_session=verified; max-age=604800; path=/";
        router.push("/");
        router.refresh();
      } else {
        setError("Invalid identity credentials.");
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0c] text-white relative overflow-hidden p-6 font-sans">
      {/* Decorative Glow Backgrounds */}
      <div className="absolute -left-48 -top-48 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -right-48 -bottom-48 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0d0d0f]/50 border border-white/10 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl relative z-10 transition-all duration-300 hover:border-white/20">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4 animate-pulse">
            <Cpu className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold font-outfit tracking-tight">Job Sentinel</h1>
          <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest mt-1">Autonomous Agent Gateway</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs animate-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Operator Identity</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all placeholder:text-slate-500 font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Access Key</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all placeholder:text-slate-500 font-mono tracking-widest"
              />
              <Lock className="absolute right-4 top-3.5 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              "Initialize Console"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
