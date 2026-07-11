"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getActiveProfileId, setActiveProfileId } from "@/app/actions/profileSwitch";
import { listAllProfilesWithData } from "@/app/actions/jobActions";
import { Cpu } from "lucide-react";
import { usePathname } from "next/navigation";

type Profile = {
  id: string;
  fullName: string;
  targetTitle?: string;
  profilePictureUrl?: string;
};

type ProfileContextType = {
  activeProfileId: string;
  profiles: Profile[];
  switchProfile: (id: string) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  createProfile: (name: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [activeProfileId, setActiveProfileIdState] = useState("default");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  const refreshProfiles = async () => {
    setIsLoading(true);
    try {
      let urlProfileId = null;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        urlProfileId = params.get("profileId");
      }

      let pId = urlProfileId;
      if (!pId) {
        if (typeof document !== "undefined") {
          const match = document.cookie.match(/(?:^|; )active_profile_id=([^;]*)/);
          pId = match ? decodeURIComponent(match[1]) : null;
        }
        if (!pId) {
          pId = await getActiveProfileId();
        }
      } else {
        await setActiveProfileId(pId);
      }
      
      setActiveProfileIdState(pId || "default");
      const all = await listAllProfilesWithData();
      setProfiles(all);
    } catch (error) {
      console.error("Failed to load profiles in context:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Defer state synchronization to the next tick to prevent synchronous cascading render warnings
    const timer = setTimeout(() => {
      refreshProfiles();
    }, 0);
    
    // Listen for history popstate events (e.g. browser back/forward)
    const handlePopState = () => {
      refreshProfiles();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const switchProfile = async (id: string) => {
    await setActiveProfileId(id);
    setActiveProfileIdState(id);
    
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("profileId", id);
      window.history.pushState({}, "", url.toString());
    }

    try {
      const all = await listAllProfilesWithData();
      setProfiles(all);
    } catch {}
  };

  const createProfile = async (name: string) => {
    if (profiles.length >= 10) {
      alert("Maximum limit of 10 profiles reached. Please delete an existing profile to add a new one.");
      return;
    }

    const id = name.toLowerCase().replace(/\s+/g, '-');
    await setActiveProfileId(id);
    setActiveProfileIdState(id);
    
    // Save an initial profile structure so it exists in Supabase/FileSystem
    const { saveUserProfile } = await import("@/app/actions/jobActions");
    const result = await saveUserProfile({ 
      fullName: name,
      targetTitles: [],
      targetLocations: [],
      skills: [],
      experience: [],
      education: []
    }, id);
    
    if (result && !result.success) {
      alert(`Failed to create profile: ${result.error}`);
      return;
    }
    
    await refreshProfiles();
  };

  if (isLoading && pathname !== "/login") {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-[#0a0a0c] text-white font-mono flex-col gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center animate-pulse">
            <Cpu className="w-6 h-6 text-indigo-400" />
          </div>
        </div>
        <div className="text-center space-y-2 mt-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 animate-pulse">Initializing Console</h3>
          <p className="text-xs text-slate-300">Verifying secure keys and checking profile setup...</p>
        </div>
      </div>
    );
  }

  return (
    <ProfileContext.Provider value={{ activeProfileId, profiles, switchProfile, refreshProfiles, createProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
