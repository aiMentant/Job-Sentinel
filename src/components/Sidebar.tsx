"use client";

import React, { useState } from "react";
import { 
  LayoutDashboard, 
  Search, 
  FileText, 
  Settings, 
  Briefcase, 
  CheckCircle2, 
  Cpu, 
  Plus, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  User 
} from "lucide-react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/components/ProfileContext";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Search, label: "Job Search", href: "/search" },
  { icon: Briefcase, label: "Application Tracker", href: "/tracker" },
  { icon: FileText, label: "Submission Log", href: "/applications" },
  { icon: CheckCircle2, label: "Profile & Identity", href: "/profile" },
  { icon: Settings, label: "Agent Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProfileId, profiles, switchProfile, createProfile } = useProfile();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Hide sidebar on login screen
  if (pathname === "/login") return null;

  const handleSwitchProfile = async (id: string) => {
    await switchProfile(id);
    router.refresh(); // Refresh current page to load new profile data
  };

  const handleCreateProfile = async () => {
    const name = prompt("Enter a name for the new profile:");
    if (name && name.trim()) {
      await createProfile(name.trim());
      router.refresh();
    }
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className={`${isCollapsed ? "w-20" : "w-64"} border-r border-white/5 bg-[#0d0d0f]/50 backdrop-blur-xl h-screen sticky top-0 flex flex-col transition-all duration-300 ease-in-out p-4 group/sidebar`}>
      {/* Collapse Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center border border-white/10 text-white shadow-lg opacity-0 group-hover/sidebar:opacity-100 transition-opacity z-50 cursor-pointer"
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} mb-8 px-2`}>
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex-shrink-0 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Cpu className="text-white w-6 h-6" />
        </div>
        {!isCollapsed && (
          <div className="animate-in fade-in duration-300">
            <h1 className="font-bold text-lg leading-tight">Job Sentinel</h1>
            <p className="text-[10px] text-indigo-400 font-medium tracking-widest uppercase">Autonomous Agent</p>
          </div>
        )}
      </div>

      {/* Global Profile Switcher */}
      <div className={`mb-8 px-2 ${isCollapsed ? "flex justify-center" : ""}`}>
        {!isCollapsed ? (
          <div className="animate-in fade-in duration-300">
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2 block">Active Identity</label>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <select 
                  value={activeProfileId}
                  onChange={(e) => handleSwitchProfile(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-bold text-indigo-400 focus:ring-0 cursor-pointer appearance-none truncate"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#0d0d0f]">
                      {p.fullName.toUpperCase()} {p.targetTitle ? `— ${p.targetTitle.toUpperCase()}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
              </div>
              <button 
                onClick={handleCreateProfile}
                className="p-2 rounded-lg bg-white/5 text-slate-500 hover:text-white transition-all border border-white/5 flex-shrink-0 cursor-pointer"
                title="New Profile"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <Link href="/profile" className="p-3 rounded-xl bg-white/5 text-indigo-400 hover:bg-indigo-600/20 transition-all border border-indigo-500/10" title="Switch Identity">
            <User className="w-5 h-5" />
          </Link>
        )}
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3 px-4"} py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? "bg-indigo-600/10 text-indigo-400" 
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
              title={isCollapsed ? item.label : ""}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-indigo-400" : "group-hover:text-white"}`} />
              {!isCollapsed && <span className="font-medium animate-in fade-in slide-in-from-left-2 duration-300">{item.label}</span>}
              {!isCollapsed && item.label === "Job Search" && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              )}
            </Link>
          );
        })}
      </nav>

      {!isCollapsed && (
        <div className="mt-auto bg-white/5 rounded-2xl p-4 border border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {activeProfile?.fullName || activeProfileId.toUpperCase()}
              </p>
              <p className="text-[10px] text-slate-500 truncate capitalize">{activeProfileId} profile</p>
            </div>
          </div>
          <Link 
            href="/profile"
            className="w-full text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider text-left block"
          >
            View AI Profile →
          </Link>
        </div>
      )}
    </div>
  );
}
