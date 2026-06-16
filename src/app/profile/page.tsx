"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense } from "react";
import { 
  Save, 
  FileText, 
  Settings,
  MapPin, 
  Plus, 
  Trash2, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Building2,
  GraduationCap,
  Upload,
  Target
} from "lucide-react";
import { parseResumeText, saveUserProfile, fetchUserProfile, listAllProfilesWithData, deleteProfile, runLinkedInProfileScrape, parseUploadedFile, safeParseUploadedFile, safeParseResumeText, safeLinkedInProfileScrape } from "@/app/actions/jobActions";

import { getActiveProfileId, setActiveProfileId } from "@/app/actions/profileSwitch";
import { findRoleFit, upgradeBullets } from "@/app/actions/careerTools";
import { UserProfile, WorkExperience, Education, QuickAnswer, SalaryExpectations } from "@/lib/db";
import { useProfile } from "@/components/ProfileContext";
import { useSearchParams, useRouter } from "next/navigation";

function ProfilePageContent() {
  const [resumeText, setResumeText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [expandedSection, setExpandedSection] = useState<string | null>("experience");
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSearch, setCopiedSearch] = useState(false);

  const { activeProfileId, profiles, switchProfile, createProfile, refreshProfiles } = useProfile();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isNewMode = searchParams.get("new") === "true";
  const [newProfileId, setNewProfileId] = useState("");
  const [editableProfileId, setEditableProfileId] = useState("");

  const setProfileHelper = (data: Partial<UserProfile>) => {
    const updated = { ...data };
    if (updated.fullName && (!updated.firstName || !updated.lastName)) {
      const parts = updated.fullName.trim().split(/\s+/);
      updated.firstName = parts[0] || "";
      updated.lastName = parts.slice(1).join(" ") || "";
      // Re-compute standard format
      updated.fullName = `${updated.firstName} ${updated.lastName ? updated.lastName[0] + "." : ""}`.trim();
    }
    if (!updated.firstName) updated.firstName = "";
    if (!updated.lastName) updated.lastName = "";
    setProfile(updated);
  };

  const handleNameChange = (first: string, last: string) => {
    const computedFullName = `${first} ${last ? last[0] + "." : ""}`.trim();
    setProfile(prev => ({
      ...prev,
      firstName: first,
      lastName: last,
      fullName: computedFullName
    }));
  };

  // Career Tools state
  const [isRewriting, setIsRewriting] = useState(false);
  const [isFindingRoles, setIsFindingRoles] = useState(false);
  const [upgradingBulletIdx, setUpgradingBulletIdx] = useState<number | null>(null);
  const [aiResultModal, setAiResultModal] = useState<{ title: string; content: string } | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleLinkedInScrape = async () => {
    if (!linkedInUrl) return;
    setIsScraping(true);
    setStatus("Scraping LinkedIn profile...");
    
    const scrapeRes = await safeLinkedInProfileScrape(linkedInUrl);
    if (!scrapeRes.success) {
      alert(scrapeRes.error || "Failed to scrape LinkedIn profile.");
      setStatus("LinkedIn scrape failed.");
      setIsScraping(false);
      return;
    }

    const text = scrapeRes.text || "";
    setResumeText(text);
    setStatus("LinkedIn profile scraped. Parsing into profile structure...");
    
    const parseRes = await safeParseResumeText(text, activeProfileId);
    if (!parseRes.success) {
      const isQuotaError = parseRes.error?.includes("429") || parseRes.error?.includes("quota");
      if (isQuotaError) {
        alert("Gemini API Quota Exceeded (429). The profile text was successfully extracted and loaded on the left, but the AI could not auto-parse the details. Please go to Settings to add your own active Gemini API Key, or fill in the details manually.");
      } else {
        alert(parseRes.error || "Failed to parse profile.");
      }
      setStatus("LinkedIn scrape failed.");
      setIsScraping(false);
      return;
    }

    const data = parseRes.data || {};
    if (Object.keys(data).length === 0 || (!data.fullName && !data.experience?.length)) {
      setStatus("LinkedIn scrape succeeded, but AI found no structured data. Review raw text on left.");
    } else {
      setProfileHelper(data);
      setStatus("LinkedIn profile imported successfully.");
    }
    setIsScraping(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setStatus(`Reading ${file.name}...`);
    
    const formData = new FormData();
    formData.append("file", file);
    
    const fileRes = await safeParseUploadedFile(formData);
    if (!fileRes.success) {
      alert(fileRes.error || "Failed to read file.");
      setStatus("Resume upload failed.");
      setIsUploading(false);
      e.target.value = "";
      return;
    }

    const text = fileRes.text || "";
    setResumeText(text);
    setStatus("File content loaded. Parsing into profile structure...");
    
    const parseRes = await safeParseResumeText(text, activeProfileId);
    if (!parseRes.success) {
      const isQuotaError = parseRes.error?.includes("429") || parseRes.error?.includes("quota");
      if (isQuotaError) {
        alert("Gemini API Quota Exceeded (429). The PDF text was successfully extracted and loaded on the left, but the AI could not auto-parse the details. Please go to Settings to add your own active Gemini API Key, or fill in the details manually.");
      } else {
        alert(parseRes.error || "Failed to parse resume.");
      }
      setStatus("Resume upload failed.");
      setIsUploading(false);
      e.target.value = "";
      return;
    }

    const data = parseRes.data || {};
    if (Object.keys(data).length === 0 || (!data.fullName && !data.experience?.length)) {
      setStatus("Resume upload succeeded, but AI found no structured data. Review raw text on left.");
    } else {
      setProfileHelper(data);
      setStatus("Resume file imported successfully.");
    }
    setIsUploading(false);
    e.target.value = "";
  };

  const [isDataLoading, setIsDataLoading] = useState(false);

  useEffect(() => {
    if (isNewMode) {
      setProfileHelper({
        fullName: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        location: "",
        portfolioUrl: "",
        linkedInUrl: "",
        experience: [],
        education: [],
        skills: [],
        targetTitles: [],
        targetLocations: [],
      });
      setResumeText("");
      setNewProfileId("");
      setEditableProfileId("");
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsDataLoading(true);
      try {
        const savedProfile = await fetchUserProfile();
        if (!isMounted) return;
        if (savedProfile) {
          setProfileHelper(savedProfile);
          setResumeText(savedProfile.resumeText || "");
          setEditableProfileId(activeProfileId);
        } else {
          setProfileHelper({});
          setResumeText("");
          setEditableProfileId("");
        }
      } catch (error: any) {
        if (!isMounted) return;
        console.error("Failed to load profile data:", error);
        setStatus(`Database error: ${error.message || error}`);
      } finally {
        if (isMounted) {
          setIsDataLoading(false);
        }
      }
    }
    loadData();

    return () => {
      isMounted = false;
    };
  }, [activeProfileId, isNewMode]);

  const handleSwitchProfile = async (id: string) => {
    await switchProfile(id);
  };

  const handleCreateProfile = async () => {
    router.push("/profile?new=true");
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;
    const pw = prompt("Enter Admin Password to delete this profile:");
    if (pw !== "pixel1") {
      alert("Incorrect password. Access Denied.");
      return;
    }
    try {
      await deleteProfile(profileToDelete);
      setProfileToDelete(null);
      setDeleteConfirmText("");
      await refreshProfiles();
      setStatus("Identity successfully removed.");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus("Saving profile to local database...");
    
    const first = profile.firstName || "";
    const last = profile.lastName || "";
    let finalId = isNewMode ? newProfileId.trim() : editableProfileId.trim();

    if (activeProfileId === "default" || finalId === "default") {
      const pw = prompt("Enter Admin Password to modify this profile:");
      if (pw !== "pixel1") {
        alert("Incorrect password. Access Denied.");
        setIsSaving(false);
        return;
      }
    }

    // Prepopulate with first name and last initial if nothing is entered
    if (!finalId && first) {
      finalId = `${first.charAt(0).toUpperCase() + first.slice(1)}${last ? "-" + last[0].toUpperCase() : ""}`.replace(/[^a-zA-Z0-9-_]/g, '');
    }

    if (!finalId) {
      alert("Please enter a Profile ID/Slug or enter a First Name to generate one.");
      setIsSaving(false);
      return;
    }

    // Handle renaming of an existing profile
    if (!isNewMode && activeProfileId !== finalId) {
      try {
        const profileToSave = { ...profile, resumeText };
        await saveUserProfile(profileToSave, finalId);
        if (activeProfileId !== "default") {
          await deleteProfile(activeProfileId);
        }
        await setActiveProfileId(finalId);
      } catch (error: any) {
        alert(`Failed to rename profile: ${error.message}`);
        setIsSaving(false);
        return;
      }
    } else {
      const profileToSave = { ...profile, resumeText };
      const result = await saveUserProfile(profileToSave, finalId);
      if (result && !result.success) {
        alert(`Failed to save profile: ${result.error}`);
        setIsSaving(false);
        return;
      }
      if (isNewMode) {
        await setActiveProfileId(finalId);
      }
    }

    await refreshProfiles();
    setStatus("Profile securely saved.");
    setIsSaving(false);

    if (isNewMode) {
      router.push("/profile");
    }
  };

  const handleParse = async () => {
    if (!resumeText) return;
    setIsParsing(true);
    
    const parseRes = await safeParseResumeText(resumeText, activeProfileId);
    if (!parseRes.success) {
      const isQuotaError = parseRes.error?.includes("429") || parseRes.error?.includes("quota");
      if (isQuotaError) {
        alert("Gemini API Quota Exceeded (429). The AI parser failed. Please go to Settings to add your own active Gemini API Key, or fill in the details manually.");
      } else {
        alert(parseRes.error || "Failed to parse resume. Check your API key connection.");
      }
      setStatus("Failed to parse resume.");
      setIsParsing(false);
      return;
    }

    const data = parseRes.data || {};
    if (Object.keys(data).length === 0 || (!data.fullName && !data.experience?.length)) {
      setStatus("AI found no structured data. Try a different format.");
    } else {
      setProfileHelper(data);
      setStatus("Parse successful. Review and edit on the right.");
    }
    setIsParsing(false);
  };

  const updateExperience = (index: number, field: keyof WorkExperience, value: any) => {
    const newExp = [...(profile.experience || [])];
    newExp[index] = { ...newExp[index], [field]: value };
    setProfile({ ...profile, experience: newExp });
  };

  const updateEducation = (index: number, field: keyof Education, value: any) => {
    const newEdu = [...(profile.education || [])];
    newEdu[index] = { ...newEdu[index], [field]: value };
    setProfile({ ...profile, education: newEdu });
  };

  const removeArrayItem = (field: 'skills' | 'targetTitles' | 'alternativeTitles' | 'targetLocations', index: number) => {
    const arr = [...(profile[field] || [])];
    arr.splice(index, 1);
    setProfile({ ...profile, [field]: arr });
  };

  const addArrayItem = (field: 'skills' | 'targetTitles' | 'alternativeTitles' | 'targetLocations', value: string) => {
    if (!value.trim()) return;
    const arr = [...(profile[field] || [])];
    arr.push(value.trim());
    setProfile({ ...profile, [field]: arr });
  };

  // Tool 1 removed from profile — AI Rewrite lives in the Applications workflow only

  // Tool 3: Find overlooked roles based on skills
  const handleFindRoleFit = async () => {
    setIsFindingRoles(true);
    try {
      const roles = await findRoleFit();
      const content = roles.map((r, i) => `${i + 1}. **${r.title}** (Demand: ${r.demandScore}/100)\n   ${r.reasoning}`).join("\n\n");
      setAiResultModal({ title: "Roles You Might Be Overlooking", content });
      // Offer to bulk-add to targetTitles
      const topTitles = roles.slice(0, 5).map(r => r.title);
      if (confirm(`Add top 5 suggested titles to your Target Roles?\n\n${topTitles.join("\n")}`)) {
        setProfile(prev => ({ ...prev, targetTitles: [...new Set([...(prev.targetTitles || []), ...topTitles])] }));
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to suggest roles.");
    } finally {
      setIsFindingRoles(false);
    }
  };

  const openExternalBooleanSearch = (query: string, platform: 'linkedin' | 'indeed') => {
    if (!query) return;
    const location = profile.targetLocations?.[0] || profile.location || "";
    let url = "";
    if (platform === 'linkedin') {
      url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}`;
      if (location) url += `&location=${encodeURIComponent(location)}`;
    } else {
      url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}`;
      if (location) url += `&l=${encodeURIComponent(location)}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Tool 4: Upgrade bullet points for a specific role
  const handleUpgradeBullets = async (expIndex: number) => {
    setUpgradingBulletIdx(expIndex);
    try {
      const bullets = profile.experience?.[expIndex]?.achievements || [];
      const upgraded = await upgradeBullets(bullets);
      const newExp = [...(profile.experience || [])];
      newExp[expIndex] = { ...newExp[expIndex], achievements: upgraded };
      setProfile({ ...profile, experience: newExp });
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to upgrade achievements.");
    } finally {
      setUpgradingBulletIdx(null);
    }
  };

  return (
    <>
    <div className="p-8 max-w-none mx-auto space-y-8">

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold font-outfit text-foreground">Identity Hub</h2>
            <p className="text-text-muted text-sm mt-1">Switch between resumes or create a new profile for a different user.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={async () => {
                if (isNewMode) {
                  router.push("/profile");
                  return;
                }
                const savedProfile = await fetchUserProfile();
                if (savedProfile) {
                  setProfile(savedProfile);
                  setResumeText(savedProfile.resumeText || "");
                }
                setStatus("Changes discarded.");
                setTimeout(() => setStatus(null), 3000);
              }} 
              className="btn-secondary"
            >
              {isNewMode ? "Cancel" : "Discard"}
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>

        {/* Horizontal Tabs List */}
        <div className="flex flex-wrap items-center gap-2 border-b border-card-border pb-3">
          {profiles.map(p => {
            const isActive = p.id === activeProfileId;
            return (
              <div 
                key={p.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isActive 
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md shadow-indigo-500/5" 
                    : "bg-card border-card-border text-text-muted hover:bg-foreground/5 hover:text-foreground"
                }`}
                onClick={() => handleSwitchProfile(p.id)}
              >
                <span>{p.id === 'default' ? 'LEA W - ADMIN' : p.id.toUpperCase()}</span>
                
                {p.id !== "default" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfileToDelete(p.id);
                      setDeleteConfirmText("");
                    }}
                    className="p-0.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1 cursor-pointer"
                    title="Delete Identity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          
          <button
            onClick={handleCreateProfile}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-card border border-card-border text-text-muted hover:bg-foreground/5 hover:text-foreground transition-all cursor-pointer"
            title="Create New Identity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        {isDataLoading && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4 rounded-3xl min-h-[400px]">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted animate-pulse">Syncing profile identity...</p>
          </div>
        )}
        {/* Left: Raw Ingest */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <FileText className="w-5 h-5" />
                <h3 className="font-bold">Source of Truth Resume</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase font-bold tracking-widest text-text-muted bg-foreground/5 px-2 py-0.5 rounded">Protected</span>
                <button 
                  onClick={handleParse}
                  disabled={isParsing || !resumeText}
                  className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {isParsing ? "Analyzing..." : "AI Parse →"}
                </button>
              </div>
            </div>
            {/* LinkedIn Scraper & File Upload Quick Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-foreground/[0.02] rounded-xl border border-card-border">
              <div className="space-y-2">
                <label className="text-[10px] text-text-muted uppercase font-bold tracking-wider flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect x="2" y="9" width="4" height="12" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                  LinkedIn Import
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={linkedInUrl}
                    onChange={(e) => setLinkedInUrl(e.target.value)}
                    className="input-field text-xs py-1.5 w-full"
                  />
                  <button
                    onClick={handleLinkedInScrape}
                    disabled={isScraping || !linkedInUrl}
                    className="w-full py-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-bold border border-indigo-500/20 hover:bg-indigo-500/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isScraping ? "Scraping..." : "Scrape"}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-text-muted uppercase font-bold tracking-wider flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5 text-emerald-400" /> ATS Resume Upload
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".txt,.pdf,.docx"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex flex-col items-center justify-center gap-1 border border-dashed border-card-border hover:border-emerald-500/30 bg-card hover:bg-emerald-500/[0.02] transition-all h-[76px] rounded-lg text-xs font-medium text-text-muted">
                    <Upload className="w-4 h-4 text-text-muted" />
                    <span>{isUploading ? "Uploading..." : "Upload PDF / DOCX / TXT"}</span>
                  </div>
                </div>
              </div>
            </div>
            <textarea 
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="input-field w-full h-[600px] font-mono text-[11px] resize-none leading-relaxed bg-card"
              placeholder="# Paste your ATS-friendly resume here..."
            />
            {status && (
              <p className={`text-[10px] font-bold uppercase tracking-wider ${status.toLowerCase().includes("failed") || status.toLowerCase().includes("error") ? "text-red-400" : "text-emerald-400"}`}>
                {status}
              </p>
            )}
          </div>
        </div>

        {/* Right: Structured Review */}
        <div className="lg:col-span-7 space-y-6">
          {Object.keys(profile).length === 0 && !isParsing ? (
            <div className="glass-card py-32 text-center space-y-4 border-dashed">
              <Sparkles className="w-12 h-12 text-text-muted mx-auto" />
              <div>
                <p className="font-bold text-text-muted">No Structured Data Yet</p>
                <p className="text-xs text-text-muted max-w-xs mx-auto">
                  Paste your resume on the left and click "AI Parse" to generate your automation profile.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                {/* Profile Identity Name ID field */}
                <div className="space-y-1.5">
                  <label className="text-xs text-text-muted font-bold">Profile Identity Name (ID)</label>
                  <input 
                    type="text" 
                    value={isNewMode ? newProfileId : editableProfileId} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9-_]/g, '');
                      if (isNewMode) {
                        setNewProfileId(val);
                      } else {
                        setEditableProfileId(val);
                      }
                    }}
                    placeholder="e.g. lea-w" 
                    className="input-field text-sm w-full"
                  />
                </div>

                {/* First and Last Name Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-text-muted font-bold">First Name</label>
                    <input 
                      type="text" 
                      value={profile.firstName || ""} 
                      onChange={(e) => handleNameChange(e.target.value, profile.lastName || "")}
                      placeholder="e.g. Lea" 
                      className="input-field text-sm w-full"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-text-muted font-bold">Last Name</label>
                    <input 
                      type="text" 
                      value={profile.lastName || ""} 
                      onChange={(e) => handleNameChange(profile.firstName || "", e.target.value)}
                      placeholder="e.g. Wenban" 
                      className="input-field text-sm w-full"
                    />
                  </div>
                </div>

                {/* Bio Details Card */}
                <div className="glass-card grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-text-muted font-bold">Contact Email</label>
                    <input 
                      type="email" 
                      value={profile.email || ""} 
                      onChange={(e) => setProfile({...profile, email: e.target.value})}
                      placeholder="e.g. robert@email.com"
                      className="input-field text-sm w-full" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-text-muted font-bold">Phone Number</label>
                    <input 
                      type="text" 
                      value={profile.phone || ""} 
                      onChange={(e) => setProfile({...profile, phone: e.target.value})}
                      placeholder="e.g. +44 7123 456789"
                      className="input-field text-sm w-full" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-text-muted font-bold">LinkedIn Profile URL</label>
                    <input 
                      type="text" 
                      value={profile.linkedInUrl || ""} 
                      onChange={(e) => {
                        setProfile({...profile, linkedInUrl: e.target.value});
                        setLinkedInUrl(e.target.value);
                      }}
                      placeholder="https://linkedin.com/in/username"
                      className="input-field text-sm w-full" 
                    />
                  </div>
                </div>

              {/* Collapsible Sections */}
              <div className="space-y-4">
                {/* Work Experience */}
                <div className="glass-card !p-0 overflow-hidden">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === "experience" ? null : "experience")}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-foreground/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="font-bold">Work History</h3>
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-bold">
                        {profile.experience?.length || 0} Roles
                      </span>
                    </div>
                    {expandedSection === "experience" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {expandedSection === "experience" && (
                    <div className="p-6 pt-0 space-y-6 border-t border-card-border bg-foreground/[0.01]">
                      {profile.experience?.map((exp, i) => (
                        <div key={i} className="space-y-4 pt-6 first:pt-0 border-t first:border-none border-card-border">
                          <div className="grid grid-cols-2 gap-4">
                            <input 
                              className="input-field text-sm font-bold" 
                              value={exp.company} 
                              onChange={(e) => updateExperience(i, "company", e.target.value)}
                              placeholder="Company Name"
                            />
                            <input 
                              className="input-field text-sm" 
                              value={exp.role} 
                              onChange={(e) => updateExperience(i, "role", e.target.value)}
                              placeholder="Job Title"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <input 
                              className="input-field text-xs" 
                              value={exp.startDate || ""} 
                              onChange={(e) => updateExperience(i, "startDate", e.target.value)}
                              placeholder="Start Date" 
                            />
                            <input 
                              className="input-field text-xs" 
                              value={exp.endDate || ""} 
                              onChange={(e) => updateExperience(i, "endDate", e.target.value)}
                              placeholder="End Date" 
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] text-text-muted uppercase font-bold">Key Achievements</label>
                              <button
                                onClick={() => handleUpgradeBullets(i)}
                                disabled={upgradingBulletIdx === i}
                                className="text-[10px] uppercase font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                              >
                                {upgradingBulletIdx === i ? "Upgrading..." : "✦ Upgrade Bullets"}
                              </button>
                            </div>
                            <div className="space-y-2">
                              {exp.achievements.map((ach, j) => (
                                <div key={j} className="flex gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 mt-2 shrink-0" />
                                  <textarea 
                                    className="bg-transparent border-none text-xs text-foreground w-full p-0 focus:ring-0 resize-none" 
                                    value={ach}
                                    onChange={(e) => {
                                      const newExp = [...(profile.experience || [])];
                                      const newAch = [...newExp[i].achievements];
                                      newAch[j] = e.target.value;
                                      newExp[i] = { ...newExp[i], achievements: newAch };
                                      setProfile({ ...profile, experience: newExp });
                                    }}
                                    rows={2}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Education */}
                <div className="glass-card !p-0 overflow-hidden">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === "education" ? null : "education")}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-foreground/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <h3 className="font-bold">Education</h3>
                    </div>
                    {expandedSection === "education" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {expandedSection === "education" && (
                    <div className="p-6 pt-0 space-y-4 border-t border-card-border">
                      {profile.education?.map((edu, i) => (
                        <div key={i} className="grid grid-cols-2 gap-4 py-4">
                          <input 
                            className="input-field text-sm font-bold" 
                            value={edu.institution || ""} 
                            onChange={(e) => updateEducation(i, "institution", e.target.value)}
                            placeholder="Institution"
                          />
                          <input 
                            className="input-field text-sm" 
                            value={edu.degree || ""} 
                            onChange={(e) => updateEducation(i, "degree", e.target.value)}
                            placeholder="Degree / Field"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Extracted Search Parameters */}
                <div className="glass-card space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        Target Job Titles
                      </h3>
                      <button
                        onClick={handleFindRoleFit}
                        disabled={isFindingRoles}
                        className="text-[10px] uppercase font-bold px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-500/20 hover:bg-indigo-500/20 transition-all disabled:opacity-50"
                        title="AI suggests roles you may be overlooking"
                      >
                        {isFindingRoles ? "Analyzing..." : "✦ Suggest Roles"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {profile.targetTitles?.map((title, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-600 dark:text-indigo-300 flex items-center gap-2">
                          <span 
                            onClick={() => openExternalBooleanSearch(title, 'linkedin')}
                            className="cursor-pointer hover:underline hover:text-indigo-400"
                            title="Click to search role on LinkedIn"
                          >
                            {title}
                          </span>
                          <button onClick={() => removeArrayItem('targetTitles', i)} className="hover:text-white">&times;</button>
                        </span>
                      ))}
                    </div>
                    <input 
                      type="text" 
                      placeholder="Add job title and press Enter..." 
                      className="input-field text-sm w-full"
                      onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('targetTitles', e.currentTarget.value); e.currentTarget.value = ''; } }}
                    />
                  </div>

                  <div>
                    <h3 className="font-bold flex items-center gap-2 mb-3 mt-6">
                      <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Alternative / Legacy Job Titles
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      Secondary or historical titles used as a fallback if primary roles don't yield enough matches. 
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {profile.alternativeTitles?.map((title, i) => (
                        <span key={i} className="px-3 py-1 bg-gray-500/10 border border-gray-500/20 rounded-full text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                          <span>{title}</span>
                          <button onClick={() => removeArrayItem('alternativeTitles', i)} className="hover:text-red-400">&times;</button>
                        </span>
                      ))}
                    </div>
                    <input 
                      type="text" 
                      placeholder="Add alternative title and press Enter..." 
                      className="input-field text-sm w-full"
                      onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('alternativeTitles', e.currentTarget.value); e.currentTarget.value = ''; } }}
                    />
                  </div>

                  <div>
                    <h3 className="font-bold flex items-center gap-2 mb-3">
                      <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      Search Locations (Cities/Postcodes)
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {profile.targetLocations?.map((loc, i) => (
                        <span key={i} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
                          {loc}
                          <button onClick={() => removeArrayItem('targetLocations', i)} className="hover:text-white">&times;</button>
                        </span>
                      ))}
                    </div>
                    <input 
                      type="text" 
                      placeholder="Add city or postcode and press Enter..." 
                      className="input-field text-sm w-full"
                      onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('targetLocations', e.currentTarget.value); e.currentTarget.value = ''; } }}
                    />
                  </div>

                  {/* Positioning Summary */}
                  <div>
                    <h3 className="font-bold flex items-center gap-2 mb-3">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      Positioning Summary (Elevator Pitch)
                    </h3>
                    <textarea
                      placeholder="A 1-sentence high-impact elevator pitch to customize cover letters..."
                      className="input-field text-sm w-full h-20 resize-none font-medium text-foreground leading-relaxed"
                      value={profile.positioningSummary || ""}
                      onChange={(e) => setProfile({ ...profile, positioningSummary: e.target.value })}
                    />
                  </div>

                  {/* Boolean Search String */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-500" />
                        Boolean Search String
                      </h3>
                      {profile.booleanSearchString && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(profile.booleanSearchString || "");
                            setCopiedSearch(true);
                            setTimeout(() => setCopiedSearch(false), 2000);
                          }}
                          className="text-[10px] uppercase font-bold px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                        >
                          {copiedSearch ? "✓ Copied" : "Copy Query"}
                        </button>
                      )}
                    </div>
                    <textarea
                      placeholder='e.g. ("Programme Director" OR "Head of PMO") AND (IT OR Digital)...'
                      className="input-field text-xs font-mono w-full h-20 resize-none text-indigo-400 bg-black/10 dark:bg-black/25 leading-relaxed"
                      value={profile.booleanSearchString || ""}
                      onChange={(e) => setProfile({ ...profile, booleanSearchString: e.target.value })}
                    />
                    {profile.booleanSearchString && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => openExternalBooleanSearch(profile.booleanSearchString || "", 'linkedin')}
                          className="text-[10px] uppercase font-bold px-3 py-1 bg-blue-600/10 text-blue-500 rounded border border-blue-500/20 hover:bg-blue-600/20 transition-all cursor-pointer flex-1"
                        >
                          Search LinkedIn
                        </button>
                        <button
                          onClick={() => openExternalBooleanSearch(profile.booleanSearchString || "", 'indeed')}
                          className="text-[10px] uppercase font-bold px-3 py-1 bg-indigo-600/10 text-indigo-500 rounded border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer flex-1"
                        >
                          Search Indeed
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold flex items-center gap-2 mb-3">
                      <FileText className="w-5 h-5 text-text-muted" />
                      Core Skills
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {profile.skills?.map((skill, i) => (
                        <span key={i} className="px-3 py-1 bg-black/5 dark:bg-white/5 border border-card-border rounded-full text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          {skill}
                          <button onClick={() => removeArrayItem('skills', i)} className="hover:text-white">&times;</button>
                        </span>
                      ))}
                    </div>
                    <input 
                      type="text" 
                      placeholder="Add skill and press Enter..." 
                      className="input-field text-sm w-full"
                      onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('skills', e.currentTarget.value); e.currentTarget.value = ''; } }}
                    />
                  </div>
                </div>

                {/* Salary Expectations */}
                <div className="glass-card space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400">£</span>
                    Salary Expectations
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Minimum", key: "minimumAcceptable" },
                      { label: "Target", key: "targetSalary" },
                      { label: "Max Ask", key: "maximumAsk" },
                    ].map(({ label, key }) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[10px] text-text-muted uppercase font-bold">{label}</label>
                        <input
                          type="number"
                          className="input-field text-sm w-full"
                          placeholder="75000"
                          value={(profile.salaryExpectations as any)?.[key] || ""}
                          onChange={(e) => setProfile({
                            ...profile,
                            salaryExpectations: {
                              currency: 'GBP',
                              minimumAcceptable: 0,
                              targetSalary: 0,
                              maximumAsk: 0,
                              negotiable: true,
                              ...(profile.salaryExpectations || {}),
                              [key]: Number(e.target.value)
                            }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="input-field text-sm flex-1"
                      value={profile.salaryExpectations?.currency || 'GBP'}
                      onChange={(e) => setProfile({ ...profile, salaryExpectations: { ...profile.salaryExpectations as any, currency: e.target.value as any } })}
                    >
                      <option value="GBP">GBP £</option>
                      <option value="USD">USD $</option>
                      <option value="EUR">EUR €</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.salaryExpectations?.negotiable ?? true}
                        onChange={(e) => setProfile({ ...profile, salaryExpectations: { ...profile.salaryExpectations as any, negotiable: e.target.checked } })}
                        className="w-3 h-3"
                      />
                      Negotiable
                    </label>
                  </div>
                </div>

                {/* Application Defaults */}
                <div className="glass-card space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Settings className="w-5 h-5 text-text-muted" />
                    Application Defaults
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-text-muted uppercase font-bold">Work Authorisation</label>
                      <input
                        className="input-field text-sm w-full"
                        placeholder="e.g. UK Citizen, Need sponsorship"
                        value={profile.workAuthorisation || ""}
                        onChange={(e) => setProfile({ ...profile, workAuthorisation: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-text-muted uppercase font-bold">Notice Period</label>
                      <input
                        className="input-field text-sm w-full"
                        placeholder="e.g. 1 month, Immediate"
                        value={profile.noticePeriod || ""}
                        onChange={(e) => setProfile({ ...profile, noticePeriod: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-text-muted uppercase font-bold">Daily Application Cap</label>
                      <input
                        type="number"
                        className="input-field text-sm w-full"
                        placeholder="15"
                        value={profile.applicationDailyLimit || 15}
                        onChange={(e) => setProfile({ ...profile, applicationDailyLimit: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-text-muted uppercase font-bold">Supervised Rounds Before Auto</label>
                      <input
                        type="number"
                        className="input-field text-sm w-full"
                        placeholder="5"
                        value={profile.supervisedModeCount || 5}
                        onChange={(e) => setProfile({ ...profile, supervisedModeCount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1 col-span-2 mt-2">
                      <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked={profile.dailySearchEnabled || false}
                          onChange={(e) => setProfile({ ...profile, dailySearchEnabled: e.target.checked })}
                          className="w-4 h-4 text-indigo-500 rounded border-card-border"
                        />
                        Enable Daily Background Search & Email Reports
                      </label>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* AI Result Modal */}
    {aiResultModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
        <div className="glass-card w-full max-w-2xl max-h-[80vh] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{aiResultModal.title}</h3>
            <button onClick={() => setAiResultModal(null)} className="text-text-muted hover:text-foreground">✕</button>
          </div>
          <textarea
            className="flex-1 bg-card rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 font-mono resize-none min-h-[400px] border border-card-border focus:ring-0"
            value={aiResultModal.content}
            readOnly
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { navigator.clipboard.writeText(aiResultModal.content); }}
              className="btn-secondary py-2 px-4 text-xs"
            >
              Copy to Clipboard
            </button>
            {aiResultModal.title === "AI-Rewritten Resume" && (
              <button
                onClick={() => { setResumeText(aiResultModal.content); setAiResultModal(null); }}
                className="btn-primary py-2 px-4 text-xs"
              >
                Replace Resume Text
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    {/* Delete Confirmation Modal */}
    {profileToDelete && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="glass-card w-full max-w-md p-8 space-y-6 border-red-500/30">
          <div className="flex items-center gap-4 text-red-400">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Delete Identity?</h3>
              <p className="text-xs text-text-muted">This action is permanent and cannot be undone.</p>
            </div>
          </div>
          
          <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl space-y-2">
             <p className="text-sm text-slate-900 dark:text-slate-300 font-medium">You are about to delete:</p>
             <p className="text-lg font-black text-foreground">{profiles.find(p => p.id === profileToDelete)?.fullName || profileToDelete.toUpperCase()}</p>
             <p className="text-[10px] text-red-600 dark:text-red-400/80 font-bold uppercase tracking-widest">All associated jobs, resumes, and search history will be purged.</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
              Type <span className="text-red-600 dark:text-red-400 font-extrabold">Delete</span> to confirm:
            </label>
            <input 
              type="text"
              className="input-field text-sm w-full font-bold focus:border-red-500"
              placeholder='Type "Delete"'
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => { setProfileToDelete(null); setDeleteConfirmText(""); }}
              className="flex-1 py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleDeleteProfile}
              disabled={deleteConfirmText !== "Delete"}
              className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-red-600/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-text-muted flex items-center justify-center min-h-[400px]">
        <div className="space-y-4">
          <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse mx-auto" />
          <p className="font-bold text-sm">Loading Identity Hub...</p>
        </div>
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}
