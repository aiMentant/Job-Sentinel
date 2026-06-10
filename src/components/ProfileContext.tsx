"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getActiveProfileId, setActiveProfileId } from "@/app/actions/profileSwitch";
import { listAllProfilesWithData } from "@/app/actions/jobActions";

type Profile = {
  id: string;
  fullName: string;
  targetTitle?: string;
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
      const pId = await getActiveProfileId();
      setActiveProfileIdState(pId);
      const all = await listAllProfilesWithData();
      setProfiles(all);
    } catch (error) {
      console.error("Failed to load profiles in context:", error);
    }
  };

  useEffect(() => {
    refreshProfiles();
  }, []);

  const switchProfile = async (id: string) => {
    await setActiveProfileId(id);
    setActiveProfileIdState(id);
    try {
      const all = await listAllProfilesWithData();
      setProfiles(all);
    } catch (e) {}
  };

  const createProfile = async (name: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    await setActiveProfileId(id);
    setActiveProfileIdState(id);
    
    // Save an initial profile structure so it exists in Supabase/FileSystem
    const { saveUserProfile } = await import("@/app/actions/jobActions");
    await saveUserProfile({ 
      fullName: name,
      targetTitles: [],
      targetLocations: [],
      skills: [],
      experience: [],
      education: []
    });
    
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
