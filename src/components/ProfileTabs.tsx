"use client";

import React, { useState, useEffect } from "react";
import { useProfile } from "./ProfileContext";
import { Plus, User, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function ProfileTabs() {
  const { activeProfileId, profiles, switchProfile, createProfile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    hasUrl: boolean;
    hasKey: boolean;
    clientInitialized: boolean;
  } | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const { getDbStatus } = await import("@/app/actions/jobActions");
        const status = await getDbStatus();
        setDbStatus(status);
      } catch (e) {
        setDbStatus({ connected: false, hasUrl: false, hasKey: false, clientInitialized: false });
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

  const handleAdd = async () => {
    const name = prompt("Enter a name for the new profile (e.g. Nick, Lance, default):");
    if (name && name.trim()) {
      await createProfile(name.trim());
      router.refresh();
    }
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
      <div className="flex items-end gap-6 overflow-x-auto scrollbar-hide flex-1 h-11">
        <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase tracking-widest mr-2 shrink-0 pb-3">
          <User className="w-3.5 h-3.5 text-text-muted/70" />
          Active Profile:
        </div>

        <div className="flex items-stretch gap-6 h-full">
          {profiles.map((p) => {
            // If the active profile ID isn't in the list of profiles, fallback to highlighting 'default' (Lea Wenban)
            const isActive = p.id === activeProfileId || (p.id === 'default' && !profiles.some(pr => pr.id === activeProfileId));
            return (
              <button
                key={p.id}
                onClick={() => handleSwitch(p.id)}
                className={`px-1 pb-3 text-xs font-bold transition-all flex items-center gap-2 shrink-0 border-b-[3px] border-solid cursor-pointer ${
                  isActive
                    ? "border-emerald-500 text-emerald-500 font-black"
                    : "border-transparent text-text-muted hover:text-foreground hover:border-card-border"
                }`}
              >
                {p.fullName}
                {p.targetTitle && (
                  <span className={`text-[9px] font-medium opacity-60 ${isActive ? 'text-emerald-500/80' : 'text-text-muted'}`}>
                    ({p.targetTitle.slice(0, 15)})
                  </span>
                )}
              </button>
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

      <div className="flex items-center gap-2 pl-4 border-l border-card-border shrink-0 ml-4 pb-3">
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
            {dbStatus && (dbStatus.hasUrl === false || dbStatus.hasKey === false) && (
              <span className="text-[8px] text-rose-400 font-bold tracking-wider uppercase opacity-90">
                Missing: {!dbStatus.hasUrl && "URL"} {!dbStatus.hasKey && "KEY"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
