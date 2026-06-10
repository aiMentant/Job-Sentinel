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
    const name = prompt("Enter a name for the new profile identity (e.g. Son, Brother, Partner):");
    if (name && name.trim()) {
      await createProfile(name.trim());
      router.refresh();
    }
  };

  return (
    <div className="w-full bg-[#0d0d0f]/60 border-b border-white/5 px-8 py-3 flex items-center justify-between backdrop-blur-xl sticky top-0 z-40">
      <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide flex-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mr-2 border-r border-white/10 pr-4 shrink-0">
          <User className="w-3.5 h-3.5" />
          Identity:
        </div>

        <div className="flex items-center gap-2">
          {profiles.map((p) => {
            const isActive = p.id === activeProfileId;
            return (
              <button
                key={p.id}
                onClick={() => handleSwitch(p.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0 border cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15"
                    : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                {p.fullName}
                {p.targetTitle && (
                  <span className={`text-[9px] font-medium opacity-60 ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>
                    ({p.targetTitle.slice(0, 15)})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleAdd}
          className="p-1.5 rounded-full bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5 text-xs font-bold px-3 shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Identity
        </button>
      </div>

      <div className="flex items-center gap-2 pl-4 border-l border-white/5 shrink-0 ml-4">
        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 animate-pulse">
          <Sparkles className="w-2.5 h-2.5" />
          Cloud Funnel Online
        </div>
      </div>
    </div>
  );
}
