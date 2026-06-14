"use client";

import React, { useState, useEffect, useRef } from "react";

import { 
  Search, 
  Sparkles, 
  MapPin, 
  Filter, 
  Play, 
  CheckCircle2, 
  Star, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Trash2,
  Building2,
  Wand2,
  ExternalLink,
  AlertCircle,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Globe
} from "lucide-react";

import { 
  runJobSearch, 
  fetchUserProfile, 
  patchUserProfile, 
  toggleJobFavourite, 
  analyzeSingleJob, 
  addJobs,
  fetchJobs,
  bulkDeleteJobs,
  parseResumeText,
  updateJobStatus
} from "@/app/actions/jobActions";

import { getAgentStatus, setAgentStatus } from "@/app/actions/agentStatus";
import { runWebDiscovery } from "@/app/actions/webSearchAgent";
import { generateDreamCompanies, generateNicheJobBoards } from "@/app/actions/careerTools";
import { Job, UserProfile } from "@/lib/db";
import Link from "next/link";
import { useProfile } from "@/components/ProfileContext";



const isValidLocation = (loc: string): boolean => {
  const l = loc.toLowerCase().trim();
  if (!l) return false;
  if (l.includes("city, state") || l.includes("cist, state") || l.includes("[city") || l.includes("[cist") || l.includes("placeholder")) return false;
  // If it's a generic placeholder like "city / state"
  if (l.includes("city") && l.includes("state")) return false;
  return true;
};

const getSourceBadgeClass = (source: string) => {
  const s = source.toLowerCase();
  if (s.includes("linkedin")) return "bg-blue-600/10 text-blue-400 border border-blue-500/20";
  if (s.includes("indeed")) return "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20";
  if (s.includes("glassdoor")) return "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20";
  if (s.includes("ziprecruiter")) return "bg-amber-600/10 text-amber-500 border border-amber-500/20";
  if (s.includes("usajobs")) return "bg-red-600/10 text-red-400 border border-red-500/20";
  if (s.includes("snagajob")) return "bg-orange-600/10 text-orange-400 border border-orange-500/20";
  return "bg-purple-600/10 text-purple-400 border border-purple-500/20";
};

const detectJobType = (title: string, description: string) => {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("full-time") || text.includes("full time")) return "Full-Time";
  if (text.includes("part-time") || text.includes("part time")) return "Part-Time";
  if (text.includes("contract") || text.includes("1099") || text.includes("freelance")) return "Contract";
  if (text.includes("intern") || text.includes("internship")) return "Internship";
  return null;
};

export default function SearchPage() {
  const { activeProfileId } = useProfile();
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Job[]>([]);
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [radius, setRadius] = useState<number>(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewingJob, setReviewingJob] = useState<Job | null>(null);
  const [showHighScoresOnly, setShowHighScoresOnly] = useState(false);
  const [searchMode, setSearchMode] = useState<'standard' | 'deep'>('standard');
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [dreamCompanies, setDreamCompanies] = useState<any[]>([]);
  const [isGeneratingDreamList, setIsGeneratingDreamList] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'ghost' | 'companies' | 'boards'>('live');
  const [nicheBoards, setNicheBoards] = useState<any[]>([]);
  const [isGeneratingNicheBoards, setIsGeneratingNicheBoards] = useState(false);
  const [isScanningAllCompanies, setIsScanningAllCompanies] = useState(false);

  const [selectedJobType, setSelectedJobType] = useState<string>("all");
  const [scanningTitles, setScanningTitles] = useState<{ title: string; status: 'pending' | 'scanning' | 'done' | 'failed' }[]>([]);
  const [targetSites, setTargetSites] = useState<string[]>(["linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "usajobs.gov", "snagajob.com"]);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>("all");
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>("all");
  const [showMissingParamsModal, setShowMissingParamsModal] = useState(false);
  const [missingRoleInput, setMissingRoleInput] = useState("");
  const [missingLocationInput, setMissingLocationInput] = useState("");
  const [showAllRoles, setShowAllRoles] = useState(false);
  const [showStrategyPanel, setShowStrategyPanel] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const lastSearchedProfileId = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsDataLoading(true);
      try {
        const p = await fetchUserProfile(activeProfileId);
        if (p) {
          setProfile(p);
          
          // 1. Get explicit roles, or fall back to experience roles
          let roles = p.targetTitles || [];
          if (roles.length === 0 && p.experience && p.experience.length > 0) {
            roles = p.experience.map((e: any) => e.role).filter(Boolean);
          }

          // 2. Get explicit locations, or fall back to general profile location
          let locs = (p.targetLocations || []).filter(isValidLocation);
          if (locs.length === 0 && p.location && isValidLocation(p.location)) {
            locs = [p.location];
          }

          setTargetTitles(roles);
          setTargetLocations(locs);
          if (p.targetSites && p.targetSites.length > 0) setTargetSites(p.targetSites);
          if (p.searchRadius) setRadius(p.searchRadius);

          // Check if absolutely required parameters are missing
          if (roles.length === 0 || locs.length === 0) {
            setMissingRoleInput(roles.join(", "));
            setMissingLocationInput(locs.join("; "));
            setShowMissingParamsModal(true);
          }

          // Check for background search
          const agent = await getAgentStatus();
          let backgroundSearching = agent.isSearching;
          if (backgroundSearching) {
            setIsSearching(true);
            setStatus(`${agent.status} (Found ${agent.resultsFound || 0} matches so far)`);
          }

          // 3. Mark profile as loaded without auto-triggering a heavy live crawl on mount
          if (roles.length > 0 && locs.length > 0 && lastSearchedProfileId.current !== activeProfileId) {
            lastSearchedProfileId.current = activeProfileId;
          }
        }

        // Load existing "new" jobs from the database so they persist on navigation
        const { fetchJobs } = await import("@/app/actions/jobActions");
        const allJobs = await fetchJobs(activeProfileId);
        setResults(allJobs.filter((j: any) => j.status === 'Discovery'));
      } catch (err) {
        console.error("Failed to load initial data in search view:", err);
      } finally {
        setIsDataLoading(false);
      }
    }
    load();
  }, [activeProfileId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const agent = await getAgentStatus();
      if (agent.isSearching) {
        setIsSearching(true);
        setStatus(`${agent.status} (Found ${agent.resultsFound || 0} matches so far)`);
      } else {
        setIsSearching(prev => {
          if (prev) {
            import("@/app/actions/jobActions").then(({ fetchJobs }) => {
              fetchJobs(activeProfileId).then(allJobs => {
                setResults(allJobs.filter((j: any) => j.status === 'Discovery'));
              });
            });
            return false;
          }
          return prev;
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Reset active filter dropdown states when profile or search mode changes
  useEffect(() => {
    setSelectedJobType("all");
    setSelectedLocationFilter("all");
    setSelectedSiteFilter("all");
  }, [activeProfileId, searchMode]);



  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const siteOptions = searchMode === 'standard' 
    ? ["LinkedIn", "Indeed", "Glassdoor", "ZipRecruiter", "USAJOBS", "Snagajob"]
    : ["Greenhouse", "Lever", "Workday", "Deep Index"];

  const filteredResults = results
    .filter(j => {
      const isGhostFlagged = (j.reason || "").toLowerCase().includes("flag") || (j.reason || "").toLowerCase().includes("ghost") || (j.reason || "").toLowerCase().includes("talent pool");
      const isRejected = j.status === 'Rejected' && isGhostFlagged;
      
      // Filter by Search Mode (Standard vs Deep)
      const isDeepSource = (j.source || "").toLowerCase().includes("deep") || 
                           (j.source || "").toLowerCase().includes("greenhouse") || 
                           (j.source || "").toLowerCase().includes("lever") || 
                           (j.source || "").toLowerCase().includes("workday");
      if (searchMode === 'standard' && isDeepSource) return false;
      if (searchMode === 'deep' && !isDeepSource) return false;

      // Filter by location (flexible matching)
      if (selectedLocationFilter !== "all") {
        const cleanFilter = selectedLocationFilter.toLowerCase().trim();
        const jobLocLower = (j.location || "").toLowerCase().trim();
        if (cleanFilter === "remote") {
          const isRemote = jobLocLower.includes("remote") || jobLocLower.includes("anywhere") || jobLocLower.includes("worldwide");
          if (!isRemote) return false;
        } else {
          // Direct substring match
          const hasDirectMatch = jobLocLower.includes(cleanFilter) || cleanFilter.includes(jobLocLower);
          if (!hasDirectMatch) {
            // Check primary city name match (split by comma, slash, or parentheses)
            const filterMainCity = cleanFilter.split(/[,(/]/)[0].trim();
            const jobMainCity = jobLocLower.split(/[,(/]/)[0].trim();
            if (!filterMainCity || !jobMainCity || (!jobLocLower.includes(filterMainCity) && !cleanFilter.includes(jobMainCity))) {
              return false;
            }
          }
        }
      }

      // Filter by job type keywords in title/description (safe from null/undefined)
      if (selectedJobType !== "all") {
        const text = `${j.title || ""} ${j.description || ""}`.toLowerCase();
        if (selectedJobType === "full-time" && !text.includes("full-time") && !text.includes("full time")) return false;
        if (selectedJobType === "part-time" && !text.includes("part-time") && !text.includes("part time")) return false;
        if (selectedJobType === "contract" && !text.includes("contract") && !text.includes("1099") && !text.includes("freelance")) return false;
        if (selectedJobType === "internship" && !text.includes("intern") && !text.includes("internship")) return false;
      }

      // Filter by job site source
      if (selectedSiteFilter !== "all") {
        const sourceLower = (j.source || "").toLowerCase();
        if (!sourceLower.includes(selectedSiteFilter.toLowerCase())) return false;
      }

      if (activeTab === 'live') {
        return !isRejected && (!showHighScoresOnly || j.score >= 80);
      }
      return isRejected;
    })
    .sort((a, b) => {
      // Starred jobs float to top, then sort by score
      if (a.isFavourite && !b.isFavourite) return -1;
      if (!a.isFavourite && b.isFavourite) return 1;
      return b.score - a.score;
    });

  const handleToggleFavourite = async (id: string) => {
    // Optimistic update
    setResults(prev => prev.map(j => j.id === id ? { ...j, isFavourite: !j.isFavourite } : j));
    await toggleJobFavourite(id, activeProfileId);
  };

  const handleAnalyze = async (jobId: string) => {
    // Show loading state in the result card
    setResults(prev => prev.map(j => j.id === jobId ? { ...j, reason: "AI is analyzing..." } : j));
    
    try {
      const result = await analyzeSingleJob(jobId, activeProfileId);
      if (result) {
        setStatus(`Analysis complete: ${result.score}% Match.`);
        setResults(prev => prev.map(j => j.id === jobId ? { ...j, ...result } : j));
        if (reviewingJob && reviewingJob.id === jobId) {
          setReviewingJob({ ...reviewingJob, ...result });
        }
        setTimeout(() => setStatus(""), 3000);
      }
    } catch (e) {
      setResults(prev => prev.map(j => j.id === jobId ? { ...j, reason: "Analysis failed. Quota reached?" } : j));
    }
  };

  const autoVetTopResults = async (jobsList: Job[]) => {
    const pendingJobs = jobsList.filter(j => !j.score || j.score === 0);
    if (pendingJobs.length === 0) return;

    const skills = profile.skills || [];
    const titles = targetTitles || [];
    
    const scored = pendingJobs.map(job => {
      const text = `${job.title} ${job.description}`.toLowerCase();
      const matchedSkills = skills.filter(skill => text.includes(skill.toLowerCase().trim()));
      const matchedRoles = titles.filter(t => text.includes(t.toLowerCase().trim()));
      const skillsRatio = skills.length > 0 ? (matchedSkills.length / skills.length) : 0;
      const rolesRatio = titles.length > 0 ? (matchedRoles.length > 0 ? 1 : 0) : 1;
      const heuristicScore = Math.round((skillsRatio * 70) + (rolesRatio * 30));
      return { job, heuristicScore };
    });

    scored.sort((a, b) => b.heuristicScore - a.heuristicScore);
    const top5 = scored.slice(0, 5);

    for (const item of top5) {
      const jobId = item.job.id;
      setResults(prev => prev.map(j => j.id === jobId ? { ...j, reason: "Auto-vetting match..." } : j));
      try {
        const result = await analyzeSingleJob(jobId, activeProfileId);
        if (result) {
          setResults(prev => prev.map(j => j.id === jobId ? { ...j, ...result } : j));
        }
      } catch (e) {
        console.warn(`Background auto-vet failed for job ${jobId}`, e);
        setResults(prev => prev.map(j => j.id === jobId ? { ...j, reason: "Pending AI analysis. Click 'Analyze Match' to use Gemini." } : j));
      }
    }
  };

  const handleBulkDelete = async () => {
    await bulkDeleteJobs(selectedIds, activeProfileId);
    setResults(prev => prev.filter(j => !selectedIds.includes(j.id)));
    setSelectedIds([]);
    setShowDismissModal(false);
  };


  const handleBulkMove = async () => {
    // In our new workflow, "Move to Pipeline" means Starring the jobs
    setResults(prev => prev.map(j => selectedIds.includes(j.id) ? { ...j, isFavourite: true } : j));
    const { toggleJobFavourite } = await import("@/app/actions/jobActions");
    for (const id of selectedIds) {
      await toggleJobFavourite(id, activeProfileId);
    }
    setSelectedIds([]);
    alert(`${selectedIds.length} jobs moved to your Application Pipeline.`);
  };

  const getPostingAge = (postedAt?: string, createdAt?: string): string => {
    const date = postedAt || createdAt;
    if (!date) return "";
    const hours = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  const selectAll = () => {
    if (selectedIds.length === filteredResults.length) setSelectedIds([]);
    else setSelectedIds(filteredResults.map(j => j.id));
  };

  const removeArrayItem = (field: 'targetTitles' | 'targetLocations' | 'targetSites', index: number) => {
    if (field === 'targetTitles') {
      setTargetTitles(prev => prev.filter((_, i) => i !== index));
    } else if (field === 'targetLocations') {
      setTargetLocations(prev => prev.filter((_, i) => i !== index));
    } else {
      setTargetSites(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addArrayItem = (field: 'targetTitles' | 'targetLocations' | 'targetSites', value: string) => {
    if (!value.trim()) return;
    const cleanValue = value.trim();
    if (field === 'targetTitles') {
      setTargetTitles(prev => prev.includes(cleanValue) ? prev : [...prev, cleanValue]);
    } else if (field === 'targetLocations') {
      setTargetLocations(prev => prev.includes(cleanValue) ? prev : [...prev, cleanValue]);
    } else {
      let cleanSite = cleanValue.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "");
      setTargetSites(prev => prev.includes(cleanSite) ? prev : [...prev, cleanSite]);
    }
  };

  const handleSaveToProfile = async () => {
    setStatus("Saving strategy defaults to profile...");
    const res = await patchUserProfile({
      targetTitles,
      targetLocations,
      targetSites,
      searchRadius: radius
    }, activeProfileId);
    if (res && res.success) {
      setStatus("Defaults successfully saved to your Master Profile.");
    } else {
      setStatus("Failed to save profile defaults.");
    }
    setTimeout(() => setStatus(""), 3000);
  };

  const [isRegenerating, setIsRegenerating] = useState(false);
  const handleRegenerate = async () => {
    if (!(profile as any).geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      return;
    }
    if (!profile.resumeText) {
      setStatus("No resume found. Please add one in Profile.");
      return;
    }
    setIsRegenerating(true);
    setStatus("AI is analyzing resume for new roles...");
    try {
      const data = await parseResumeText(profile.resumeText);
      
      // MERGE logic: Keep current, add new unique ones
      const uniqueTitles = Array.from(new Set([...targetTitles, ...(data.targetTitles || [])]));
      const uniqueLocations = Array.from(new Set([...targetLocations, ...(data.targetLocations || [])]));

      setTargetTitles(uniqueTitles);
      setTargetLocations(uniqueLocations);
      setStatus("Search parameters updated from AI. Click 'Save Defaults' to persist.");
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to analyze resume. Please verify your API Key and connection.");
      setStatus("Regeneration failed.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleReload = async () => {
    setIsRegenerating(true);
    setStatus("Reloading parameters from profile...");
    try {
      const p = await fetchUserProfile();
      if (p) {
        setProfile(p);
        const roles = p.targetTitles || [];
        const locs = (p.targetLocations || []).filter(isValidLocation);
        const sites = p.targetSites || ["linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "usajobs.gov", "snagajob.com"];
        setTargetTitles(roles);
        setTargetLocations(locs);
        setTargetSites(sites);
        if (p.searchRadius) setRadius(p.searchRadius);
        setStatus("Identity Synced: Query reloaded from master profile.");
        setTimeout(() => setStatus(""), 3000);

        if (roles.length === 0 || locs.length === 0) {
          setMissingRoleInput(roles.join(", "));
          setMissingLocationInput(locs.join("; "));
          setShowMissingParamsModal(true);
        }
      }
    } catch (e) {
      setStatus("Sync Failed: Check profile database.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSearch = async (titlesOverride?: string[], locationsOverride?: string[]) => {
    const titles = titlesOverride || targetTitles;
    const locations = (locationsOverride || targetLocations).filter(isValidLocation);

    if (titles.length === 0 || locations.length === 0) {
      setMissingRoleInput(titles.join(", "));
      setMissingLocationInput(locations.join("; "));
      setShowMissingParamsModal(true);
      return;
    }

    setIsSearching(true);
    setStatus("Launching stealth browser...");
    setScanningTitles(titles.map(t => ({ title: t, status: 'pending' })));
    
    try {
      if (searchMode === 'deep') {
        setStatus("Precision Mode: Scanning ATS Platforms...");
        setScanningTitles(titles.slice(0, 3).map((t, idx) => ({ title: t, status: idx === 0 ? 'scanning' : 'pending' })));
        const precisionTitles = titles.slice(0, 3);
        const newJobs = await runWebDiscovery(precisionTitles, locations.length > 0 ? locations : (profile.location ? [profile.location] : ["USA"]), radius);
        
        await addJobs(newJobs, activeProfileId);
        setResults(prev => {
          const existingUrls = new Set(prev.map(j => j.url));
          const uniqueNew = newJobs.filter(j => !existingUrls.has(j.url));
          const updated = [...uniqueNew, ...prev];
          autoVetTopResults(updated);
          return updated;
        });
        setScanningTitles(titles.slice(0, 3).map(t => ({ title: t, status: 'done' })));
        setStatus(`Found ${newJobs.length} new matches via deep search.`);

      } else {
        let totalFound = 0;
        const initialScans = titles.map((t, idx) => ({ title: t, status: (idx === 0 ? 'scanning' : 'pending') as any }));
        setScanningTitles(initialScans);

        for (let i = 0; i < titles.length; i++) {
          const currentTitle = titles[i];
          
          setScanningTitles(prev => prev.map((item, idx) => {
            if (idx === i) return { ...item, status: 'scanning' };
            if (idx < i) return { ...item, status: 'done' };
            return item;
          }));
          
          setStatus(`Scanning for "${currentTitle}"...`);
          
          try {
            const newJobs = await runJobSearch(
              [currentTitle], 
              locations, 
              radius, 
              profile.resumeText || "",
              targetSites,
              activeProfileId,
              profile.matchStrictness || 'exact'
            );

            totalFound += newJobs.length;

            if (newJobs.length > 0) {
              await addJobs(newJobs, activeProfileId);
              setResults(prev => {
                const existingUrls = new Set(prev.map(j => j.url));
                const uniqueNew = newJobs.filter(j => !existingUrls.has(j.url));
                const updated = [...uniqueNew, ...prev];
                autoVetTopResults(updated);
                return updated;
              });
            }

            setScanningTitles(prev => prev.map((item, idx) => {
              if (idx === i) return { ...item, status: 'done' };
              return item;
            }));

          } catch (err) {
            console.error(`Failed title search for ${currentTitle}:`, err);
            setScanningTitles(prev => prev.map((item, idx) => {
              if (idx === i) return { ...item, status: 'failed' };
              return item;
            }));
          }
        }
        
        await setAgentStatus({ 
          isSearching: false, 
          status: `Found ${totalFound} matches via ${searchMode}.`,
          resultsFound: totalFound 
        });

        setStatus(`Found ${totalFound} new matches via search.`);
      }
    } catch (error) {
      console.error(error);
      setStatus("Search failed. Check console.");
    } finally {
      setIsSearching(false);
      // Clean up scanning checklist after a delay
      setTimeout(() => setScanningTitles([]), 10000);
    }
  };

  const handleExpressApply = async (job: Job) => {
    setStatus(`Executing Express Apply for ${job.company}...`);
    // 1. Mark as favourite (moves to Pipeline)
    await toggleJobFavourite(job.id);
    // 2. Move to Drafting status for immediate tailoring
    await updateJobStatus(job.id, 'Drafting' as any);
    
    setResults(prev => prev.filter(j => j.id !== job.id));
    setReviewingJob(null);
    setStatus(`Success! ${job.company} is now in your Drafting queue.`);
    setTimeout(() => setStatus(""), 3000);
  };


  const handleGenerateDreamList = async () => {
    setIsGeneratingDreamList(true);
    setStatus("AI is researching companies in your area...");
    try {
      const list = await generateDreamCompanies(targetLocations, radius, targetTitles, activeProfileId);
      const initialList = list.map(c => ({ ...c, scanningStatus: 'idle' as const, jobsFoundCount: 0 }));
      setDreamCompanies(initialList);
      setIsGeneratingDreamList(false);
      setActiveTab('companies');
      setStatus("");

      // Start scanning each company sequentially in background
      for (let idx = 0; idx < initialList.length; idx++) {
        const comp = initialList[idx];
        setDreamCompanies(prev => prev.map((c, i) => i === idx ? { ...c, scanningStatus: 'scanning' } : c));
        setStatus(`Scanning ${idx + 1}/${initialList.length}: ${comp.name}...`);
        
        try {
          const { scanCompanyJobs, addJobs } = await import("@/app/actions/jobActions");
          const newJobs = await scanCompanyJobs(comp.name, targetTitles, targetLocations, comp.careerUrl);
          if (newJobs.length > 0) {
            await addJobs(newJobs, activeProfileId);
            setResults(prev => {
              const existingUrls = new Set(prev.map(j => j.url));
              const uniqueNew = newJobs.filter(j => !existingUrls.has(j.url));
              const updated = [...uniqueNew, ...prev];
              autoVetTopResults(updated);
              return updated;
            });
          }
          setDreamCompanies(prev => prev.map((c, i) => i === idx ? { ...c, scanningStatus: 'done', jobsFoundCount: newJobs.length } : c));
        } catch (err) {
          console.error(err);
          setDreamCompanies(prev => prev.map((c, i) => i === idx ? { ...c, scanningStatus: 'failed', jobsFoundCount: 0 } : c));
        }
      }
      setStatus("Dream companies scanning complete.");
      setTimeout(() => setStatus(""), 4000);
    } catch (e) {
      console.error(e);
      setStatus("Failed to research companies.");
      setIsGeneratingDreamList(false);
    }
  };

  const handleScanCompany = async (index: number, companyName: string, careerUrl?: string) => {
    setDreamCompanies(prev => prev.map((c, i) => i === index ? { ...c, scanningStatus: 'scanning' } : c));
    setStatus(`Scanning ${companyName}...`);
    try {
      const { scanCompanyJobs, addJobs } = await import("@/app/actions/jobActions");
      const newJobs = await scanCompanyJobs(companyName, targetTitles, targetLocations, careerUrl);
      if (newJobs.length > 0) {
        await addJobs(newJobs, activeProfileId);
        setResults(prev => {
          const existingUrls = new Set(prev.map(j => j.url));
          const uniqueNew = newJobs.filter(j => !existingUrls.has(j.url));
          const updated = [...uniqueNew, ...prev];
          autoVetTopResults(updated);
          return updated;
        });
        setStatus(`Found ${newJobs.length} openings at ${companyName}!`);
      } else {
        setStatus(`No openings found at ${companyName}.`);
      }
      setDreamCompanies(prev => prev.map((c, i) => i === index ? { ...c, scanningStatus: 'done', jobsFoundCount: newJobs.length } : c));
      setTimeout(() => setStatus(""), 3000);
    } catch (error) {
      console.error(error);
      setStatus(`Scan failed for ${companyName}.`);
      setDreamCompanies(prev => prev.map((c, i) => i === index ? { ...c, scanningStatus: 'failed' } : c));
    }
  };


  const handleScanAllCompanies = async () => {
    if (dreamCompanies.length === 0) return;
    setIsScanningAllCompanies(true);
    setStatus("Batch agent scanning all discovered dream companies...");
    try {
      const { scanCompanyJobs, addJobs } = await import("@/app/actions/jobActions");
      let totalFound = 0;

      for (let i = 0; i < dreamCompanies.length; i++) {
        const company = dreamCompanies[i];
        setDreamCompanies(prev => prev.map((c, index) => index === i ? { ...c, scanningStatus: 'scanning' } : c));
        setStatus(`Batch scanning [${i + 1}/${dreamCompanies.length}]: ${company.name}...`);
        
        try {
          const newJobs = await scanCompanyJobs(company.name, targetTitles, targetLocations, company.careerUrl);
          if (newJobs.length > 0) {
            await addJobs(newJobs, activeProfileId);
            setResults(prev => {
              const existingUrls = new Set(prev.map(j => j.url));
              const uniqueNew = newJobs.filter(j => !existingUrls.has(j.url));
              const updated = [...uniqueNew, ...prev];
              autoVetTopResults(updated);
              return updated;
            });
            totalFound += newJobs.length;
          }
          setDreamCompanies(prev => prev.map((c, index) => index === i ? { ...c, scanningStatus: 'done', jobsFoundCount: newJobs.length } : c));
        } catch (err) {
          console.error(err);
          setDreamCompanies(prev => prev.map((c, index) => index === i ? { ...c, scanningStatus: 'failed' } : c));
        }
      }
      setStatus(`Batch scan complete! Discovered ${totalFound} company openings.`);
      setTimeout(() => setStatus(""), 4000);
    } catch (e) {
      console.error(e);
      setStatus("Batch scan failed.");
    } finally {
      setIsScanningAllCompanies(false);
    }
  };

  const handleGenerateNicheBoards = async () => {
    if (!(profile as any).geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      return;
    }
    setIsGeneratingNicheBoards(true);
    setStatus("AI is identifying high-yield niche job boards for your background...");
    try {
      const boards = await generateNicheJobBoards(activeProfileId);
      setNicheBoards(boards);
      setStatus(`Discovered ${boards.length} niche job boards!`);
      setTimeout(() => setStatus(""), 4000);
    } catch (e) {
      console.error(e);
      setStatus("Failed to discover niche boards.");
    } finally {
      setIsGeneratingNicheBoards(false);
    }
  };


  return (
    <div className="flex h-screen overflow-hidden w-full relative">
      
      {/* Center Main Window (Top Nav and Discovery Engine Content) */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-8 space-y-8 min-w-0 transition-all duration-300">
        
        {/* Header container in center window */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold font-outfit">Discovery Engine</h2>
            <p className="text-text-muted mt-1">Configure your multi-platform scraper. Star jobs to send them to your Pipeline.</p>
          </div>

          {/* Global Platform Toggle */}
          <div className="flex flex-col items-end gap-2">
            <div className="p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-card-border flex gap-1 w-64 shadow-2xl">
              <button 
                onClick={() => setSearchMode('standard')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all ${searchMode === 'standard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-text-muted hover:text-foreground'}`}
              >
                Standard
              </button>
              <button 
                onClick={() => setSearchMode('deep')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all ${searchMode === 'deep' ? 'bg-emerald-600 text-white shadow-lg' : 'text-text-muted hover:text-foreground'}`}
              >
                Deep Web
              </button>
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mr-2">
              {searchMode === 'standard' ? 'Aggregators: LinkedIn, Indeed, Reed' : 'Precision: Lever, Greenhouse, Workable'}
            </p>
          </div>
        </div>

        {/* Outer results display (Takes remaining height) */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-card-border pb-2 gap-4">
            <div className="flex gap-6">
              <button 
                onClick={() => setActiveTab('live')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'live' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-text-muted hover:text-foreground'}`}
              >
                Live Opportunities
                {activeTab === 'live' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 animate-in fade-in duration-300" />}
              </button>
              <button 
                onClick={() => setActiveTab('ghost')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'ghost' ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-text-muted hover:text-foreground'}`}
              >
                Rejected / Flagged
                {activeTab === 'ghost' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-400 animate-in fade-in duration-300" />}
              </button>
              <button 
                onClick={() => setActiveTab('companies')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'companies' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-text-muted hover:text-foreground'}`}
              >
                Dream Companies
                {activeTab === 'companies' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 animate-in fade-in duration-300" />}
              </button>
              <button 
                onClick={() => setActiveTab('boards')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'boards' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-text-muted hover:text-foreground'}`}
              >
                Niche Boards
                {activeTab === 'boards' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 animate-in fade-in duration-300" />}
              </button>
            </div>
            
            {/* Stacking Buttons on Right into two rows for cleaner spacing */}
            <div className="flex flex-col gap-2 shrink-0 md:items-end">
              {/* Row 1: Actions */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={selectAll}
                  className="btn-secondary py-1 px-2.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                  title="Select or deselect all visible jobs on the current tab for bulk actions"
                >
                  {selectedIds.length === filteredResults.length ? "Deselect All" : "Select All"}
                </button>
                <button 
                  onClick={() => setShowHighScoresOnly(!showHighScoresOnly)}
                  className={`btn-secondary py-1 px-2.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1 transition-all ${showHighScoresOnly ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/50 shadow-lg shadow-indigo-500/10' : ''}`}
                  title="Filter the list to only show jobs with an AI match score of 80% or higher"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                  {showHighScoresOnly ? "Showing 80%+" : "High Fit (80%+)"}
                </button>
                <button 
                  onClick={() => setShowStrategyPanel(!showStrategyPanel)}
                  className={`btn-secondary py-1 px-2.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1 transition-all ${showStrategyPanel ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' : ''}`}
                  title={showStrategyPanel ? "Hide the Discovery Strategy sidebar config panel" : "Show the Discovery Strategy sidebar config panel"}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  {showStrategyPanel ? "Hide Config" : "Show Config"}
                </button>
              </div>

              {/* Row 2: Select Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedJobType}
                  onChange={(e) => setSelectedJobType(e.target.value)}
                  className="btn-secondary py-1 px-2 text-[9px] font-bold uppercase tracking-wider bg-card border border-card-border rounded-lg outline-none cursor-pointer"
                >
                  <option value="all">All Job Types</option>
                  <option value="full-time">Full-Time</option>
                  <option value="part-time">Part-Time</option>
                  <option value="contract">Contract (1099)</option>
                  <option value="internship">Internship</option>
                </select>

                <select
                  value={selectedLocationFilter}
                  onChange={(e) => setSelectedLocationFilter(e.target.value)}
                  className="btn-secondary py-1 px-2 text-[9px] font-bold uppercase tracking-wider bg-card border border-card-border rounded-lg outline-none cursor-pointer"
                >
                  <option value="all">All Locations</option>
                  {targetLocations.map((loc, index) => (
                    <option key={index} value={loc}>{loc}</option>
                  ))}
                </select>

                <select
                  value={selectedSiteFilter}
                  onChange={(e) => setSelectedSiteFilter(e.target.value)}
                  className="btn-secondary py-1 px-2 text-[9px] font-bold uppercase tracking-wider bg-card border border-card-border rounded-lg outline-none cursor-pointer"
                >
                  <option value="all">All Sites</option>
                  {siteOptions.map((site, index) => (
                    <option key={index} value={site.toLowerCase()}>{site}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {activeTab === 'boards' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Niche Job Portals</h3>
                  <p className="text-xs text-text-muted">AI-suggested recruitment boards tailored precisely to your experience & active target roles.</p>
                </div>
                <button 
                  onClick={handleGenerateNicheBoards}
                  disabled={isGeneratingNicheBoards}
                  className="btn-primary py-2 px-4 text-xs"
                >
                  {isGeneratingNicheBoards ? "AI Researching..." : "✦ Discover Niche Boards"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                {nicheBoards.length === 0 ? (
                  <div className="md:col-span-2 glass-card py-20 text-center space-y-4 border-dashed border-card-border">
                    <Globe className="w-12 h-12 text-text-muted mx-auto" />
                    <p className="text-text-muted font-medium italic">No custom portals discovered yet. Click the button above to generate a list.</p>
                  </div>
                ) : nicheBoards.map((board, i) => (
                  <div key={i} className="glass-card hover:border-emerald-500/30 transition-all group relative overflow-hidden flex flex-col justify-between h-full">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {board.name}
                        </h4>
                        <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 px-2 py-0.5 rounded text-emerald-600 dark:text-emerald-400">
                          {board.industry}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed mb-4">
                        {board.reasoning}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-card-border">
                      <p className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Quick Search Links:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {targetTitles.slice(0, 3).map((role, rIndex) => {
                          const queryUrl = board.searchUrl.replace("{query}", encodeURIComponent(role));
                          return (
                            <a
                              key={rIndex}
                              href={queryUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-black/5 dark:bg-white/5 border border-card-border rounded text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/30 flex items-center gap-1 transition-all"
                            >
                              {role}
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          );
                        })}
                        <a
                          href={board.searchUrl.replace("{query}", "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-black/5 dark:bg-white/5 border border-card-border rounded text-[10px] font-medium text-text-muted hover:text-white hover:bg-slate-800 flex items-center gap-1 transition-all"
                        >
                          Open Site ↗
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'companies' ? (
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">Target Company Discovery</h3>
                    <p className="text-xs text-text-muted">AI-researched firms that hire for your specific background within {radius} miles.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dreamCompanies.length > 0 && (
                      <button
                        onClick={handleScanAllCompanies}
                        disabled={isScanningAllCompanies || isSearching}
                        className="btn-secondary py-2 px-4 text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20"
                      >
                        {isScanningAllCompanies ? "Scanning All..." : `Scan All (${dreamCompanies.length}) Companies`}
                      </button>
                    )}
                    <button 
                      onClick={handleGenerateDreamList}
                      disabled={isGeneratingDreamList}
                      className="btn-primary py-2 px-4 text-xs"
                    >
                      {isGeneratingDreamList ? "Agent Researching..." : "✦ Refresh Dream List"}
                    </button>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dreamCompanies.length === 0 ? (
                    <div className="md:col-span-2 glass-card py-20 text-center space-y-4 border-dashed border-card-border">
                       <Building2 className="w-12 h-12 text-text-muted mx-auto" />
                       <p className="text-text-muted font-medium italic">No research data yet. Trigger the AI to find companies.</p>
                    </div>
                  ) : dreamCompanies.map((company, i) => (
                    <div key={i} className={`glass-card hover:border-indigo-500/30 transition-all group ${company.scanningStatus === 'scanning' ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}>
                       <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                            {company.name}
                            {company.scanningStatus === 'scanning' && (
                              <span className="inline-block w-3 h-3 border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
                            )}
                            {company.scanningStatus === 'done' && (
                              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold" title={`Scanned: Found ${company.jobsFoundCount || 0} openings`}>✓</span>
                            )}
                            {company.scanningStatus === 'failed' && (
                              <span className="text-rose-600 dark:text-rose-400 text-xs" title="Scan failed">⚠️</span>
                            )}
                          </h4>
                          <span className="text-[9px] font-black uppercase tracking-widest bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded text-text-muted">{company.industry}</span>
                       </div>
                       <p className="text-xs text-text-muted leading-relaxed mb-4 italic">"{company.reasoning}"</p>
                       <div className="flex gap-2">
                           <button 
                             onClick={() => handleScanCompany(i, company.name, company.careerUrl)}
                             disabled={isSearching || company.scanningStatus === 'scanning'}
                             className="flex-1 py-2 bg-indigo-500/10 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 cursor-pointer text-center"
                           >
                             {company.scanningStatus === 'scanning' ? 'Scanning...' : 
                              company.scanningStatus === 'done' ? `Scan Openings (${company.jobsFoundCount || 0} Found)` : 'Scan Openings'}
                           </button>
                           {company.careerUrl && (
                             <a href={company.careerUrl} target="_blank" className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-text-muted hover:text-foreground border border-card-border flex items-center justify-center">
                               <ExternalLink className="w-4 h-4" />
                             </a>
                           )}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          ) : results.length === 0 && isSearching ? (
            <div className="space-y-4">
              {scanningTitles.map((scan, i) => (
                <div key={i} className={`glass-card flex items-center justify-between p-6 transition-all ${scan.status === 'scanning' ? 'border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-500/5' : 'border-card-border/60 opacity-60'}`}>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      {scan.status === 'scanning' ? (
                        <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                      ) : scan.status === 'done' ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs font-bold">✓</div>
                      ) : scan.status === 'failed' ? (
                        <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center text-xs font-bold">!</div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-500/10 text-slate-500 flex items-center justify-center text-xs font-bold">•</div>
                      )}
                      <div>
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          Scanning for &quot;{scan.title}&quot;
                        </h4>
                        <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">
                          {scan.status === 'scanning' ? 'Active Scraping...' : scan.status === 'done' ? 'Completed' : scan.status === 'failed' ? 'Failed' : 'Pending Queue'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="animate-pulse bg-slate-200 dark:bg-white/5 h-8 w-24 rounded-lg" />
                </div>
              ))}
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div className="glass-card py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-text-muted" />
              </div>
              <div>
                <p className="font-bold">No active search running</p>
                <p className="text-sm text-text-muted">Trigger the agent to scan platforms for matches.</p>
              </div>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="glass-card py-20 text-center space-y-4 border-dashed border-card-border">
              <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Filter className="w-8 h-8 text-text-muted" />
              </div>
              <div>
                <p className="font-bold">No matching opportunities found</p>
                <p className="text-sm text-text-muted">No search results match the selected active filters. Try relaxing your location, job type, or platform site options.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {isSearching && scanningTitles.length > 0 && (
                <div className="mb-6 p-6 glass-card rounded-[2rem] border-indigo-500/20 bg-indigo-500/5 space-y-4">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Stealth Engine Active Scanning Process</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {scanningTitles.map((scan, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${scan.status === 'scanning' ? 'border-indigo-500 bg-indigo-500/5' : 'border-card-border/60 opacity-60'}`}>
                        {scan.status === 'scanning' ? (
                          <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin shrink-0" />
                        ) : scan.status === 'done' ? (
                          <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-bold shrink-0">✓</div>
                        ) : scan.status === 'failed' ? (
                          <div className="w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center text-[10px] font-bold shrink-0">!</div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-slate-500/10 text-slate-500 flex items-center justify-center text-[10px] font-bold shrink-0">•</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-foreground truncate">Scanning &quot;{scan.title}&quot;</p>
                          <p className="text-[9px] text-text-muted font-black uppercase tracking-wider">
                            {scan.status === 'scanning' ? 'Running Stealth Crawler...' : 
                             scan.status === 'done' ? 'Completed' : 
                             scan.status === 'failed' ? 'Quota Rate Limited' : 'Queued'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {filteredResults.map((job) => {
                const jobText = `${job.title} ${job.description}`.toLowerCase();
                const userSkills = profile.skills || [];
                const matchedSkills = userSkills.filter(s => s && jobText.includes(s.toLowerCase().trim()));
                const userRoles = targetTitles || [];
                const matchedRoles = userRoles.filter(r => r && jobText.includes(r.toLowerCase().trim()));
                const jobTypeDetected = detectJobType(job.title, job.description);

                return (
                  <div key={job.id} className={`glass-card flex items-center gap-6 group hover:border-indigo-500/30 transition-all ${selectedIds.includes(job.id) ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}>
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(job.id)}
                        onChange={() => toggleSelection(job.id)}
                        className="w-5 h-5 rounded border-card-border bg-black/5 dark:bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 transition-all cursor-pointer"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${getSourceBadgeClass(job.source)}`}>
                            {job.source}
                          </span>
                          {jobTypeDetected && (
                            <span className="text-[9px] font-bold bg-black/5 dark:bg-white/5 border border-card-border text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              {jobTypeDetected}
                            </span>
                          )}
                          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-700" />
                          <span className="text-[10px] text-text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getPostingAge(job.postedAt, job.createdAt)}
                          </span>
                          {(job.ghostScore ?? 0) > 60 && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Ghost {job.ghostScore}%
                            </span>
                          )}
                        </div>
                        
                        <div className="flex gap-1.5">
                          {userSkills.length > 0 && (
                            <span 
                              className="text-[9px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded text-slate-700 dark:text-slate-400 hover:text-foreground transition-all cursor-default" 
                              title={`Matched skills: ${matchedSkills.join(', ') || 'None'}. Missing: ${userSkills.filter(s => !matchedSkills.includes(s)).join(', ')}`}
                            >
                              Skills: {matchedSkills.length}/{userSkills.length}
                            </span>
                          )}
                          {userRoles.length > 0 && (
                            <span 
                              className="text-[9px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded text-slate-700 dark:text-slate-400 hover:text-foreground transition-all cursor-default" 
                              title={`Matched target roles: ${matchedRoles.join(', ') || 'None'}`}
                            >
                              Roles: {matchedRoles.length}/{userRoles.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <h4 className="font-bold text-lg text-foreground">{job.title}</h4>
                      <div className="flex items-center gap-3 text-sm mt-1">
                        <span className="font-bold card-company-text">{job.company}</span>
                        <div className="flex items-center gap-1 font-medium card-location-text" title={`Matched for location query: ${job.location}`}>
                          <MapPin className="w-3.5 h-3.5" />
                          Within {radius} miles of {job.location}
                        </div>
                        {job.salaryRange && (
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">{job.salaryRange}</span>
                        )}
                      </div>
                    
                    {/* AI Insights / Status Message */}
                    {job.reason && (
                      <div className="mt-3 p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-500/5 border border-indigo-500/20 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                          <p className="text-xs card-reason-text leading-relaxed font-medium italic">{job.reason}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="w-px h-12 bg-card-border" />
                  
                  <div className="text-center min-w-[80px]">
                    {job.score > 0 ? (
                      <>
                        <div className={`text-2xl font-bold ${job.score > 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {job.score}%
                        </div>
                        <p className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">AI Match</p>
                      </>
                    ) : (
                      <div className="py-2">
                        <span className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest">Pending</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {job.score === 0 && (
                      <button
                        onClick={() => handleAnalyze(job.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 text-xs font-bold transition-all border border-indigo-500/20"
                        title="Trigger AI to scan the job details and score your match fit"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Analyze Match
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleFavourite(job.id)}
                      className={`p-2 rounded-lg transition-all ${job.isFavourite ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-400/10' : 'text-text-muted hover:text-yellow-500'}`}
                      title={job.isFavourite ? "Remove from Favourites (Removes from Application Workshop list)" : "Add to Favourites (Sends this Discovery job directly to your Application Workshop)"}
                    >
                      <Star className={`w-4 h-4 ${job.isFavourite ? 'fill-current' : ''}`} />
                    </button>
                    <button 
                      onClick={() => toggleSelection(job.id)}
                      className={`p-2 rounded-lg transition-all ${selectedIds.includes(job.id) ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-black/5 dark:bg-white/5 text-text-muted hover:text-foreground'}`}
                      title={selectedIds.includes(job.id) ? "Deselect this job" : "Select this job for batch operations (Move to Pipeline or Dismiss)"}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setReviewingJob(job)}
                      className="btn-primary py-2 px-4 text-xs"
                      title="Preview job details, AI analysis score, and read full job description"
                    >
                      Quick Review
                    </button>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Discovery Strategy (Right Column) */}
      <div className={`${showStrategyPanel ? "w-80 border-l" : "w-0"} border-card-border bg-card/65 backdrop-blur-xl h-full flex flex-col transition-all duration-300 ease-in-out relative group/strategy shrink-0`}>
        {/* Toggle Chevron Pin */}
        <button 
          id="toggle-strategy-btn"
          onClick={() => setShowStrategyPanel(!showStrategyPanel)}
          className="absolute -left-3 top-20 w-6 h-6 bg-foreground rounded-full flex items-center justify-center border border-card-border text-background shadow-md opacity-0 group-hover/strategy:opacity-100 transition-opacity z-50 cursor-pointer animate-in fade-in"
          title={showStrategyPanel ? "Collapse Strategy Strategy" : "Expand Strategy Strategy"}
        >
          {showStrategyPanel ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {showStrategyPanel && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-in fade-in duration-300 relative">
            {isDataLoading && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-3 min-h-[400px]">
                <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted animate-pulse">Syncing parameters...</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground">Discovery Strategy</h3>
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveToProfile}
                  className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-500 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all cursor-pointer"
                  title="Save defaults to active profile"
                >
                  Save Defaults
                </button>
                <button 
                  onClick={handleReload}
                  disabled={isRegenerating}
                  className="p-1.5 rounded-lg bg-foreground/5 text-text-muted hover:bg-foreground/10 hover:text-foreground transition-all group cursor-pointer"
                  title="Reset to Profile Defaults"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                </button>
              </div>
            </div>

            {/* Target Roles */}
            <div>
              <label className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2 block">Target Roles</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(showAllRoles ? targetTitles : targetTitles.slice(0, 5)).map((title, i) => (
                  <span key={i} className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 font-semibold">
                    {title}
                    <button onClick={() => removeArrayItem('targetTitles', i)} className="hover:text-white cursor-pointer">&times;</button>
                  </span>
                ))}
                {!showAllRoles && targetTitles.length > 5 && (
                  <button 
                    onClick={() => setShowAllRoles(true)}
                    className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/40 rounded text-[11px] text-indigo-600 dark:text-indigo-300 font-bold hover:bg-indigo-500/30 hover:text-white transition-all cursor-pointer"
                  >
                    + {targetTitles.length - 5} Show More
                  </button>
                )}
                {showAllRoles && targetTitles.length > 5 && (
                  <button 
                    onClick={() => setShowAllRoles(false)}
                    className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/40 rounded text-[11px] text-indigo-600 dark:text-indigo-300 font-bold hover:bg-indigo-500/30 hover:text-white transition-all cursor-pointer"
                  >
                    - Show Less
                  </button>
                )}
              </div>
              <input 
                type="text" 
                placeholder="Add role & press Enter..." 
                className="input-field text-xs py-1.5 w-full bg-card border-card-border focus:border-foreground/30 text-foreground"
                onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('targetTitles', e.currentTarget.value); e.currentTarget.value = ''; } }}
              />
            </div>

            {/* Target Locations */}
            <div>
              <label className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2 block">Locations / Postcodes</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {targetLocations.map((loc, i) => (
                  <span key={i} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[11px] text-emerald-600 dark:text-emerald-500 flex items-center gap-1.5 font-semibold">
                    {loc}
                    <button onClick={() => removeArrayItem('targetLocations', i)} className="hover:text-white cursor-pointer">&times;</button>
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Add location & press Enter..." 
                className="input-field text-xs py-1.5 w-full bg-card border-card-border focus:border-foreground/30 text-foreground"
                onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('targetLocations', e.currentTarget.value); e.currentTarget.value = ''; } }}
              />
            </div>

            {/* Target Job Sites */}
            <div>
              <label className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2 block">Target Job Sites</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {targetSites.map((site, i) => (
                  <span key={i} className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-semibold">
                    {site}
                    <button onClick={() => removeArrayItem('targetSites', i)} className="hover:text-amber-950 dark:hover:text-white cursor-pointer">&times;</button>
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Add site (e.g. dice.com) & Enter..." 
                className="input-field text-xs py-1.5 w-full bg-card border-card-border focus:border-foreground/30 text-foreground"
                onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('targetSites', e.currentTarget.value); e.currentTarget.value = ''; } }}
              />
            </div>

            {/* Radius Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-text-muted font-bold uppercase tracking-wider">Search Radius</label>
                <span className="text-xs font-bold text-foreground">{radius} miles</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="200" 
                step="5"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-1 font-medium">
                <span>5m</span>
                <span>50m</span>
                <span>100m</span>
                <span>200m</span>
              </div>
            </div>

            {/* Match Strictness */}
            <div>
              <label className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2 block font-outfit">Match Strictness</label>
              <div className="p-0.5 bg-black/5 dark:bg-white/5 rounded-lg border border-card-border flex gap-0.5 w-full shadow-2xl">
                {(['exact', 'strong', 'flexible'] as const).map((mode) => (
                  <button 
                    key={mode}
                    onClick={() => {
                      const updated = { ...profile, matchStrictness: mode };
                      setProfile(updated);
                      import("@/app/actions/jobActions").then(({ saveUserProfile }) => {
                        saveUserProfile(updated, activeProfileId);
                      });
                    }}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${profile.matchStrictness === mode || (!profile.matchStrictness && mode === 'exact') ? 'bg-indigo-600 text-white shadow-lg' : 'text-text-muted hover:text-foreground'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Suggestion Button */}
            <button 
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500/20 transition-all mb-2"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? "Analyzing Resume..." : "Suggest Smart Targets"}
            </button>

            <button 
              onClick={() => handleSearch()}
              disabled={isSearching}
              className={`w-full btn-primary justify-center disabled:opacity-50 !py-4 transition-all ${searchMode === 'deep' ? '!bg-emerald-600 !hover:bg-emerald-500 shadow-emerald-600/20 shadow-xl' : ''}`}
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Agent Scanning...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  {searchMode === 'deep' ? 'Trigger Precision Scan' : 'Start Standard Agent'}
                </>
              )}
            </button>
            
            {searchMode === 'deep' && (
               <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-widest">
                     <Wand2 className="w-3 h-3" />
                     Precision Mode Active
                  </div>
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Deep Web discovery is now optimized for your <b>top 3 roles</b>. This minimizes noise and focuses exclusively on high-value ATS boards.
                  </p>
               </div>
            )}

            {status && (
              <p className="text-[10px] text-center text-text-muted animate-pulse">{status}</p>
            )}
          </div>
        )}
      </div>


      {/* Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 glass-card !bg-slate-900/90 border-card-border shadow-2xl flex items-center gap-8 py-3 px-6 animate-in slide-in-from-bottom-8 duration-300 z-40 border">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
              {selectedIds.length}
            </span>
            <span className="font-bold text-xs uppercase tracking-widest text-slate-300">Selected</span>
          </div>
          <div className="w-px h-6 bg-card-border" />
          <div className="flex gap-2">
            <button 
              onClick={handleBulkMove}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
            >
              Move to Pipeline
            </button>
            <button 
              onClick={() => setShowDismissModal(true)}
              className="px-4 py-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-colors"
            >
              Dismiss Results
            </button>

            <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Quick Review Modal */}
      {reviewingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-sm" onClick={() => setReviewingJob(null)} />
          <div className="glass-card w-full max-w-2xl relative z-10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{reviewingJob.source}</span>
                <h2 className="text-2xl font-bold font-outfit mt-1">{reviewingJob.title}</h2>
                <p className="text-text-muted">{reviewingJob.company} &bull; {reviewingJob.location}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{reviewingJob.score}%</div>
                <p className="text-[10px] text-text-muted uppercase font-bold">AI Match</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <h4 className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Reasoning
                </h4>
                <p className="text-slate-900 dark:text-slate-300 text-sm leading-relaxed">
                  {reviewingJob.reason}
                </p>
              </div>

              <div className="flex gap-3">
                <a 
                  href={reviewingJob.url} 
                  target="_blank" 
                  className="flex-1 btn-secondary justify-center py-3"
                >
                  View Original Post
                </a>
                <div className="flex-1 flex flex-col gap-1.5">
                  <button 
                    onClick={() => handleExpressApply(reviewingJob)}
                    className="w-full btn-primary justify-center py-3 font-bold"
                  >
                    Express Apply Now
                  </button>
                  <span className="text-[9px] text-text-muted text-center font-medium leading-normal block">
                    Favorites and places directly in Drafting queue for tailoring.
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setReviewingJob(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-foreground"
            >
              &times;
            </button>
          </div>
        </div>
      )}
      {/* Dismiss Confirmation Modal */}
      {showDismissModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-md p-8 space-y-6 border-red-500/30">
            <div className="flex items-center gap-4 text-red-600 dark:text-red-400">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-xl">Dismiss {selectedIds.length} Results?</h3>
                <p className="text-xs text-text-muted">These roles will be removed from your discovery feed.</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setShowDismissModal(false)} className="flex-1 py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-all">Cancel</button>
              <button onClick={handleBulkDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-red-600/20">Confirm Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Parameters Modal */}
      {showMissingParamsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-md p-8 space-y-6 border-indigo-500/30">
            <div className="flex items-center gap-4 text-indigo-600 dark:text-indigo-400">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-xl">Missing Search Parameters</h3>
                <p className="text-xs text-text-muted">Provide a target role and location to run your job search.</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-text-muted font-bold">Target Roles (comma separated)</label>
                <input 
                  type="text" 
                  value={missingRoleInput} 
                  onChange={(e) => setMissingRoleInput(e.target.value)}
                  placeholder="e.g. Senior UX Designer, Product Designer" 
                  className="input-field text-sm w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-text-muted font-bold">Target Locations (semicolon separated)</label>
                <input 
                  type="text" 
                  value={missingLocationInput} 
                  onChange={(e) => setMissingLocationInput(e.target.value)}
                  placeholder="e.g. London, UK; Florida, USA; 33101" 
                  className="input-field text-sm w-full"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowMissingParamsModal(false);
                  setIsSearching(false);
                }} 
                className="flex-1 py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const roles = missingRoleInput.split(",").map(r => r.trim()).filter(Boolean);
                  const locs = missingLocationInput.split(";").map(l => l.trim()).filter(isValidLocation);
                  if (roles.length === 0 || locs.length === 0) {
                    alert("Please provide both at least one Role and one valid Location.");
                    return;
                  }
                  
                  // Update state
                  setTargetTitles(roles);
                  setTargetLocations(locs);
                  setShowMissingParamsModal(false);

                  // Persist to Supabase/storage immediately
                  const { saveUserProfile } = await import("@/app/actions/jobActions");
                  const updatedProfile = {
                    ...profile,
                    targetTitles: roles,
                    targetLocations: locs
                  };
                  await saveUserProfile(updatedProfile);

                  // Execute search directly with the new params
                  setIsSearching(true);
                  setStatus("Launching stealth browser...");
                  try {
                    let newJobs: Job[] = [];
                    if (searchMode === 'deep') {
                      setStatus("Precision Mode: Scanning ATS Platforms...");
                      const precisionTitles = roles.slice(0, 3);
                      newJobs = await runWebDiscovery(precisionTitles, locs, radius);
                    } else {
                      newJobs = await runJobSearch(
                        roles, 
                        locs, 
                        radius, 
                        profile.resumeText || ""
                      );
                    }
                    await addJobs(newJobs); 
                    setResults(prev => {
                      const existingUrls = new Set(prev.map(j => j.url));
                      const uniqueNew = newJobs.filter(j => !existingUrls.has(j.url));
                      return [...uniqueNew, ...prev];
                    });
                    await setAgentStatus({ 
                      isSearching: false, 
                      status: `Found ${newJobs.length} matches via ${searchMode}.`,
                      resultsFound: newJobs.length 
                    });
                    setStatus(`Found ${newJobs.length} new matches via ${searchMode} search.`);
                  } catch (error) {
                    console.error(error);
                    setStatus("Search failed. Check console.");
                  } finally {
                    setIsSearching(false);
                  }
                }} 
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-indigo-600/20"
              >
                Apply & Run Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

