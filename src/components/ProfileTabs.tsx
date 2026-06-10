"use client";

import React from "react";
import { useProfile } from "./ProfileContext";
import { Plus, User, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function ProfileTabs() {
  const { activeProfileId, profiles, switchProfile, createProfile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();

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

  return (
    <div className="w-full bg-card/75 border-b border-card-border px-8 pt-4 pb-0 flex items-center justify-between backdrop-blur-xl sticky top-0 z-40">
      <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide flex-1 h-11">
        <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase tracking-widest mr-2 shrink-0">
          <User className="w-3.5 h-3.5 text-text-muted/70" />
          Active Profile:
        </div>

        <div className="flex items-stretch gap-6 h-full">
          {profiles.map((p) => {
            const isActive = p.id === activeProfileId;
            return (
              <button
                key={p.id}
                onClick={() => handleSwitch(p.id)}
                className={`px-1 pb-3 text-xs font-bold transition-all flex items-center gap-2 shrink-0 border-b-[3px] cursor-pointer ${
                  isActive
                    ? "border-emerald-500 text-emerald-500"
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
        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 animate-pulse">
          <Sparkles className="w-2.5 h-2.5" />
          Cloud Funnel Online
        </div>
      </div>
    </div>
  );
}
