"use client";

import React, { useState } from "react";
import { Cpu, Lock, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { listAllUsers, logActivity } from "@/app/actions/adminActions";


export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disclaimerChecked) {
      setError("You must acknowledge the AI disclaimer before logging in.");
      setIsLoading(false);
      return;
    }
    setError("");
    setIsLoading(true);

    try {
      const users = await listAllUsers();
      const lowerUsername = username.toLowerCase().trim();
      const matchedUser = users.find(
        (u: any) => u.email.toLowerCase() === lowerUsername || (lowerUsername === "wenban" && u.email === "lwenban@gmail.com")
      );

      if (matchedUser && matchedUser.password === password) {
        // Log activity
        await logActivity(matchedUser.email, "User Login", { role: matchedUser.role, profile_id: matchedUser.profile_id });

        // Set cookies valid for 7 days
        document.cookie = "auth_session=verified; max-age=604800; path=/";
        document.cookie = `auth_role=${matchedUser.role}; max-age=604800; path=/`;
        document.cookie = `auth_email=${matchedUser.email}; max-age=604800; path=/`;
        document.cookie = `active_profile_id=${matchedUser.profile_id}; max-age=604800; path=/`;
        window.location.href = "/";
      } else {
        setError("Invalid identity credentials.");
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError("Database connection error. Please try again.");
      setIsLoading(false);
    }
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
            <label className="text-[10px] text-slate-300 uppercase font-bold tracking-widest">Operator Identity</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all placeholder:text-slate-400 font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-slate-300 uppercase font-bold tracking-widest">Access Key</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all placeholder:text-slate-400 font-mono tracking-widest"
              />
              <Lock className="absolute right-4 top-3.5 w-4 h-4 text-slate-300" />
            </div>
          </div>

          {/* AI Disclaimer & Checkbox */}
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl text-[11px] text-slate-300 leading-relaxed space-y-2">
              <p className="font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                ⚖️ AI Disclaimer & Accountability
              </p>
              <p>
                Job Sentinel uses advanced Artificial Intelligence to tailor your applications. Please keep in mind:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                <li>AI is fallible. It can occasionally hallucinate or output inaccurate facts.</li>
                <li>This tool is built to speed up your work. You are the ultimate gatekeeper.</li>
                <li>You are solely responsible for checking, validating, and correcting all tailored resumes, cover letters, and communications before you send them to employers. We accept no liability for submitted content.</li>
              </ul>
            </div>
            
            <label className="flex items-start gap-2.5 text-xs text-slate-300 select-none cursor-pointer group">
              <input
                type="checkbox"
                required
                checked={disclaimerChecked}
                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="leading-tight group-hover:text-white transition-colors">
                I understand AI is fallible and confirm I will review all generated materials before applying.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || !disclaimerChecked}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Logging In...
              </>
            ) : (
              "Log In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
