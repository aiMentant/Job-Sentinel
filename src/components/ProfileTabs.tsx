"use client";

import React, { useState, useEffect } from "react";
import { useProfile } from "./ProfileContext";
import { Plus, User, Sparkles, ExternalLink } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getDbStatus } from "@/app/actions/jobActions";

export default function ProfileTabs() {
  const { activeProfileId, profiles, switchProfile, createProfile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    hasUrl: boolean;
    hasKey: boolean;
    clientInitialized: boolean;
    urlPreview?: string;
    keyLength?: number;
    startsWithHttp?: boolean;
  } | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await getDbStatus();
        setDbStatus(status);
      } catch (e: any) {
        setDbStatus({ 
          connected: false, 
          hasUrl: false, 
          hasKey: false, 
          clientInitialized: false, 
          urlPreview: "error", 
          keyLength: 0, 
          startsWithHttp: false,
          error: e.message || String(e)
        } as any);
      }
    }
    checkStatus();
  }, [profiles]);

  // Don't show tabs on login screen
  if (pathname === "/login") return null;

  const handleSwitch = async (id: string) => {
    await switchProfile(id);
    router.refresh();
  };

  const handleAdd = () => {
    router.push("/profile?new=true");
  };

  let tooltipText = "Checking database connection status...";
  if (dbStatus) {
    const missing = [];
    if (!dbStatus.hasUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!dbStatus.hasKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (dbStatus.hasUrl && dbStatus.hasKey && !dbStatus.clientInitialized) missing.push("Supabase Client Initialization (check URL format)");
    
    if (missing.length > 0) {
      tooltipText = `Missing environment variables on Netlify: ${missing.join(", ")}. Please add them to your Site Settings.`;
    } else if (!dbStatus.connected) {
      tooltipText = "Database variables exist but connection failed. Check your credentials in Supabase.";
    } else {
      tooltipText = "Successfully connected to cloud Supabase database.";
    }
  }

  return (
    <div className="w-full bg-card/75 border-b border-card-border px-8 pt-4 pb-0 flex items-center justify-between backdrop-blur-xl sticky top-0 z-40">
      <div className="flex items-end gap-6 overflow-x-auto scrollbar-hide flex-1 h-[54px]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase tracking-widest mr-2 shrink-0 pb-3">
          <User className="w-3.5 h-3.5 text-text-muted/70" />
          Active Profile:
        </div>

        <div className="flex items-stretch gap-6 h-full">
          {profiles.map((p) => {
            const isActive = p.id === activeProfileId || (p.id === 'default' && !profiles.some(pr => pr.id === activeProfileId));
            return (
              <div key={p.id} className="flex items-center gap-1 shrink-0 group/tab relative">
                <button
                  onClick={() => handleSwitch(p.id)}
                  className={`pb-2 text-xs font-bold transition-all flex flex-col items-start cursor-pointer border-b-[3px] border-solid ${
                    isActive
                      ? "border-emerald-500 text-emerald-500 font-black px-1"
                      : "border-transparent text-text-muted hover:text-foreground hover:border-card-border px-1"
                  }`}
                >
                  <span>{p.id === 'default' ? 'Lea W - Admin' : p.fullName}</span>
                  {p.targetTitle && (
                    <span className="text-[9px] font-normal text-text-muted/80 dark:text-slate-400 mt-0.5">
                      {p.targetTitle}
                    </span>
                  )}
                </button>
                <a
                  href={`${pathname}?profileId=${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover/tab:opacity-100 focus:opacity-100 hover:text-emerald-400 text-text-muted/60 transition-all pb-3 pl-1"
                  title={`Open ${p.id} in new tab`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleAdd}
          className="px-3 pb-3 text-xs font-bold border-b-2 border-transparent text-text-muted hover:text-foreground transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New Profile
        </button>
      </div>

      <div className="flex items-center gap-3 pl-4 border-l border-card-border shrink-0 ml-4 pb-3">
        {dbStatus?.connected ? (
          <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 animate-pulse" title={tooltipText}>
            <Sparkles className="w-2.5 h-2.5" />
            Cloud Database Connected
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-help" title={tooltipText}>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
              DB Offline (Memory Fallback)
            </div>
            {dbStatus && (
              <span className="text-[7px] text-rose-400 font-mono opacity-80 mt-0.5">
                DEBUG: {(dbStatus as any).error ? `ERROR: ${(dbStatus as any).error}` : JSON.stringify(dbStatus)}
              </span>
            )}
          </div>
        )}

        {/* Dynamic Sidebar Toggle Icon */}
        {pathname === "/search" && (
          <button
            onClick={() => {
              const el = document.getElementById("toggle-strategy-btn");
              if (el) el.click();
            }}
            className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
            title="Toggle Discovery Strategy Sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sidebar-right">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
