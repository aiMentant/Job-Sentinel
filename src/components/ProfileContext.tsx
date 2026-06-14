"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getActiveProfileId, setActiveProfileId } from "@/app/actions/profileSwitch";
import { listAllProfilesWithData } from "@/app/actions/jobActions";

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

  const refreshProfiles = async () => {
    try {
      let urlProfileId = null;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        urlProfileId = params.get("profileId");
      }

      let pId = urlProfileId;
      if (!pId) {
        pId = await getActiveProfileId();
      } else {
        await setActiveProfileId(pId);
      }
      
      setActiveProfileIdState(pId || "default");
      const all = await listAllProfilesWithData();
      setProfiles(all);
    } catch (error) {
      console.error("Failed to load profiles in context:", error);
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
