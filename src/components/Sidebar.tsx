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
  ChevronLeft, 
  ChevronRight, 
  Sun,
  Moon
} from "lucide-react";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useProfile } from "@/components/ProfileContext";
import { useTheme } from "@/components/ThemeContext";

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
  const { activeProfileId, profiles } = useProfile();
  const { theme, toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Hide sidebar on login screen
  if (pathname === "/login") return null;

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className={`${isCollapsed ? "w-20" : "w-64"} border-r border-card-border bg-card/65 backdrop-blur-xl h-screen sticky top-0 flex flex-col transition-all duration-300 ease-in-out p-4 group/sidebar`}>
      {/* Collapse Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-foreground rounded-full flex items-center justify-center border border-card-border text-background shadow-md opacity-0 group-hover/sidebar:opacity-100 transition-opacity z-50 cursor-pointer animate-in fade-in"
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} mb-8 px-2`}>
        <div className="w-10 h-10 bg-foreground rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm">
          <Cpu className="text-background w-5 h-5" />
        </div>
        {!isCollapsed && (
          <div className="animate-in fade-in duration-300">
            <h1 className="font-bold text-lg leading-tight text-foreground">Job Sentinel</h1>
            <p className="text-[10px] text-accent-primary font-bold tracking-widest uppercase">Autonomous Agent</p>
          </div>
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
                  ? "bg-foreground/5 text-foreground font-semibold border border-card-border" 
                  : "text-text-muted hover:bg-foreground/5 hover:text-foreground"
              }`}
              title={isCollapsed ? item.label : ""}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-foreground" : "text-text-muted group-hover:text-foreground"}`} />
              {!isCollapsed && <span className="font-medium animate-in fade-in slide-in-from-left-2 duration-300 text-sm">{item.label}</span>}
              {!isCollapsed && item.label === "Job Search" && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggler */}
      <button
        onClick={toggleTheme}
        className={`flex items-center ${isCollapsed ? "justify-center px-0" : "gap-3 px-4"} py-3 mb-4 rounded-xl text-text-muted hover:bg-foreground/5 hover:text-foreground transition-all duration-200 cursor-pointer`}
        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        {!isCollapsed && <span className="font-semibold text-sm animate-in fade-in duration-300">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
      </button>

      {!isCollapsed && (
        <div className="mt-auto bg-background border border-card-border rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3 mb-3">
            {activeProfile?.profilePictureUrl ? (
              <Image 
                src={activeProfile.profilePictureUrl} 
                alt={activeProfile.fullName} 
                width={32}
                height={32}
                unoptimized
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-card-border"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-white">
                {activeProfile?.fullName 
                  ? activeProfile.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() 
                  : "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">
                {activeProfile?.fullName || activeProfileId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </p>
              <p className="text-[10px] text-text-muted truncate capitalize">{activeProfileId === 'default' ? 'Lea W - Admin' : activeProfileId} Profile</p>
            </div>
          </div>
          <Link 
            href="/profile"
            className="w-full text-[11px] font-black text-accent-primary hover:opacity-85 transition-opacity uppercase tracking-wider text-left block"
          >
            View AI Profile →
          </Link>
        </div>
      )}
    </div>
  );
}
