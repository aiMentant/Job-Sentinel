"use client";


import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

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
  Globe,
  Copy,
  Target,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  X,
  Users,
  Building,
  Minimize2,
  Maximize2,
  Activity,
  Terminal,
  Check,
  Loader2,
  Home
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
  updateJobStatus,
  bulkMoveToPipeline
} from "@/app/actions/jobActions";

import { getAgentStatus, setAgentStatus } from "@/app/actions/agentStatus";
import { runWebDiscovery } from "@/app/actions/webSearchAgent";
import { generateDreamCompanies, generateNicheJobBoards } from "@/app/actions/careerTools";
import { Job, UserProfile } from "@/lib/db";
import Link from "next/link";
import { useProfile } from "@/components/ProfileContext";
import { getSourceBadgeClass, computeGhostScore, getGhostBadge } from "@/lib/jobUtils";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";

const isValidLocation = (loc: string): boolean => {
  const l = loc.toLowerCase().trim();
  if (!l) return false;
  if (l.includes("city, state") || l.includes("cist, state") || l.includes("[city") || l.includes("[cist") || l.includes("placeholder")) return false;
  // If it's a generic placeholder like "city / state"
  if (l.includes("city") && l.includes("state")) return false;
  return true;
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
  const [rankedRoles, setRankedRoles] = useState<Array<{ title: string; score: number; reason: string }>>([]);
  const [activeRole, setActiveRole] = useState<string>("");
  const [selectedTabRole, setSelectedTabRole] = useState<string>("all");
  const [apiKeysStatus, setApiKeysStatus] = useState<{ jsearch: boolean; adzuna: boolean; usajobs: boolean; browserless: boolean } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  const [results, setResults] = useState<Job[]>([]);
  const [isMovingToPipeline, setIsMovingToPipeline] = useState(false);
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [alternativeTitles, setAlternativeTitles] = useState<string[]>([]);
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [radius, setRadius] = useState<number>(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewingJob, setReviewingJob] = useState<Job | null>(null);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);
  const [showHighScoresOnly, setShowHighScoresOnly] = useState(false);
  const [searchMode, setSearchMode] = useState<'standard' | 'deep'>('standard');
  const [isProgressModalMinimized, setIsProgressModalMinimized] = useState(false);
  const [searchLogs, setSearchLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [showAlternativeTitles, setShowAlternativeTitles] = useState(false);
  const [showBooleanTools, setShowBooleanTools] = useState(false);
  const [dreamCompanies, setDreamCompanies] = useState<any[]>([]);
  const [isGeneratingDreamList, setIsGeneratingDreamList] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'ghost' | 'companies' | 'boards'>('live');
  const [nicheBoards, setNicheBoards] = useState<any[]>([]);
  const [isGeneratingNicheBoards, setIsGeneratingNicheBoards] = useState(false);
  const [isScanningAllCompanies, setIsScanningAllCompanies] = useState(false);

  // ── Location Pill-Toggle Architecture ──────────────────────────────────────
  // activeSearchLocations: the subset of targetLocations currently selected for search.
  // All locations are "on" by default. Users can deselect cities to focus a run.
  const [activeSearchLocations, setActiveSearchLocations] = useState<string[]>([]);
  const [showQuotaGuardrailModal, setShowQuotaGuardrailModal] = useState(false);
  // pendingSearch is used to hold the search until the user confirms the guardrail modal
  const [pendingSearchTitles, setPendingSearchTitles] = useState<string[] | null>(null);
  // baseLocation: the anchor city for proximity sorting and Dream Company commute estimates
  const [baseLocation, setBaseLocation] = useState<string>("");
  // Distance badges: map of { location -> miles from base }, loaded lazily
  const [locationDistances, setLocationDistances] = useState<Record<string, number>>({});
  const [isFetchingDistances, setIsFetchingDistances] = useState(false);
  // activeTargetSites: subset of targetSites currently enabled for search
  const [activeTargetSites, setActiveTargetSites] = useState<string[]>([]);

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
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'match'>('match');
  const [lastSearchTime, setLastSearchTime] = useState<Date | null>(null);
  const [newJobIds, setNewJobIds] = useState<Set<string>>(new Set());
  const [searchFeedback, setSearchFeedback] = useState<{
    show: boolean;
    count: number;
    mode: 'standard' | 'deep';
  } | null>(null);
  const [workSettingFilter, setWorkSettingFilter] = useState<'all' | 'remote' | 'hybrid' | 'onsite'>('all');
  const [postedWithinFilter, setPostedWithinFilter] = useState<string>("all");
  const [undoDismissJob, setUndoDismissJob] = useState<Job | null>(null);
  const [hideGhostJobs, setHideGhostJobs] = useState(false);
  const [showFilterGrid, setShowFilterGrid] = useState(false);
  const [searchHistory, setSearchHistory] = useState<Array<{ date: string; query: string; count: number; mode: 'standard' | 'deep' }>>([
    { date: new Date(Date.now() - 1000 * 60 * 30).toISOString(), query: "Senior UX Designer", count: 8, mode: "standard" },
    { date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), query: "Product Designer", count: 4, mode: "deep" }
  ]);
  const [savedConfigs, setSavedConfigs] = useState<Array<{ name: string; targetTitles: string[]; targetLocations: string[]; radius: number; targetSites: string[]; isLocked?: boolean }>>([]);
  const [showPresetHelp, setShowPresetHelp] = useState(false);
  const [hoveredGhostJobId, setHoveredGhostJobId] = useState<string | null>(null);
  const [hoveredPendingJobId, setHoveredPendingJobId] = useState<string | null>(null);
  const [estimatingSalaryIds, setEstimatingSalaryIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(25);
  const lastSearchedProfileId = useRef<string | null>(null);

  useEffect(() => {
    setVisibleCount(25);
  }, [activeTab, selectedLocationFilter, selectedJobType, selectedSiteFilter, workSettingFilter, postedWithinFilter, showHighScoresOnly, hideGhostJobs, sortBy, selectedTabRole]);

  // ── Distance badge effect: geocode distances when baseLocation changes ────────
  useEffect(() => {
    if (!baseLocation || targetLocations.length <= 1) {
      setLocationDistances({});
      return;
    }
    let cancelled = false;
    setIsFetchingDistances(true);
    setLocationDistances({});
    import("@/app/actions/jobActions").then(({ getLocationDistances }) => {
      getLocationDistances(baseLocation, targetLocations).then(distances => {
        if (!cancelled) {
          setLocationDistances(distances);
          setIsFetchingDistances(false);
        }
      }).catch(() => {
        if (!cancelled) setIsFetchingDistances(false);
      });
    });
    return () => { cancelled = true; };
  }, [baseLocation, targetLocations.join("|")]);

  // Keyboard shortcut: Escape closes any open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (reviewingJob) setReviewingJob(null);
        if (showDismissModal) setShowDismissModal(false);
        if (showMissingParamsModal) setShowMissingParamsModal(false);
        if (showQuotaGuardrailModal) setShowQuotaGuardrailModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reviewingJob, showDismissModal, showMissingParamsModal, showQuotaGuardrailModal]);



  useEffect(() => {
    async function load() {
      setIsDataLoading(true);
      try {
        const p = await fetchUserProfile(activeProfileId);
        if (p) {
          setProfile(p);
          setDreamCompanies(p.dreamCompanies || []);
          setNicheBoards(p.nicheBoards || []);
          
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
          setAlternativeTitles(p.alternativeTitles || []);
          setTargetLocations(locs);
          // Initialize activeSearchLocations: use saved subset if stored, otherwise all locations active
          const savedActive = p.activeSearchLocations && p.activeSearchLocations.length > 0
            ? p.activeSearchLocations.filter((l: string) => locs.includes(l))
            : locs;
          setActiveSearchLocations(savedActive.length > 0 ? savedActive : locs);
          // Initialize baseLocation from profile, default to first valid location
          setBaseLocation(p.baseLocation || locs[0] || "");
          // Initialize activeTargetSites: all sites active by default
          const sites = p.targetSites && p.targetSites.length > 0 ? p.targetSites : ["linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "usajobs.gov", "snagajob.com"];
          setActiveTargetSites(sites);
          const activeSites = p.targetSites && p.targetSites.length > 0 ? p.targetSites : ["linkedin.com", "indeed.com"];
          if (p.targetSites && p.targetSites.length > 0) setTargetSites(p.targetSites);
          if (p.searchRadius) setRadius(p.searchRadius);

          // Dynamically load search presets from localStorage, falling back to a fresh "My Profile Default"
          let localSaved: any[] = [];
          if (typeof window !== "undefined") {
            const savedStr = localStorage.getItem(`job_sentinel_presets_${activeProfileId}`);
            if (savedStr) {
              try {
                localSaved = JSON.parse(savedStr);
              } catch (_) {}
            }
          }

          const defaultPreset = {
            name: "My Profile Default",
            targetTitles: roles,
            targetLocations: locs,
            radius: p.searchRadius || 25,
            targetSites: activeSites,
            isLocked: true
          };

          const customPresets = localSaved.filter((c: any) => c.name !== "My Profile Default" && !c.isLocked);
          setSavedConfigs([defaultPreset, ...customPresets]);

          // Check if absolutely required parameters are missing
          if (roles.length === 0 || locs.length === 0) {
            setMissingRoleInput(roles.join(", "));
            setMissingLocationInput(locs.join("; "));
            setShowMissingParamsModal(true);
          }

          // AI Alignment Fit Ranking
          const { rankTargetRoles } = await import("@/app/actions/jobActions");
          const ranking = await rankTargetRoles(activeProfileId);
          const ranked = ranking?.roles || [];
          setRankedRoles(ranked);

          const { checkApiKeysStatus } = await import("@/app/actions/jobActions");
          const keysStatus = await checkApiKeysStatus();
          setApiKeysStatus(keysStatus);

          const urlParams = new URLSearchParams(window.location.search);
          const paramRole = urlParams.get('activeRole');
          if (paramRole && roles.includes(paramRole)) {
            setActiveRole(paramRole);
            setSelectedTabRole(paramRole);
          } else {
            setActiveRole("");
            setSelectedTabRole("all");
          }

          // Check for background search
          const agent = await getAgentStatus();
          let backgroundSearching = agent.isSearching;
          if (backgroundSearching) {
            setIsSearching(true);
            setStatus(`${agent.status} (Found ${agent.resultsFound || 0} matches so far)`);
            setSearchLogs([
              `[System] Syncing with background search...`,
              `[Status] ${agent.status} (${agent.resultsFound || 0} matches found so far)`
            ]);
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
    if (typeof window !== "undefined" && activeProfileId && savedConfigs.length > 0) {
      const localStorageKey = `job_sentinel_presets_${activeProfileId}`;
      const customConfigs = savedConfigs.filter(c => !c.isLocked && c.name !== "My Profile Default");
      localStorage.setItem(localStorageKey, JSON.stringify(customConfigs));
    }
  }, [savedConfigs, activeProfileId]);

  useEffect(() => {
    if (!reviewingJob) return;

    const isPlaceholder = 
      !reviewingJob.description || 
      reviewingJob.description === "Details fetched during search." || 
      reviewingJob.description.startsWith("Job listing on") || 
      reviewingJob.description.length < 150;

    if (isPlaceholder) {
      setIsLoadingDescription(true);
      import("@/app/actions/jobActions").then(async ({ fetchJobDetails }) => {
        try {
          const details = await fetchJobDetails(reviewingJob.id, activeProfileId);
          if (details && details.description) {
            setReviewingJob(prev => prev && prev.id === reviewingJob.id ? { ...prev, description: details.description } : prev);
            setResults(prev => prev.map(j => j.id === reviewingJob.id ? { ...j, description: details.description } : j));
          } else {
            const { fetchFullJobDescription } = await import("@/app/actions/jobActions");
            const fullDesc = await fetchFullJobDescription(reviewingJob.id, reviewingJob.url, activeProfileId);
            setReviewingJob(prev => prev && prev.id === reviewingJob.id ? { ...prev, description: fullDesc } : prev);
            setResults(prev => prev.map(j => j.id === reviewingJob.id ? { ...j, description: fullDesc } : j));
          }
        } catch (err) {
          console.error("Auto-description extraction failed:", err);
        } finally {
          setIsLoadingDescription(false);
        }
      });
    }
  }, [reviewingJob?.id, activeProfileId]);

  // Background AI Salary Estimation — runs lazily for any new job missing salary data
  useEffect(() => {
    const jobsNeedingSalary = results.filter(
      j => j.score >= 75 && !j.salaryRange && !j.salary_range && !j.aiSalaryEstimate && !estimatingSalaryIds.has(j.id)
    );
    if (jobsNeedingSalary.length === 0) return;

    // Rate-limit: process max 3 at a time to avoid hammering Gemini
    const batch = jobsNeedingSalary.slice(0, 3);

    batch.forEach(job => {
      setEstimatingSalaryIds(prev => new Set([...prev, job.id]));

      import("@/app/actions/careerTools").then(async ({ estimateAISalary }) => {
          try {
            const result = await estimateAISalary(
              job.title,
              job.company,
              job.location,
              job.description?.slice(0, 400)
            );
            if (result?.estimate) {
              // Update local state immediately for instant UI feedback
              setResults(prev => prev.map(j => j.id === job.id
                ? { ...j, aiSalaryEstimate: result.estimate, aiSalaryBasis: result.basis }
                : j
              ));
              // Also update reviewingJob if this job is open in the modal
              setReviewingJob(prev => prev?.id === job.id
                ? { ...prev, aiSalaryEstimate: result.estimate, aiSalaryBasis: result.basis }
                : prev
              );
              // Persist to DB so it doesn't re-estimate on next load
              try {
                const { updateJob } = await import("@/app/actions/jobActions");
                await updateJob(job.id, { aiSalaryEstimate: result.estimate, aiSalaryBasis: result.basis }, activeProfileId);
              } catch (_) {}
            }
          } catch (err) {
            console.error("[AISalary] estimation failed for", job.id, err);
          } finally {
            setEstimatingSalaryIds(prev => { const n = new Set(prev); n.delete(job.id); return n; });
          }
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map(j => `${j.id}:${j.score}`).join(','), activeProfileId]);

  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      const agent = await getAgentStatus();
      if (!active) return;
      if (agent.isSearching) {
        setIsSearching(true);
        setStatus(`${agent.status} (Found ${agent.resultsFound || 0} matches so far)`);
        
        setSearchLogs(prev => {
          if (prev.length === 0) {
            return [
              `[System] Syncing with background search...`,
              `[Status] ${agent.status} (${agent.resultsFound || 0} matches found so far)`
            ];
          }
          return prev;
        });

        import("@/app/actions/jobActions").then(({ fetchJobs }) => {
          fetchJobs(activeProfileId).then(allJobs => {
            if (!active) return;
            setResults(allJobs.filter((j: any) => j.status === 'Discovery'));
          });
        });
      } else {
        setIsSearching(prev => {
          if (prev) {
            import("@/app/actions/jobActions").then(({ fetchJobs }) => {
              fetchJobs(activeProfileId).then(allJobs => {
                if (!active) return;
                setResults(allJobs.filter((j: any) => j.status === 'Discovery'));
              });
            });
            return false;
          }
          return prev;
        });
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeProfileId]);

  // Telemetry Log Accumulator & Scroll Effect
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [searchLogs]);

  useEffect(() => {
    if (isSearching && status) {
      setSearchLogs(prev => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newLog = `[${timeStr}] ${status}`;
        
        const baseStatus = status.split(" (Found")[0];
        
        if (prev.length > 0) {
          const lastLog = prev[prev.length - 1];
          if (lastLog.includes(baseStatus)) {
            const updated = [...prev];
            updated[updated.length - 1] = newLog;
            return updated;
          }
        }
        return [...prev, newLog];
      });
    }
  }, [status, isSearching]);

  // Reset active filter dropdown states when profile or search mode changes
  useEffect(() => {
    setSelectedJobType("all");
    setSelectedLocationFilter("all");
    setSelectedSiteFilter("all");
    setPostedWithinFilter("all");
  }, [activeProfileId, searchMode]);



  const sortedTabs = [...targetTitles].sort((a, b) => {
    const scoreA = rankedRoles.find(r => r.title.toLowerCase().trim() === a.toLowerCase().trim())?.score || 0;
    const scoreB = rankedRoles.find(r => r.title.toLowerCase().trim() === b.toLowerCase().trim())?.score || 0;
    return scoreB - scoreA;
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const siteOptions = searchMode === 'standard' 
    ? ["LinkedIn", "Indeed", "Glassdoor", "ZipRecruiter", "USAJOBS", "Snagajob"]
    : ["Greenhouse", "Lever", "Workday", "Deep Index"];

  const getJobWorkSetting = (job: Job) => {
    const text = `${job.title || ""} ${job.location || ""} ${job.description || ""}`.toLowerCase();
    const loc = (job.location || "").toLowerCase();
    const isHybrid = loc.includes("hybrid") || text.includes("hybrid");
    const isRemote = (loc.includes("remote") || text.includes("remote") || text.includes("work from home") || text.includes("wfh") || loc.includes("anywhere") || loc.includes("worldwide")) && !isHybrid;
    if (isHybrid) return 'hybrid';
    if (isRemote) return 'remote';
    return 'onsite';
  };

  const baseFilteredRaw = results.filter(j => {
    const isGhostFlagged = (j.reason || "").toLowerCase().includes("flag") || (j.reason || "").toLowerCase().includes("ghost") || (j.reason || "").toLowerCase().includes("talent pool");
    const isRejected = (j.status || "").toLowerCase() === 'rejected' && isGhostFlagged;
    
    // Filter by Search Mode (Standard vs Deep)
    const isDeepSource = (j.source || "").toLowerCase().includes("deep") || 
                         (j.source || "").toLowerCase().includes("greenhouse") || 
                         (j.source || "").toLowerCase().includes("lever") || 
                         (j.source || "").toLowerCase().includes("workday");
    if (searchMode === 'standard' && isDeepSource) return false;
    if (searchMode === 'deep' && !isDeepSource) return false;

    // Filter out jobs that are already in the application pipeline (starred)
    if (j.isFavourite) return false;

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

    // Filter by posting recency (time-based)
    if (postedWithinFilter !== "all") {
      const daysOld = getPostingDaysOld(j.postedAt, j.createdAt);
      if (postedWithinFilter === "3d" && daysOld > 3) return false;
      if (postedWithinFilter === "1w" && daysOld > 7) return false;
      if (postedWithinFilter === "2w" && daysOld > 14) return false;
      if (postedWithinFilter === "1m" && daysOld > 30) return false;
    }

    // Filter out jobs with a ghost score >= 80 if the toggle is checked
    if (hideGhostJobs) {
      const ghostScore = j.ghostScore ?? computeGhostScore(j);
      if (ghostScore >= 80) return false;
    }

    // Filter by selected tab role (support legacy matches via title keyword check)
    if (selectedTabRole && selectedTabRole !== "all") {
      const roleLower = selectedTabRole.toLowerCase().trim();
      const matchesMeta = j.matchedRole && j.matchedRole.toLowerCase().trim() === roleLower;
      const matchesTitle = (j.title || "").toLowerCase().includes(roleLower);
      if (!matchesMeta && !matchesTitle) return false;
    }

    if (activeTab === 'live') {
      return !isRejected && (!showHighScoresOnly || j.score >= 80);
    }
    return isRejected;
  });

  // Group/Deduplicate jobs by title + company (case-insensitive)
  const groupedJobsMap = new Map<string, Job & { allSources?: string[] }>();
  baseFilteredRaw.forEach(job => {
    const key = `${(job.title || "").toLowerCase().trim()}::${(job.company || "").toLowerCase().trim()}`;
    if (groupedJobsMap.has(key)) {
      const existing = groupedJobsMap.get(key)!;
      if (existing.allSources) {
        if (!existing.allSources.includes(job.source)) {
          existing.allSources.push(job.source);
        }
      } else {
        existing.allSources = [existing.source, job.source];
      }
      if (job.score > existing.score) {
        groupedJobsMap.set(key, { ...job, allSources: existing.allSources });
      }
    } else {
      groupedJobsMap.set(key, { ...job, allSources: [job.source] });
    }
  });

  const baseFilteredGrouped = Array.from(groupedJobsMap.values());

  const remoteCount = baseFilteredGrouped.filter(j => getJobWorkSetting(j) === 'remote').length;
  const hybridCount = baseFilteredGrouped.filter(j => getJobWorkSetting(j) === 'hybrid').length;
  const onsiteCount = baseFilteredGrouped.filter(j => getJobWorkSetting(j) === 'onsite').length;
  const allCount = baseFilteredGrouped.length;

  const filteredResults = baseFilteredGrouped
    .filter(j => {
      if (workSettingFilter === 'all') return true;
      return getJobWorkSetting(j) === workSettingFilter;
    })
    .sort((a, b) => {
      if (a.isFavourite && !b.isFavourite) return -1;
      if (!a.isFavourite && b.isFavourite) return 1;

      if (sortBy === 'newest') {
        const dateA = new Date(a.postedAt || a.createdAt || 0).getTime() || 0;
        const dateB = new Date(b.postedAt || b.createdAt || 0).getTime() || 0;
        return dateB - dateA;
      } else if (sortBy === 'oldest') {
        const dateA = new Date(a.postedAt || a.createdAt || 0).getTime() || 0;
        const dateB = new Date(b.postedAt || b.createdAt || 0).getTime() || 0;
        return dateA - dateB;
      } else {
        // Sort by Match Score (descending)
        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;

        // Tie-breaker: Newest first within match score tier
        const dateA = new Date(a.postedAt || a.createdAt || 0).getTime() || 0;
        const dateB = new Date(b.postedAt || b.createdAt || 0).getTime() || 0;
        return dateB - dateA;
      }
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

  const handleBulkAnalyze = async (ids?: string[]) => {
    const targetIds = ids || selectedIds;
    if (isBulkAnalyzing || targetIds.length === 0) return;
    setIsBulkAnalyzing(true);
    setStatus(`AI is analyzing ${targetIds.length} matches...`);

    for (let i = 0; i < targetIds.length; i++) {
      const jobId = targetIds[i];
      const existing = results.find(j => j.id === jobId);
      if (existing && existing.score && existing.score > 0) {
        continue;
      }

      setResults(prev => prev.map(j => j.id === jobId ? { ...j, reason: `AI is analyzing (${i + 1}/${targetIds.length})...` } : j));

      try {
        const result = await analyzeSingleJob(jobId, activeProfileId);
        if (result) {
          setResults(prev => prev.map(j => j.id === jobId ? { ...j, ...result } : j));
        }
      } catch (e) {
        console.error("Bulk analysis fail for job", jobId, e);
        setResults(prev => prev.map(j => j.id === jobId ? { ...j, reason: "Analysis failed. Rate limit?" } : j));
      }
    }

    setStatus("Bulk AI analysis completed.");
    setIsBulkAnalyzing(false);
    if (!ids) {
      setSelectedIds([]);
    }
    setTimeout(() => setStatus(""), 3000);
  };


  const handleBulkMove = async () => {
    if (isMovingToPipeline || selectedIds.length === 0) return;
    setIsMovingToPipeline(true);
    setStatus(`Moving ${selectedIds.length} jobs to Pipeline...`);
    try {
      // Optimistic UI update: Star them on client immediately
      setResults(prev => prev.map(j => selectedIds.includes(j.id) ? { ...j, isFavourite: true } : j));
      
      const count = selectedIds.length;
      const res = await bulkMoveToPipeline(selectedIds, activeProfileId);
      if (res && res.success) {
        setStatus(`Successfully moved ${count} jobs to Pipeline.`);
        setTimeout(() => setStatus(""), 3000);
      } else {
        throw new Error(res?.error || "Unknown error during bulk move.");
      }
      setSelectedIds([]);
    } catch (e: any) {
      console.error(e);
      alert(`Failed to move jobs to Pipeline: ${e.message || String(e)}`);
      setStatus("Bulk move failed.");
    } finally {
      setIsMovingToPipeline(false);
    }
  };

  const getPostingAgeBadge = (postedAt?: string, createdAt?: string) => {
    const date = postedAt || createdAt;
    if (!date) {
      return {
        text: "Date unknown",
        className: "bg-foreground/5 text-text-muted border border-card-border"
      };
    }
    const msDiff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(msDiff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    let text = "";
    if (hours < 1) {
      text = "Just now";
    } else if (hours < 24) {
      text = `${hours}h ago`;
    } else if (days < 7) {
      text = `${days}d ago`;
    } else {
      text = `${Math.floor(days / 7)}w ago`;
    }

    if (days < 3) {
      return {
        text,
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
      };
    } else if (days <= 14) {
      return {
        text,
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20"
      };
    } else {
      return {
        text,
        className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
      };
    }
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

  const getPostingDaysOld = (postedAt?: string, createdAt?: string): number => {
    const date = postedAt || createdAt;
    if (!date) return 999;
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getEstimatedClosingDate = (postedAt?: string): string => {
    if (!postedAt) return "";
    const postedTime = new Date(postedAt).getTime();
    const closingTime = postedTime + 1000 * 60 * 60 * 24 * 30; // 30 days
    const daysRemaining = Math.ceil((closingTime - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 0) return "Expired";
    if (daysRemaining === 1) return "Closes tomorrow";
    return `Closes in ${daysRemaining}d`;
  };

  const stripHtml = (htmlStr: string) => {
    if (!htmlStr) return "";
    return htmlStr
      .replace(/<style([\s\S]*?)<\/style>/gi, '')
      .replace(/<script([\s\S]*?)<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  };

  const highlightKeywords = (text: string, keywords: string[]) => {
    if (!text || !keywords || keywords.length === 0) return text;
    
    const sortedKeywords = [...keywords]
      .filter(Boolean)
      .map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
      .sort((a, b) => b.length - a.length);
      
    if (sortedKeywords.length === 0) return text;
    
    const regex = new RegExp(`\\b(${sortedKeywords.join('|')})\\b`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, idx) => {
      const isMatch = sortedKeywords.some(k => new RegExp(`^${k}$`, 'i').test(part));
      return isMatch ? (
        <mark key={idx} className="keyword-highlight px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      );
    });
  };

  const selectAll = () => {
    if (selectedIds.length === filteredResults.length) setSelectedIds([]);
    else setSelectedIds(filteredResults.map(j => j.id));
  };

  const removeArrayItem = (field: 'targetTitles' | 'targetLocations' | 'targetSites' | 'alternativeTitles', index: number) => {
    if (field === 'targetTitles') {
      setTargetTitles(prev => prev.filter((_, i) => i !== index));
    } else if (field === 'targetLocations') {
      setTargetLocations(prev => prev.filter((_, i) => i !== index));
    } else if (field === 'alternativeTitles') {
      setAlternativeTitles(prev => prev.filter((_, i) => i !== index));
    } else {
      setTargetSites(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addArrayItem = (field: 'targetTitles' | 'targetLocations' | 'targetSites' | 'alternativeTitles', value: string) => {
    if (!value.trim()) return;
    const cleanValue = value.trim();
    if (field === 'targetTitles') {
      setTargetTitles(prev => prev.includes(cleanValue) ? prev : [...prev, cleanValue]);
    } else if (field === 'targetLocations') {
      setTargetLocations(prev => prev.includes(cleanValue) ? prev : [...prev, cleanValue]);
    } else if (field === 'alternativeTitles') {
      setAlternativeTitles(prev => prev.includes(cleanValue) ? prev : [...prev, cleanValue]);
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
    if (!profile.resumeText) {
      setStatus("No resume found. Please add one in Profile.");
      return;
    }
    setIsRegenerating(true);
    setStatus("AI is analyzing resume for new roles...");
    try {
      const data = await parseResumeText(profile.resumeText, activeProfileId);
      
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
      const p = await fetchUserProfile(activeProfileId);
      if (p) {
        setProfile(p);
        const roles = p.targetTitles || [];
        const locs = (p.targetLocations || []).filter(isValidLocation);
        const sites = p.targetSites || ["linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "usajobs.gov", "snagajob.com"];
        setTargetTitles(roles);
        setAlternativeTitles(p.alternativeTitles || []);
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
    } catch (e: any) {
      setStatus(`Sync Failed: ${e.message || String(e)}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSearch = async (titlesOverride?: string[], locationsOverride?: string[]) => {
    let titles = titlesOverride;
    if (!titles) {
      if (activeRole) {
        titles = [activeRole];
      } else {
        // If on the "All Roles" tab, search all roles sequentially
        titles = targetTitles;
      }
    }
    // Use activeSearchLocations (pill-selected subset) unless a specific override is passed
    const locations = (locationsOverride || activeSearchLocations.filter(isValidLocation))
      .filter(isValidLocation);

    if (titles.length === 0 || locations.length === 0) {
      setMissingRoleInput(titles.join(", "));
      setMissingLocationInput(locations.join("; "));
      setShowMissingParamsModal(true);
      return;
    }

    // Quota Guardrail: warn when searching 4+ locations (high API cost)
    if (!locationsOverride && locations.length >= 4) {
      setPendingSearchTitles(titles);
      setShowQuotaGuardrailModal(true);
      return;
    }

    setIsSearching(true);
    setStatus("Launching stealth browser...");
    setSearchLogs(["[System] Initializing Discovery Agent...", "[System] Launching stealth browser..."]);
    setScanningTitles(titles.map(t => ({ title: t, status: 'pending' })));
    
    try {
      if (searchMode === 'deep') {
        setStatus("Precision Mode: Scanning ATS Platforms...");
        setScanningTitles(titles.slice(0, 3).map((t, idx) => ({ title: t, status: idx === 0 ? 'scanning' : 'pending' })));
        const precisionTitles = titles.slice(0, 3);
        const newJobs = await runWebDiscovery(
          precisionTitles, 
          locations.length > 0 ? locations : (profile.location ? [profile.location] : ["USA"]), 
          radius, 
          dreamCompanies,
          alternativeTitles,
          profile.matchStrictness || 'exact'
        );
        
        await addJobs(newJobs, activeProfileId);
        setResults(prev => {
          const existingUrls = new Set(prev.map(j => j.url));
          const uniqueNew = newJobs.filter(j => !existingUrls.has(j.url));
          
          const newIds = uniqueNew.map(j => j.id);
          setNewJobIds(prevSet => {
            const updated = new Set(prevSet);
            newIds.forEach(id => updated.add(id));
            return updated;
          });

          const updated = [...uniqueNew, ...prev];
          autoVetTopResults(updated);
          return updated;
        });
        setScanningTitles(titles.slice(0, 3).map(t => ({ title: t, status: 'done' })));
        setStatus(`Found ${newJobs.length} new matches via deep search.`);
        setLastSearchTime(new Date());
        setSearchFeedback({
          show: true,
          count: newJobs.length,
          mode: 'deep'
        });
        const queryText = precisionTitles.join(", ");
        setSearchHistory(prev => [
          { date: new Date().toISOString(), query: queryText, count: newJobs.length, mode: 'deep' },
          ...prev
        ]);

      } else {
        let totalFound = 0;
        const initialScans = titles.map((t, idx) => ({ title: t, status: (idx === 0 ? 'scanning' : 'pending') as any }));
        setScanningTitles(initialScans);

        let activeRadius = radius;
        const originalRadius = radius;
        let hasExpandedRadius = false; // Only expand once per full session
        for (let i = 0; i < titles.length; i++) {
          const currentTitle = titles[i];
          
          setScanningTitles(prev => prev.map((item, idx) => {
            if (idx === i) return { ...item, status: 'scanning' };
            if (idx < i) return { ...item, status: 'done' };
            return item;
          }));
          
          setStatus(`Scanning for "${currentTitle}"...`);
          
          try {
            let newJobs = await runJobSearch(
              [currentTitle], 
              locations, 
              activeRadius, 
              profile.resumeText || "",
              activeTargetSites.length > 0 ? activeTargetSites : targetSites,
              activeProfileId,
              profile.matchStrictness || 'exact',
              alternativeTitles
            );

            // Auto-Expansion Fallback if 0 results found across ALL titles so far
            // Only expand once per session, by 5 miles, capped at originalRadius + 50
            if (newJobs.length === 0 && totalFound === 0 && !hasExpandedRadius && activeRadius < originalRadius + 50) {
              const expandedRadius = Math.min(activeRadius + 5, originalRadius + 50);
              hasExpandedRadius = true;
              activeRadius = expandedRadius;
              // NOTE: Do NOT update setRadius() here — preserve the user's saved setting

              await setAgentStatus({
                isSearching: true,
                status: `No matches found within ${originalRadius} miles for "${currentTitle}". Slightly widening radius to ${expandedRadius} miles...`,
                resultsFound: totalFound
              });

              await new Promise(resolve => setTimeout(resolve, 1500));

              newJobs = await runJobSearch(
                [currentTitle],
                locations,
                activeRadius,
                profile.resumeText || "",
                activeTargetSites.length > 0 ? activeTargetSites : targetSites,
                activeProfileId,
                profile.matchStrictness || 'exact',
                alternativeTitles
              );
            }


            totalFound += newJobs.length;

            if (newJobs.length > 0) {
              await addJobs(newJobs, activeProfileId);
              setResults(prev => {
                const existingUrls = new Set(prev.map(j => j.url));
                const uniqueNew = newJobs.filter(j => !existingUrls.has(j.url));
                
                const newIds = uniqueNew.map(j => j.id);
                setNewJobIds(prevSet => {
                  const updated = new Set(prevSet);
                  newIds.forEach(id => updated.add(id));
                  return updated;
                });

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
        setLastSearchTime(new Date());
        setSearchFeedback({
          show: true,
          count: totalFound,
          mode: 'standard'
        });
        const queryText = titles.join(", ");
        setSearchHistory(prev => [
          { date: new Date().toISOString(), query: queryText, count: totalFound, mode: 'standard' },
          ...prev
        ]);
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
    if (!profile || !(profile as any).geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      return;
    }
    setIsGeneratingDreamList(true);
    setStatus("AI is researching companies in your area...");
    try {
      // Put baseLocation first so generateDreamCompanies uses it as the commute anchor
      const locationsForDreamSearch = baseLocation
        ? [baseLocation, ...(activeSearchLocations.length > 0 ? activeSearchLocations : targetLocations).filter(l => l !== baseLocation)]
        : (activeSearchLocations.length > 0 ? activeSearchLocations : targetLocations);
      const list = await generateDreamCompanies(locationsForDreamSearch, radius, targetTitles, activeProfileId);
      if (!list || list.length === 0) {
        throw new Error("No companies discovered. Please verify your Gemini API key is configured.");
      }
      const initialList = list.map(c => ({ ...c, scanningStatus: 'idle' as 'idle' | 'scanning' | 'done' | 'failed', jobsFoundCount: 0 }));
      setDreamCompanies(initialList);
      
      const { patchUserProfile } = await import("@/app/actions/jobActions");
      await patchUserProfile({ dreamCompanies: initialList }, activeProfileId);

      setIsGeneratingDreamList(false);
      setActiveTab('companies');
      setStatus("");

      // Start scanning each company sequentially in background
      let currentList = [...initialList];
      for (let idx = 0; idx < currentList.length; idx++) {
        const comp = currentList[idx];
        currentList = currentList.map((c, i) => i === idx ? { ...c, scanningStatus: 'scanning' as const } : c);
        setDreamCompanies(currentList);
        await patchUserProfile({ dreamCompanies: currentList }, activeProfileId);
        
        setStatus(`Scanning ${idx + 1}/${currentList.length}: ${comp.name}...`);
        
        try {
          const { scanCompanyJobs, addJobs } = await import("@/app/actions/jobActions");
          const newJobs = await scanCompanyJobs(comp.name, targetTitles, activeSearchLocations.length > 0 ? activeSearchLocations : targetLocations, comp.careerUrl, alternativeTitles);
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
          currentList = currentList.map((c, i) => i === idx ? { ...c, scanningStatus: 'done' as const, jobsFoundCount: newJobs.length } : c);
        } catch (err) {
          console.error(err);
          currentList = currentList.map((c, i) => i === idx ? { ...c, scanningStatus: 'failed' as const, jobsFoundCount: 0 } : c);
        }
        setDreamCompanies(currentList);
        await patchUserProfile({ dreamCompanies: currentList }, activeProfileId);
      }
      setStatus("Dream companies scanning complete.");
      setTimeout(() => setStatus(""), 4000);
    } catch (e: any) {
      console.error(e);
      setStatus(e.message || "Failed to research companies.");
      setIsGeneratingDreamList(false);
    }
  };

  const handleScanCompany = async (index: number, companyName: string, careerUrl?: string) => {
    setDreamCompanies(prev => {
      const updated = prev.map((c, i) => i === index ? { ...c, scanningStatus: 'scanning' as const } : c);
      import("@/app/actions/jobActions").then(async ({ patchUserProfile }) => {
        await patchUserProfile({ dreamCompanies: updated }, activeProfileId);
      });
      return updated;
    });
    setStatus(`Scanning ${companyName}...`);
    try {
      const { scanCompanyJobs, addJobs } = await import("@/app/actions/jobActions");
      const newJobs = await scanCompanyJobs(companyName, targetTitles, activeSearchLocations.length > 0 ? activeSearchLocations : targetLocations, careerUrl, alternativeTitles);
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
      
      setDreamCompanies(prev => {
        const updated = prev.map((c, i) => i === index ? { ...c, scanningStatus: 'done' as const, jobsFoundCount: newJobs.length } : c);
        import("@/app/actions/jobActions").then(async ({ patchUserProfile }) => {
          await patchUserProfile({ dreamCompanies: updated }, activeProfileId);
        });
        return updated;
      });
      setTimeout(() => setStatus(""), 3000);
    } catch (error) {
      console.error(error);
      setStatus(`Scan failed for ${companyName}.`);
      setDreamCompanies(prev => {
        const updated = prev.map((c, i) => i === index ? { ...c, scanningStatus: 'failed' as const } : c);
        import("@/app/actions/jobActions").then(async ({ patchUserProfile }) => {
          await patchUserProfile({ dreamCompanies: updated }, activeProfileId);
        });
        return updated;
      });
    }
  };

  const handleScanAllCompanies = async () => {
    if (dreamCompanies.length === 0) return;
    setIsScanningAllCompanies(true);
    setStatus("Batch agent scanning all discovered dream companies...");
    try {
      const { scanCompanyJobs, addJobs, patchUserProfile } = await import("@/app/actions/jobActions");
      let totalFound = 0;
      let currentList = [...dreamCompanies];

      for (let i = 0; i < currentList.length; i++) {
        const company = currentList[i];
        currentList = currentList.map((c, index) => index === i ? { ...c, scanningStatus: 'scanning' as const } : c);
        setDreamCompanies(currentList);
        await patchUserProfile({ dreamCompanies: currentList }, activeProfileId);
        
        setStatus(`Batch scanning [${i + 1}/${currentList.length}]: ${company.name}...`);
        
        try {
          const newJobs = await scanCompanyJobs(company.name, targetTitles, activeSearchLocations.length > 0 ? activeSearchLocations : targetLocations, company.careerUrl, alternativeTitles);
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
          currentList = currentList.map((c, index) => index === i ? { ...c, scanningStatus: 'done' as const, jobsFoundCount: newJobs.length } : c);
        } catch (err) {
          console.error(err);
          currentList = currentList.map((c, index) => index === i ? { ...c, scanningStatus: 'failed' as const } : c);
        }
        setDreamCompanies(currentList);
        await patchUserProfile({ dreamCompanies: currentList }, activeProfileId);
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
    if (!profile || !(profile as any).geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      return;
    }
    setIsGeneratingNicheBoards(true);
    setStatus("AI is identifying high-yield niche job boards for your background...");
    try {
      const boards = await generateNicheJobBoards(activeProfileId);
      setNicheBoards(boards);
      
      const { patchUserProfile } = await import("@/app/actions/jobActions");
      await patchUserProfile({ nicheBoards: boards }, activeProfileId);

      setStatus(`Discovered ${boards.length} niche job boards!`);
      setTimeout(() => setStatus(""), 4000);
    } catch (e) {
      console.error(e);
      setStatus("Failed to discover niche boards.");
    } finally {
      setIsGeneratingNicheBoards(false);
    }
  };

  // Compute percentage based on scanningTitles status
  const totalSteps = scanningTitles.length;
  const completedSteps = scanningTitles.filter(t => t.status === 'done' || t.status === 'failed').length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <PanelGroup orientation="horizontal" className="flex h-[calc(100vh-54px)] overflow-hidden w-full relative">
      
      {/* Center Main Window (Top Nav and Discovery Engine Content) */}
      <Panel defaultSize="75%" minSize="40%" className="flex flex-col h-full">
        <main role="main" className="flex-1 flex flex-col h-full overflow-y-auto p-8 space-y-8 min-w-0 transition-all duration-300">
        
        {searchFeedback && searchFeedback.show && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-between animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-semibold">
                Search complete! Discovered <strong className="text-emerald-750 dark:text-emerald-350">{searchFeedback.count}</strong> new opportunities matching your strategy via {searchFeedback.mode === 'deep' ? 'Deep Web Scan' : 'Standard Agent'}.
              </span>
            </div>
            <button 
              onClick={() => setSearchFeedback(null)}
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-lg cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
        
        {/* Header container in center window */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold font-outfit">Discovery Engine</h1>
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-card-border/60 pb-3 gap-4">
            <div className="flex gap-6 overflow-x-auto pb-1 max-w-full min-w-0 relative -mb-[13px] [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <button 
                onClick={() => setActiveTab('live')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'live' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-text-muted hover:text-foreground'}`}
              >
                Live Opportunities
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-black text-[9px]">
                  {results.filter(j => j.status === 'Discovery' && !j.isFavourite).length}
                </span>
                {activeTab === 'live' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600 dark:bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-in fade-in duration-300" />}
              </button>
              <button 
                onClick={() => setActiveTab('ghost')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'ghost' ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-text-muted hover:text-foreground'}`}
              >
                Rejected / Flagged
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-black text-[9px]">
                  {results.filter(j => j.status === 'Rejected').length}
                </span>
                {activeTab === 'ghost' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-600 dark:bg-amber-400 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-in fade-in duration-300" />}
              </button>
              <button 
                onClick={() => setActiveTab('companies')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative whitespace-nowrap ${activeTab === 'companies' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-text-muted hover:text-foreground'}`}
              >
                Dream Companies
                {activeTab === 'companies' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600 dark:bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-in fade-in duration-300" />}
              </button>
              <button 
                onClick={() => setActiveTab('boards')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative whitespace-nowrap ${activeTab === 'boards' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-text-muted hover:text-foreground'}`}
              >
                Niche Boards
                {activeTab === 'boards' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-600 dark:bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-in fade-in duration-300" />}
              </button>
            </div>
            
            {/* Command Bar Header (Actions & View controls in single row) */}
            <div className="flex flex-col sm:flex-row gap-2 shrink-0 items-stretch sm:items-center">
              <div className="flex items-center gap-2">
                <button 
                  onClick={selectAll}
                  className="btn-secondary py-1.5 px-3 text-xs font-semibold tracking-wide cursor-pointer transition-all duration-200"
                  title="Select or deselect all visible jobs on the current tab for bulk actions"
                >
                  {selectedIds.length === filteredResults.length ? "Deselect All" : "Select All"}
                </button>
                <button 
                  onClick={() => handleBulkAnalyze(filteredResults.map(j => j.id))}
                  disabled={isBulkAnalyzing || filteredResults.length === 0}
                  className={`btn-secondary py-1.5 px-3 text-xs font-semibold tracking-wide cursor-pointer bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all ${isBulkAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Analyze all currently visible jobs sequentially using Gemini AI"
                >
                  {isBulkAnalyzing ? "Analyzing..." : `AI Analyze All (${filteredResults.length})`}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowHighScoresOnly(!showHighScoresOnly)}
                  className={`btn-secondary py-1.5 px-3 text-xs font-semibold tracking-wide cursor-pointer flex items-center gap-1.5 transition-all ${showHighScoresOnly ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/50 shadow-lg shadow-indigo-500/10' : ''}`}
                  title="Filter the list to only show jobs with an AI match score of 80% or higher"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  {showHighScoresOnly ? "Showing 80%+" : "High Fit (80%+)"}
                </button>
                <button 
                  onClick={() => setHideGhostJobs(!hideGhostJobs)}
                  className={`btn-secondary py-1.5 px-3 text-xs font-semibold tracking-wide cursor-pointer flex items-center gap-1.5 transition-all ${hideGhostJobs ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 shadow-lg shadow-amber-500/10' : ''}`}
                  title="Hide jobs with a ghost/harvest score of 80% or higher"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  {hideGhostJobs ? "Ghost Hidden" : "Hide Ghost"}
                </button>
                <button 
                  onClick={() => setShowFilterGrid(!showFilterGrid)}
                  className={`btn-secondary py-1.5 px-3 text-xs font-semibold tracking-wide cursor-pointer flex items-center gap-1.5 transition-all ${showFilterGrid ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' : ''}`}
                  title="Toggle collapsible search filter drawer"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {(selectedJobType !== 'all' || selectedLocationFilter !== 'all' || selectedSiteFilter !== 'all' || postedWithinFilter !== 'all' || hideGhostJobs) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Filter Grid */}
          {showFilterGrid && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-card/45 backdrop-blur-xl border border-card-border/60 rounded-2xl animate-in slide-in-from-top-2 duration-200">
              {/* Sort By */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Sort By</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full btn-secondary py-2 pl-3 pr-8 text-xs bg-card border border-card-border rounded-xl outline-none cursor-pointer appearance-none text-indigo-600 dark:text-indigo-400 font-bold"
                    title="Sort the results display"
                  >
                    <option value="newest">🕒 Newest First</option>
                    <option value="match">✦ Best Match (AI)</option>
                    <option value="oldest">⏳ Oldest First</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Job Type */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Job Type</span>
                <div className="relative">
                  <select
                    value={selectedJobType}
                    onChange={(e) => setSelectedJobType(e.target.value)}
                    className="w-full btn-secondary py-2 pl-3 pr-8 text-xs bg-card border border-card-border rounded-xl outline-none cursor-pointer appearance-none"
                  >
                    <option value="all">All Job Types</option>
                    <option value="full-time">Full-Time</option>
                    <option value="part-time">Part-Time</option>
                    <option value="contract">Contract (1099)</option>
                    <option value="internship">Internship</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Location</span>
                <div className="relative">
                  <select
                    value={selectedLocationFilter}
                    onChange={(e) => setSelectedLocationFilter(e.target.value)}
                    className="w-full btn-secondary py-2 pl-3 pr-8 text-xs bg-card border border-card-border rounded-xl outline-none cursor-pointer appearance-none"
                  >
                    <option value="all">All Locations</option>
                    {targetLocations.map((loc, index) => (
                      <option key={index} value={loc}>{loc}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Site Source */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Site Source</span>
                <div className="relative">
                  <select
                    value={selectedSiteFilter}
                    onChange={(e) => setSelectedSiteFilter(e.target.value)}
                    className="w-full btn-secondary py-2 pl-3 pr-8 text-xs bg-card border border-card-border rounded-xl outline-none cursor-pointer appearance-none"
                  >
                    <option value="all">All Sites</option>
                    {siteOptions.map((site, index) => (
                      <option key={index} value={site.toLowerCase()}>{site}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Recency */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Recency</span>
                <div className="relative">
                  <select
                    value={postedWithinFilter}
                    onChange={(e) => setPostedWithinFilter(e.target.value)}
                    className="w-full btn-secondary py-2 pl-3 pr-8 text-xs bg-card border border-card-border rounded-xl outline-none cursor-pointer appearance-none"
                  >
                    <option value="all">Anytime</option>
                    <option value="3d">Last 3 Days</option>
                    <option value="1w">Last Week</option>
                    <option value="2w">Last 2 Weeks</option>
                    <option value="1m">Last Month</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          )}



          {/* API Credentials Warning Banner */}
          {apiKeysStatus && (!apiKeysStatus.jsearch || !apiKeysStatus.adzuna || !apiKeysStatus.usajobs) && (
            <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-3 animate-in fade-in duration-300">
              <span className="text-base leading-none">⚠️</span>
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-wider text-[10px]">Scraper APIs Offline / Missing Credentials</p>
                <p className="text-text-muted leading-relaxed">
                  The agent is running in key-less fallback mode because credentials are not configured in your Netlify Dashboard. 
                  To unlock hundreds of real-time listings, please configure these environment variables in your Netlify settings:
                </p>
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {!apiKeysStatus.jsearch && <span className="bg-black/10 dark:bg-white/5 border border-amber-500/30 px-2 py-0.5 rounded font-mono text-[10px]">RAPIDAPI_KEY (JSearch)</span>}
                  {!apiKeysStatus.adzuna && <span className="bg-black/10 dark:bg-white/5 border border-amber-500/30 px-2 py-0.5 rounded font-mono text-[10px]">ADZUNA_APP_ID & ADZUNA_APP_KEY</span>}
                  {!apiKeysStatus.usajobs && <span className="bg-black/10 dark:bg-white/5 border border-amber-500/30 px-2 py-0.5 rounded font-mono text-[10px]">USAJOBS_API_KEY</span>}
                </div>
              </div>
            </div>
          )}

          {/* Role Filtering Tabs */}
          {activeTab === 'live' && (
            <div className="flex flex-wrap gap-2 border-b border-card-border pb-3 mb-4">
              {/* All Roles Tab */}
              <button
                onClick={() => {
                  setSelectedTabRole("all");
                  setActiveRole("");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  selectedTabRole === "all"
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/10'
                    : 'bg-card border-card-border/60 text-text-muted hover:text-foreground'
                }`}
              >
                All Roles ({results.length})
              </button>
              {sortedTabs.map((role, idx) => {
                const count = results.filter(j => {
                  const roleLower = role.toLowerCase().trim();
                  return (j.matchedRole && j.matchedRole.toLowerCase().trim() === roleLower) || 
                         (j.title || "").toLowerCase().includes(roleLower);
                }).length;
                
                const rank = rankedRoles.find(r => r.title.toLowerCase().trim() === role.toLowerCase().trim());
                const score = rank?.score;
                const reason = rank?.reason;
                
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedTabRole(role);
                      setActiveRole(role);
                    }}
                    title={reason}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border group/role ${
                      selectedTabRole === role 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/10' 
                        : 'bg-card border-card-border/60 text-text-muted hover:text-foreground'
                    }`}
                  >
                    <span>{role} ({count})</span>
                    {score !== undefined && (
                      <span className={`text-[9px] px-1 py-0.5 rounded font-black ${
                        score >= 80 
                          ? 'bg-emerald-500/25 text-emerald-600 dark:text-emerald-400' 
                          : score >= 50 
                            ? 'bg-amber-500/25 text-amber-600 dark:text-amber-400' 
                            : 'bg-rose-500/25 text-rose-600 dark:text-rose-400'
                      }`}>
                        {score}%
                      </span>
                    )}
                    <a 
                      href={`/search?activeRole=${encodeURIComponent(role)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`text-xs flex items-center justify-center transition-opacity shrink-0 ml-0.5 ${
                        selectedTabRole === role 
                          ? 'opacity-85 hover:opacity-100 text-white' 
                          : 'opacity-0 group-hover/role:opacity-60 hover:!opacity-100 text-text-muted'
                      }`}
                      onClick={(e) => e.stopPropagation()} // Prevent triggering parent button click
                      title="Open this role feed in a new tab"
                    >
                      <ExternalLink size={11} />
                    </a>
                  </button>
                );
              })}
            </div>
          )}

          {/* Metadata bar: Count, Last Searched, Refresh */}
          {(activeTab === 'live' || activeTab === 'ghost') && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-card-border shadow-inner">
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="text-foreground">
                  Showing <strong className="text-indigo-600 dark:text-indigo-400">{filteredResults.length}</strong> of{" "}
                  <strong className="text-slate-700 dark:text-slate-350">{results.filter(j => activeTab === 'live' ? j.status === 'Discovery' && !j.isFavourite : j.status === 'Rejected').length}</strong> opportunities
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="text-text-muted flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Last searched: {lastSearchTime ? getPostingAge(lastSearchTime.toISOString()) : "Never"}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Remote / Hybrid / On-site selector buttons */}
                <div className="flex bg-black/10 dark:bg-white/5 p-0.5 rounded-lg border border-card-border text-[9px] font-bold uppercase tracking-wider">
                  {(['all', 'remote', 'hybrid', 'onsite'] as const).map(setting => {
                    const count = setting === 'all' ? allCount : setting === 'remote' ? remoteCount : setting === 'hybrid' ? hybridCount : onsiteCount;
                    const isDisabled = count === 0 && setting !== 'all';
                    return (
                      <button
                        key={setting}
                        disabled={isDisabled}
                        onClick={() => setWorkSettingFilter(setting)}
                        className={`px-2.5 py-1 rounded transition-all ${
                          workSettingFilter === setting 
                            ? 'bg-indigo-600 text-white shadow cursor-pointer font-extrabold' 
                            : isDisabled 
                              ? 'opacity-30 cursor-not-allowed text-text-muted/60' 
                              : 'text-text-muted hover:text-foreground cursor-pointer font-extrabold'
                        }`}
                      >
                        {setting} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Reload database jobs trigger */}
                <button
                  onClick={async () => {
                    setIsDataLoading(true);
                    try {
                      const { fetchJobs } = await import("@/app/actions/jobActions");
                      const allJobs = await fetchJobs(activeProfileId);
                      setResults(allJobs.filter((j: any) => j.status === 'Discovery'));
                      setStatus("Results synced from database.");
                      setTimeout(() => setStatus(""), 3000);
                    } catch (e) {
                      console.error("Sync failed:", e);
                    } finally {
                      setIsDataLoading(false);
                    }
                  }}
                  className="p-1.5 bg-black/10 dark:bg-white/5 border border-card-border hover:bg-black/20 dark:hover:bg-white/10 text-text-muted hover:text-foreground rounded-lg transition-all flex items-center gap-1 cursor-pointer text-[9px] font-bold uppercase"
                  title="Fetch jobs from database again"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync DB
                </button>
              </div>
            </div>
          )}

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
                    <div key={i} className={`glass-card p-5 hover:border-indigo-500/30 transition-all group relative flex flex-col justify-between ${company.scanningStatus === 'scanning' ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}>
                       <div>
                         <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2 text-base">
                              <Building className="w-4 h-4 text-indigo-500 shrink-0 animate-pulse" />
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
                            <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-600 dark:text-indigo-400 border border-indigo-500/10">{company.industry}</span>
                         </div>
                         
                         {/* Local Presence & Commute */}
                         <div className="flex items-center gap-3 mt-1.5 mb-3">
                           {company.commuteDistance && (
                             <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-text-muted bg-black/5 dark:bg-white/5 border border-card-border px-2 py-0.5 rounded">
                               🚗 {company.commuteDistance} commute
                             </span>
                           )}
                           <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                             ⚡ High Match Probability
                           </span>
                         </div>

                         <p className="text-xs text-text-muted leading-relaxed mb-3 italic">&ldquo;{company.reasoning}&rdquo;</p>
                         
                         {company.localPresence && (
                           <div className="mb-3 text-[11px] leading-relaxed text-text-muted bg-black/5 dark:bg-white/5 p-2 rounded border border-card-border/50">
                             <strong className="text-foreground">Local Footprint:</strong> {company.localPresence}
                           </div>
                         )}

                         {company.typicalRoles && company.typicalRoles.length > 0 && (
                           <div className="mb-4 text-[10px] text-text-muted flex items-center gap-1.5 flex-wrap">
                             <span className="font-bold text-foreground">Hires for:</span>
                             {company.typicalRoles.map((role: string, idx: number) => (
                               <span key={idx} className="bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded border border-card-border/50">{role}</span>
                             ))}
                           </div>
                         )}
                       </div>

                       <div className="flex gap-2 mt-auto">
                           <button 
                             onClick={() => handleScanCompany(i, company.name, company.careerUrl)}
                             disabled={isSearching || company.scanningStatus === 'scanning'}
                             className="flex-1 py-2 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 cursor-pointer text-center border border-indigo-500/20"
                           >
                             {company.scanningStatus === 'scanning' ? 'Scanning...' : 
                              company.scanningStatus === 'done' ? `Scan Openings (${company.jobsFoundCount || 0} Found)` : 'Scan Openings'}
                           </button>
                           {company.recruiterSearchUrl && (
                             <a 
                               href={company.recruiterSearchUrl} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="py-2 px-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 hover:text-indigo-500 rounded-lg text-text-muted border border-card-border flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
                               title="Search local recruiters on LinkedIn"
                             >
                               <Users className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                               Recruiters ↗
                             </a>
                           )}
                           {company.careerUrl && (
                             <a href={company.careerUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-text-muted hover:text-foreground border border-card-border flex items-center justify-center" title="Go to Careers Page">
                               <ExternalLink className="w-4 h-4" />
                             </a>
                           )}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          ) : results.length === 0 && isSearching ? (
            <div className="space-y-6">
              {/* Stepper Active Header Card */}
              <div className="glass-card p-6 border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/[0.02] rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center relative">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
                    <div className="absolute inset-0 border border-indigo-500/20 rounded-full animate-ping" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                      Stealth Search Engine Active
                    </h4>
                    <p className="text-xs text-text-muted">
                      Probing career platforms. Monitor telemetry in the progress dashboard.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsProgressModalMinimized(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20 w-full md:w-auto text-center font-bold"
                >
                  View Telemetry Console
                </button>
              </div>

              {/* Pulsing loading skeletons */}
              <div className="space-y-4">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="glass-card p-6 space-y-4 animate-pulse border-card-border/60">
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <div className="h-4 w-16 bg-black/10 dark:bg-white/10 rounded" />
                        <div className="h-4 w-12 bg-black/10 dark:bg-white/10 rounded" />
                      </div>
                      <div className="h-4 w-20 bg-black/10 dark:bg-white/10 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-6 w-2/3 bg-black/15 dark:bg-white/15 rounded" />
                      <div className="h-4 w-1/3 bg-black/10 dark:bg-white/10 rounded" />
                    </div>
                    <div className="h-12 w-full bg-black/5 dark:bg-white/5 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ) : results.length === 0 && !isSearching && lastSearchTime !== null ? (
            <div className="glass-card py-16 px-8 text-center space-y-6 max-w-2xl mx-auto border border-amber-500/20 bg-amber-500/[0.02] dark:bg-amber-500/[0.01] rounded-[2.5rem] shadow-xl shadow-amber-500/[0.01] animate-in fade-in duration-300">
              <div className="relative w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <MapPin className="w-10 h-10 text-amber-500" />
                <div className="absolute inset-0 border border-amber-500/20 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-bold text-xl text-foreground font-outfit">No Opportunities Discovered</h3>
                <p className="text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
                  Sorry{profile.firstName ? ` ${profile.firstName}` : ''}, no matches found within <strong className="text-foreground">{radius} miles</strong> of{baseLocation ? <> <span className="text-amber-500 font-bold">{baseLocation}</span> <span className="text-text-muted text-xs">(your base city)</span></> : <> <span className="text-foreground font-semibold">{activeSearchLocations.join(", ") || targetLocations.join(", ") || "your target locations"}</span></>} for: <span className="text-foreground font-semibold">{targetTitles.join(", ") || "your target roles"}</span>.
                </p>
              </div>

              {/* Suggestions Panel */}
              <div className="bg-black/5 dark:bg-white/5 border border-card-border rounded-2xl p-6 text-left max-w-xl mx-auto space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Recommended Strategies to Widen Search</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="font-bold text-foreground flex items-center gap-1.5 font-bold">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                      1. Widen Search Radius
                    </p>
                    <p className="text-text-muted text-[11px]">Increase search radius to 50 or 100 miles in strategy settings.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-foreground flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      2. Add Alternative Roles
                    </p>
                    <p className="text-text-muted text-[11px]">Add more keywords (e.g. UX, Product Designer) in your profile.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-foreground flex items-center gap-1.5 font-bold">
                      <Wand2 className="w-3.5 h-3.5 text-emerald-500" />
                      3. Deep Scan (ATS Direct)
                    </p>
                    <p className="text-text-muted text-[11px]">Switch search mode to 'Deep' to directly probe company career sites.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-foreground flex items-center gap-1.5 font-bold">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      4. Verify Local API Keys
                    </p>
                    <p className="text-text-muted text-[11px]">Ensure JSearch or Adzuna API credentials are configured.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto pt-2">
                <button
                  onClick={() => {
                    const expanded = Math.min(radius + 25, 100);
                    setRadius(expanded);
                    handleSearch(targetTitles, targetLocations);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20 font-bold"
                >
                  Expand Radius to {Math.min(radius + 25, 100)} Miles & Retry
                </button>
                {searchMode === 'standard' && (
                  <button
                    onClick={() => {
                      setSearchMode('deep');
                      setStatus("Switched to Precision Deep Search mode.");
                      setTimeout(() => setStatus(""), 3000);
                    }}
                    className="px-5 py-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-foreground border border-card-border text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer font-bold"
                  >
                    Switch to Deep Search
                  </button>
                )}
              </div>
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div className="glass-card py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-text-muted" />
              </div>
              <div>
                <p className="font-bold text-foreground">No active search running</p>
                <p className="text-sm text-text-muted">Trigger the agent to scan platforms for matches.</p>
              </div>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="glass-card py-20 text-center space-y-6 border-dashed border-card-border max-w-xl mx-auto rounded-[2rem]">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Filter className="w-8 h-8 text-indigo-500" />
              </div>
              <div className="space-y-2">
                <p className="font-bold text-foreground text-lg font-outfit">Opportunities filtered out</p>
                <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
                  All {results.length} discovered opportunities are currently hidden by your active filter criteria (e.g. setting, site, or job type).
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedJobType("all");
                  setSelectedLocationFilter("all");
                  setSelectedSiteFilter("all");
                  setWorkSettingFilter("all");
                  setPostedWithinFilter("all");
                  setShowHighScoresOnly(false);
                  setHideGhostJobs(false);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20 font-bold"
              >
                Clear All Active Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Filter Chips */}
              {(selectedJobType !== "all" || selectedLocationFilter !== "all" || selectedSiteFilter !== "all" || workSettingFilter !== "all") && (
                <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-black/5 dark:bg-white/5 border border-card-border rounded-lg animate-in fade-in duration-300">
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider px-2">Active Filters:</span>
                  {selectedJobType !== "all" && (
                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold rounded flex items-center gap-1">
                      Type: {selectedJobType}
                      <button onClick={() => setSelectedJobType("all")} className="hover:text-foreground cursor-pointer font-bold font-mono text-[9px]">&times;</button>
                    </span>
                  )}
                  {selectedLocationFilter !== "all" && (
                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold rounded flex items-center gap-1">
                      Loc: {selectedLocationFilter}
                      <button onClick={() => setSelectedLocationFilter("all")} className="hover:text-foreground cursor-pointer font-bold font-mono text-[9px]">&times;</button>
                    </span>
                  )}
                  {selectedSiteFilter !== "all" && (
                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold rounded flex items-center gap-1">
                      Site: {selectedSiteFilter}
                      <button onClick={() => setSelectedSiteFilter("all")} className="hover:text-foreground cursor-pointer font-bold font-mono text-[9px]">&times;</button>
                    </span>
                  )}
                  {workSettingFilter !== "all" && (
                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold rounded flex items-center gap-1">
                      Setting: {workSettingFilter}
                      <button onClick={() => setWorkSettingFilter("all")} className="hover:text-foreground cursor-pointer font-bold font-mono text-[9px]">&times;</button>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSelectedJobType("all");
                      setSelectedLocationFilter("all");
                      setSelectedSiteFilter("all");
                      setWorkSettingFilter("all");
                    }}
                    className="text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-indigo-500 cursor-pointer ml-auto px-2"
                  >
                    Clear All
                  </button>
                </div>
              )}
              {isSearching && (
                <div className="w-full bg-black/5 dark:bg-white/5 h-1.5 rounded-full overflow-hidden shrink-0 relative mb-4">
                  <div className="bg-indigo-600 h-full rounded-full animate-pulse w-2/3" />
                </div>
              )}
              {isSearching && scanningTitles.length > 0 && (
                <div className="mb-6 p-6 glass-card rounded-[2rem] border-indigo-500/20 bg-indigo-500/5 space-y-4">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Stealth Engine Active Scanning Process</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {scanningTitles.map((scan, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${scan.status === 'scanning' ? 'border-indigo-500 bg-indigo-500/5' : 'border-card-border'}`}>
                        {scan.status === 'scanning' ? (
                          <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin shrink-0" />
                        ) : scan.status === 'done' ? (
                          <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-bold shrink-0">✓</div>
                        ) : scan.status === 'failed' ? (
                          <div className="w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center text-[10px] font-bold shrink-0">!</div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-foreground/5 text-text-muted flex items-center justify-center text-[10px] font-bold shrink-0">•</div>
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
              {filteredResults.slice(0, visibleCount).map((job) => {
                const jobText = `${job.title} ${job.description}`.toLowerCase();
                const userSkills = profile.skills || [];
                const matchedSkills = userSkills.filter(s => s && jobText.includes(s.toLowerCase().trim()));
                const userRoles = targetTitles || [];
                const matchedRoles = userRoles.filter(r => r && jobText.includes(r.toLowerCase().trim()));
                const jobTypeDetected = detectJobType(job.title, job.description);

                return (
                  <div key={job.id} className={`glass-card flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 group hover:border-indigo-500/30 transition-all p-4 lg:p-6 ${selectedIds.includes(job.id) ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}>
                    {/* Left Side: Checkbox + Main Content */}
                    <div className="flex items-start gap-4 flex-grow min-w-0">
                      <div className="flex items-center pt-1.5 shrink-0">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(job.id)}
                          onChange={() => toggleSelection(job.id)}
                          aria-label={`Select ${job.title} at ${job.company}`}
                          className="w-5 h-5 rounded border-card-border bg-black/5 dark:bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 transition-all cursor-pointer"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {job.allSources && job.allSources.length > 1 ? (
                              <div className="flex gap-1.5 flex-wrap">
                                {job.allSources.map((src, idx) => (
                                  <span key={idx} className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${getSourceBadgeClass(src)}`}>
                                    {src.toLowerCase().includes("linkedin") ? "LinkedIn" : src.toLowerCase().includes("indeed") ? "Indeed" : src}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${getSourceBadgeClass(job.source)}`}>
                                {job.source.toLowerCase().includes("linkedin") ? "LinkedIn" : job.source.toLowerCase().includes("indeed") ? "Indeed" : job.source}
                              </span>
                            )}
                            {jobTypeDetected && (
                              <span className="text-[9px] font-bold bg-black/5 dark:bg-white/5 border border-card-border text-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">
                                {jobTypeDetected}
                              </span>
                            )}
                            <span className="w-1 h-1 rounded-full bg-card-border" />
                            <span className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-bold ${getPostingAgeBadge(job.postedAt, job.createdAt).className}`} title="Job posting age">
                              <Clock className="w-3 h-3" />
                              {getPostingAgeBadge(job.postedAt, job.createdAt).text}
                            </span>
                            {getPostingDaysOld(job.postedAt, job.createdAt) > 21 && getPostingDaysOld(job.postedAt, job.createdAt) < 999 && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                ⚠️ Est. expired
                              </span>
                            )}
                            {job.postedAt && (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                {getEstimatedClosingDate(job.postedAt)}
                              </span>
                            )}
                            {newJobIds.has(job.id) && (
                              <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white px-2 py-0.5 rounded-full animate-pulse shadow-md">
                                NEW
                              </span>
                            )}
                            {(() => {
                              const score = job.ghostScore ?? computeGhostScore(job);
                              const badge = getGhostBadge(score);
                              if (!badge) return null;
                              return (
                                <div 
                                  className="relative"
                                  onMouseEnter={() => setHoveredGhostJobId(job.id)}
                                  onMouseLeave={() => setHoveredGhostJobId(null)}
                                >
                                  <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-help ${badge.className}`}>
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    {badge.label}
                                  </span>
                                  {hoveredGhostJobId === job.id && (
                                    <div className="absolute bottom-full left-0 mb-2 p-3 bg-slate-900 border border-card-border text-slate-100 text-[10px] rounded-xl shadow-2xl z-50 w-72 leading-relaxed whitespace-pre-line animate-in fade-in duration-200">
                                      {badge.description}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          
                          <div className="flex gap-1.5">
                            {userSkills.length > 0 && (
                              <span 
                                className="text-[9px] font-bold bg-black/5 dark:bg-white/5 border border-card-border px-2 py-0.5 rounded text-foreground hover:bg-card-hover transition-all cursor-default" 
                                title={`Matched skills: ${matchedSkills.join(', ') || 'None'}. Missing: ${userSkills.filter(s => !matchedSkills.includes(s)).join(', ')}`}
                              >
                                Skills: {matchedSkills.length}/{userSkills.length}
                              </span>
                            )}
                            {userRoles.length > 0 && (
                              <span 
                                className="text-[9px] font-bold bg-black/5 dark:bg-white/5 border border-card-border px-2 py-0.5 rounded text-foreground hover:bg-card-hover transition-all cursor-default" 
                                title={`Matched target roles: ${matchedRoles.join(', ') || 'None'}`}
                              >
                                Roles: {matchedRoles.length}/{userRoles.length}
                              </span>
                            )}
                          </div>
                        </div>
                        <h4 className="font-bold text-lg text-foreground">
                          {highlightKeywords(job.title, [...(profile.skills || []), ...targetTitles])}
                        </h4>
                        <div className="flex items-center gap-3 text-sm mt-1">
                          <span className="font-bold text-foreground">{job.company}</span>
                          <div className="flex items-center gap-1 font-medium text-text-muted" title={`Matched for location query: ${job.location}`}>
                            <MapPin className="w-3.5 h-3.5 text-text-muted" />
                            {job.location}
                          </div>
                          {(job.salaryRange || job.salary_range) ? (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                              {job.salaryRange || job.salary_range}
                            </span>
                          ) : job.aiSalaryEstimate ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-text-muted bg-black/5 dark:bg-white/5 border border-card-border px-1.5 py-0.5 rounded cursor-help"
                              title={`AI Salary Estimate — not posted by employer. ${job.aiSalaryBasis || 'Based on market data for this role and location.'}`}
                            >
                              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                              AI Est. {job.aiSalaryEstimate}
                            </span>
                          ) : (estimatingSalaryIds.has(job.id) && job.score >= 75) ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-text-muted animate-pulse">
                              <Sparkles className="w-2.5 h-2.5" />
                              Estimating salary...
                            </span>
                          ) : (
                            <span className="text-text-muted text-xs italic">Salary not disclosed</span>
                          )}
                        </div>
                      
                      {/* AI Insights / Status Message */}
                      {job.reason && (
                        <div className="mt-3 p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-500/5 border border-indigo-500/20 animate-in fade-in slide-in-from-top-1">
                          <div className="flex items-start gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-foreground leading-relaxed font-medium italic">{job.reason}</p>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                    
                    {/* Vertical Divider (Desktop Only) */}
                    <div className="hidden lg:block w-px h-12 bg-card-border shrink-0" />
                    
                    {/* Right Side: Score + Action Buttons */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 border-t border-card-border/40 lg:border-t-0 pt-3 lg:pt-0 shrink-0 w-full lg:w-auto">
                      {/* Match Score */}
                      <div className="flex lg:flex-col lg:items-center justify-between items-center w-full lg:w-auto lg:min-w-[80px] shrink-0">
                        <span className="lg:hidden text-xs font-bold text-text-muted uppercase tracking-wider">AI Match Fit:</span>
                        <div className="text-right lg:text-center w-auto">
                          {job.score > 0 ? (
                            <>
                              <div className={`text-2xl font-bold ${job.score > 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {job.score}%
                              </div>
                              <p className="hidden lg:block text-[9px] text-text-muted uppercase font-bold tracking-tighter">AI Match</p>
                            </>
                          ) : (
                            <div 
                              className="py-1 relative cursor-help"
                              onMouseEnter={() => setHoveredPendingJobId(job.id)}
                              onMouseLeave={() => setHoveredPendingJobId(null)}
                            >
                              <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[10px] font-bold text-text-muted uppercase tracking-widest">Pending</span>
                              {hoveredPendingJobId === job.id && (
                                <div className="absolute bottom-full right-0 mb-2 p-2 bg-slate-900 border border-card-border text-slate-100 text-[10px] rounded shadow-2xl z-50 w-40 leading-relaxed text-left normal-case font-normal animate-in fade-in duration-200">
                                  Click &apos;Analyze Match&apos; for AI scoring, or this will auto-score shortly.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {job.score === 0 && (
                          <button
                            onClick={() => handleAnalyze(job.id)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 text-xs font-bold transition-all border border-indigo-500/20 cursor-pointer"
                            title="Trigger AI to scan the job details and score your match fit"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Analyze Match
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleFavourite(job.id)}
                          className={`p-2 rounded-lg transition-all cursor-pointer ${job.isFavourite ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-400/10' : 'text-text-muted hover:text-yellow-500'}`}
                          title={job.isFavourite ? "Remove from Favourites (Removes from Application Workshop list)" : "Add to Favourites (Sends this Discovery job directly to your Application Workshop)"}
                          aria-label={job.isFavourite ? "Remove from Favourites" : "Add to Favourites"}
                          aria-pressed={job.isFavourite}
                        >
                          <Star className={`w-4 h-4 ${job.isFavourite ? 'fill-current' : ''}`} />
                        </button>
                        <button 
                          onClick={() => toggleSelection(job.id)}
                          className={`p-2 rounded-lg transition-all cursor-pointer ${selectedIds.includes(job.id) ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-black/5 dark:bg-white/5 text-text-muted hover:text-foreground'}`}
                          title={selectedIds.includes(job.id) ? "Deselect this job" : "Select this job for batch operations (Move to Pipeline or Dismiss)"}
                          aria-label={selectedIds.includes(job.id) ? "Deselect this job" : "Select this job for batch operations"}
                          aria-pressed={selectedIds.includes(job.id)}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setReviewingJob(job)}
                          className="btn-primary py-2 px-4 text-xs cursor-pointer"
                          title="Preview job details, AI analysis score, and read full job description"
                        >
                          Quick Review
                        </button>
                        {/* Hover Single-click dismiss button */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setUndoDismissJob(job);
                            setResults(prev => prev.filter(j => j.id !== job.id));
                            await bulkDeleteJobs([job.id], activeProfileId);
                            setStatus(`Dismissed "${job.title}".`);
                            setTimeout(() => setStatus(""), 4000);
                          }}
                          className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-card-border hover:bg-rose-500/10 hover:border-rose-500/20 text-text-muted hover:text-rose-500 transition-all flex items-center justify-center cursor-pointer shrink-0"
                          title="Dismiss this job immediately"
                          aria-label="Dismiss job opportunity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
              );
              })}
              {filteredResults.length > visibleCount && (
                <div className="flex justify-center py-6 w-full">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 25)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg cursor-pointer"
                  >
                    Load More Jobs ({filteredResults.length - visibleCount} remaining)
                  </button>
                </div>
              )}
              {isSearching && (
                <div className="space-y-3 w-full">
                  {/* Status Indicator Card */}
                  <div className="glass-card flex items-center justify-between p-6 border-indigo-500/20 bg-indigo-500/5 shadow-lg shadow-indigo-500/5 animate-pulse rounded-xl gap-4">
                    <div className="flex-grow space-y-2 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin shrink-0" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                            Agent crawling platforms for more roles...
                          </h4>
                          <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">
                            Retrieving real-time listings from JSearch, USAJobs, and fallback ATS boards
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-black/5 dark:bg-white/5 h-8 w-24 rounded-lg shrink-0" />
                  </div>

                  {/* Pulsing Skeleton Opportunities */}
                  {[1, 2].map((i) => (
                    <div key={i} className="glass-card p-6 border-card-border/40 bg-card/30 animate-pulse rounded-xl space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 w-2/3">
                          <div className="h-3 bg-foreground/10 rounded w-1/4"></div>
                          <div className="h-5 bg-foreground/10 rounded w-full"></div>
                          <div className="h-4 bg-foreground/5 rounded w-1/2"></div>
                        </div>
                        <div className="h-10 w-24 bg-foreground/5 rounded-lg"></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      </Panel>


      {/* Discovery Strategy (Right Column) */}
      {showStrategyPanel && (
        <>
          <PanelResizeHandle className="relative w-1 hover:w-1.5 active:w-1.5 bg-card-border hover:bg-indigo-500/50 active:bg-indigo-500 transition-all cursor-col-resize z-50 shrink-0 flex items-center justify-center group/handle">
            <button 
              id="toggle-strategy-btn"
              onClick={() => setShowStrategyPanel(false)}
              className="absolute -left-3 top-20 w-6 h-6 bg-foreground hover:bg-foreground/90 rounded-full flex items-center justify-center border border-card-border text-background shadow-md transition-all duration-200 cursor-pointer hover:scale-110 z-50"
              title="Collapse Discovery Strategy"
              aria-label="Collapse Discovery Strategy"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </PanelResizeHandle>

          <Panel defaultSize="25%" minSize="20%" maxSize="50%" className="flex flex-col h-full bg-card/65 backdrop-blur-xl">
            <aside 
              aria-label="Discovery Strategy"
              className="relative h-full w-full flex flex-col shadow-2xl md:shadow-none overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6 animate-in fade-in duration-300 relative">
            {isDataLoading && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-3 min-h-[400px]">
                <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted animate-pulse">Syncing parameters...</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-foreground">Discovery Strategy</h2>
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
                  aria-label="Reset strategy to profile defaults"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                </button>
              </div>
            </div>

            {/* Presets / Saved Configs */}
            <div className="space-y-2 p-3 bg-black/10 dark:bg-white/5 rounded-xl border border-card-border">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Saved Presets</span>
                  <button 
                    onClick={() => setShowPresetHelp(!showPresetHelp)}
                    className="text-text-muted hover:text-foreground transition-colors cursor-pointer"
                    title="How presets work"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    const rawName = prompt("Enter a name for this search preset (e.g. 'Remote US' or 'Local Hybrid'):");
                    if (rawName) {
                      const trimmed = rawName.trim();
                      if (trimmed.length > 50) {
                        alert("Preset name is too long. Please restrict it to 50 characters or less.");
                        return;
                      }
                      if (trimmed) {
                        const exists = savedConfigs.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
                        if (exists) {
                          const confirmOverwrite = confirm(`A preset named "${trimmed}" already exists. Do you want to overwrite it with your current settings?`);
                          if (!confirmOverwrite) return;
                          
                          setSavedConfigs(prev => prev.map(c => 
                            c.name.toLowerCase() === trimmed.toLowerCase()
                              ? { ...c, targetTitles, targetLocations, radius, targetSites }
                              : c
                          ));
                          setStatus(`Updated preset "${trimmed}".`);
                        } else {
                          setSavedConfigs(prev => [
                            ...prev,
                            { name: trimmed, targetTitles, targetLocations, radius, targetSites }
                          ]);
                          setStatus(`Saved preset "${trimmed}".`);
                        }
                        setTimeout(() => setStatus(""), 3000);
                      }
                    }
                  }}
                  className="text-[9px] text-indigo-600 dark:text-indigo-400 font-black hover:underline uppercase cursor-pointer"
                >
                  + Save Current
                </button>
              </div>

              {/* Presets Explanation Tooltip Card */}
              {showPresetHelp && (
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg text-[10px] text-text-muted leading-relaxed animate-in fade-in duration-200">
                  <p className="font-bold text-indigo-600 dark:text-indigo-400 mb-1">How Presets Work</p>
                  Presets allow you to save specific combinations of job titles, locations, radius, and sites. Configure your filters to the desired values, click <strong className="text-foreground">+ Save Current</strong>, and name it (up to 50 characters) to save shortcuts like <strong>&quot;Remote Only&quot;</strong> or <strong>&quot;Local Hybrid&quot;</strong>. Custom presets persist on your device across reloads.
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {savedConfigs.map((config, index) => (
                  <div
                    key={index}
                    className="group relative flex items-center bg-black/20 dark:bg-white/5 border border-card-border hover:border-indigo-500/30 rounded text-[10px] font-semibold text-text-muted hover:text-foreground transition-all overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setTargetTitles(config.targetTitles);
                        setTargetLocations(config.targetLocations);
                        setRadius(config.radius);
                        setTargetSites(config.targetSites);
                        setStatus(`Loaded preset "${config.name}".`);
                        setTimeout(() => setStatus(""), 3000);
                      }}
                      className="px-2 py-0.5 text-left cursor-pointer transition-all"
                    >
                      {config.name}
                    </button>
                    {!config.isLocked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSavedConfigs(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="px-1.5 py-0.5 border-l border-card-border/50 text-text-muted hover:text-red-400 transition-colors cursor-pointer bg-black/10 dark:bg-white/5"
                        title="Delete Preset"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Target Roles */}
            <div>
              <label className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2 block">Target Roles</label>
              <div className="flex flex-col gap-1.5 mb-2">
                {(showAllRoles ? sortedTabs : sortedTabs.slice(0, 5)).map((title, i) => {
                  const rank = rankedRoles.find(r => r.title.toLowerCase().trim() === title.toLowerCase().trim());
                  const score = rank?.score;
                  const reason = rank?.reason;
                  const isActive = activeRole === title;
                  const originalIndex = targetTitles.indexOf(title);

                  return (
                    <div 
                      key={i} 
                      title={reason}
                      className={`group/role flex items-center justify-between p-2 rounded-lg border transition-all text-xs font-semibold ${
                        isActive 
                          ? 'bg-indigo-600/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-extrabold shadow' 
                          : 'bg-card border-card-border text-text-muted hover:text-foreground hover:bg-card-hover'
                      }`}
                    >
                      <button 
                        onClick={() => {
                          setActiveRole(title);
                          setSelectedTabRole(title);
                        }}
                        className="flex-grow text-left truncate flex items-center gap-1.5 cursor-pointer"
                      >
                        {title}
                        {score !== undefined && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-black shrink-0 ${
                            score >= 80 
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                              : score >= 50 
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' 
                                : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                          }`}>
                            {score}%
                          </span>
                        )}
                      </button>
                      
                      <div className="flex items-center gap-1 opacity-80 group-hover/role:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => {
                            setActiveRole(title);
                            setSelectedTabRole(title);
                            handleSearch([title]);
                          }}
                          className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                          title="Trigger search for this role"
                          aria-label={`Search jobs for role: ${title}`}
                        >
                          <Play size={10} className="fill-current" />
                        </button>
                        <a 
                          href={`/search?activeRole=${encodeURIComponent(title)}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                          title="Open in new tab"
                          aria-label={`Open feed for role ${title} in new tab`}
                        >
                          <ExternalLink size={10} />
                        </a>
                        <button 
                          onClick={() => removeArrayItem('targetTitles', originalIndex)} 
                          className="p-1 hover:text-rose-500 cursor-pointer"
                          title="Delete role"
                          aria-label={`Delete role: ${title}`}
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!showAllRoles && targetTitles.length > 5 && (
                  <button 
                    onClick={() => setShowAllRoles(true)}
                    className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/40 rounded text-[11px] text-indigo-600 dark:text-indigo-300 font-bold hover:bg-indigo-500/30 hover:text-white transition-all cursor-pointer w-full text-center"
                  >
                    + {targetTitles.length - 5} Show More
                  </button>
                )}
                {showAllRoles && targetTitles.length > 5 && (
                  <button 
                    onClick={() => setShowAllRoles(false)}
                    className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/40 rounded text-[11px] text-indigo-600 dark:text-indigo-300 font-bold hover:bg-indigo-500/30 hover:text-white transition-all cursor-pointer w-full text-center"
                  >
                    - Show Less
                  </button>
                )}
              </div>
              <input 
                type="text" 
                placeholder="Add role & press Enter..." 
                aria-label="Add target role"
                className="input-field text-xs py-1.5 w-full bg-card border-card-border focus:border-foreground/30 text-foreground"
                onKeyDown={(e) => { 
                  if (e.key === 'Enter') { 
                    if (e.currentTarget.value.trim()) {
                      addArrayItem('targetTitles', e.currentTarget.value); 
                      e.currentTarget.value = ''; 
                    } else {
                      handleSearch();
                    }
                  } 
                }}
              />
            </div>

            {/* Alternative Roles Accordion */}
            <div className="mt-3">
              <button
                onClick={() => setShowAlternativeTitles(!showAlternativeTitles)}
                className="w-full flex items-center justify-between px-3 py-2 bg-card border border-card-border rounded hover:bg-card-hover transition-colors text-xs font-semibold text-text-muted cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  Include Alternative Titles (+{alternativeTitles.length})
                </div>
                {showAlternativeTitles ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {showAlternativeTitles && (
                <div className="p-3 border border-t-0 border-card-border bg-card-hover/30 rounded-b space-y-2">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    These secondary titles will be used as lower-weighted fallbacks if your primary targets do not yield enough matches.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {alternativeTitles.map((title, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-500/10 border border-gray-500/20 rounded text-[11px] text-gray-400 flex items-center gap-1.5 font-semibold">
                        {title}
                        <button onClick={() => removeArrayItem('alternativeTitles', i)} className="hover:text-white cursor-pointer" aria-label={`Delete alternative title: ${title}`}>&times;</button>
                      </span>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Add alternative title & press Enter..." 
                    aria-label="Add alternative role title"
                    className="input-field text-xs py-1.5 w-full bg-card border-card-border focus:border-foreground/30 text-foreground"
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter') { 
                        if (e.currentTarget.value.trim()) {
                          addArrayItem('alternativeTitles', e.currentTarget.value); 
                          e.currentTarget.value = ''; 
                        } else {
                          handleSearch();
                        }
                      } 
                    }}
                  />
                </div>
              )}
            </div>

            {/* Target Locations — with pill toggles for active search selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-text-muted font-bold uppercase tracking-wider">Locations / Postcodes</label>
                <span className="text-[10px] text-text-muted">
                  {activeSearchLocations.length}/{targetLocations.length} active
                </span>
              </div>
              {/* Interactive Pill Toggles — click to include/exclude from next search */}
              <div className="flex flex-wrap gap-2 mb-2">
                {targetLocations.map((loc, i) => {
                  const isActive = activeSearchLocations.includes(loc);
                  const isBase = baseLocation === loc;
                  return (
                    <span
                      key={i}
                      className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 font-semibold border transition-all cursor-pointer select-none ${
                        isBase
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-400 shadow-sm shadow-amber-500/20'
                          : isActive
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/10'
                            : 'bg-card border-card-border/40 text-text-muted opacity-50 line-through'
                      }`}
                      onClick={() => {
                        setActiveSearchLocations(prev =>
                          isActive
                            ? prev.filter(l => l !== loc)
                            : [...prev, loc]
                        );
                      }}
                      title={isActive ? `Click to exclude "${loc}" from next search` : `Click to include "${loc}" in next search`}
                    >
                      {/* Base City badge / toggle */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const newBase = isBase ? "" : loc;
                          setBaseLocation(newBase);
                          // If setting as base, make sure it's active
                          if (!isBase && !activeSearchLocations.includes(loc)) {
                            setActiveSearchLocations(prev => [...prev, loc]);
                          }
                          const { patchUserProfile } = await import("@/app/actions/jobActions");
                          await patchUserProfile({ baseLocation: newBase }, activeProfileId);
                        }}
                        className={`flex-shrink-0 transition-colors cursor-pointer ${
                          isBase
                            ? 'text-amber-500 hover:text-amber-700'
                            : 'text-card-border/60 hover:text-amber-400'
                        }`}
                        title={isBase ? 'Remove as base city' : `Set "${loc}" as base city`}
                        aria-label={isBase ? 'Remove base city' : `Set ${loc} as base city`}
                      >
                        <Home className="w-3 h-3" />
                      </button>
                      {isBase && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 rounded">BASE</span>
                      )}
                      {!isBase && (
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                      )}
                      {loc}
                      {/* Distance badge — only shown for non-base pills when a base is set */}
                      {!isBase && baseLocation && (
                        locationDistances[loc] !== undefined
                          ? (
                            <span
                              className={`text-[9px] font-black tabular-nums px-1 py-0.5 rounded ${
                                locationDistances[loc] <= radius
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              }`}
                              title={`~${locationDistances[loc]} miles from ${baseLocation}`}
                            >
                              ~{locationDistances[loc]}mi
                            </span>
                          )
                          : isFetchingDistances && (
                            <span className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin opacity-40 flex-shrink-0" />
                          )
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSearchLocations(prev => prev.filter(l => l !== loc));
                          if (isBase) setBaseLocation("");
                          removeArrayItem('targetLocations', i);
                        }}
                        className="hover:text-red-400 cursor-pointer ml-0.5"
                        aria-label={`Delete location: ${loc}`}
                      >
                        &times;
                      </button>
                    </span>
                  );
                })}
              </div>
              {/* Quick-select helpers */}
              {targetLocations.length > 1 && (
                <div className="flex gap-1.5 mb-2">
                  <button
                    onClick={() => setActiveSearchLocations([...targetLocations])}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-text-muted text-[10px]">·</span>
                  <button
                    onClick={() => {
                      const focusCity = baseLocation || activeSearchLocations[0];
                      if (focusCity) setActiveSearchLocations([focusCity]);
                    }}
                    className="text-[10px] text-text-muted hover:underline cursor-pointer"
                  >
                    {baseLocation ? `Focus on Base (${baseLocation.split(',')[0]})` : 'Focus on First'}
                  </button>
                </div>
              )}
              {/* Base city info strip */}
              {baseLocation && (
                <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-amber-500/8 border border-amber-500/20 rounded-lg text-[10px] text-amber-700 dark:text-amber-400">
                  <Home className="w-3 h-3 flex-shrink-0" />
                  <span>
                    <strong>{baseLocation}</strong> is your base city —
                    {isFetchingDistances
                      ? <span className="ml-1 opacity-60">calculating distances...</span>
                      : <span className="ml-1">distances shown on each pill. <span className="opacity-70">(green = within {radius}mi radius)</span></span>
                    }
                  </span>
                </div>
              )}
              <input 
                type="text" 
                placeholder="Add location & press Enter..." 
                aria-label="Add target location"
                className="input-field text-xs py-1.5 w-full bg-card border-card-border focus:border-foreground/30 text-foreground"
                onKeyDown={(e) => { 
                  if (e.key === 'Enter') { 
                    if (e.currentTarget.value.trim()) {
                      const newLoc = e.currentTarget.value.trim();
                      addArrayItem('targetLocations', newLoc);
                      // Auto-activate new locations
                      setActiveSearchLocations(prev => [...prev, newLoc]);
                      // If no base is set yet, auto-set as base
                      if (!baseLocation) {
                        setBaseLocation(newLoc);
                        import("@/app/actions/jobActions").then(({ patchUserProfile }) => {
                          patchUserProfile({ baseLocation: newLoc }, activeProfileId);
                        });
                      }
                      e.currentTarget.value = ''; 
                    } else {
                      handleSearch();
                    }
                  } 
                }}
              />
              {activeSearchLocations.length === 0 && targetLocations.length > 0 && (
                <p className="text-[10px] text-amber-500 mt-1.5">
                  ⚠️ No locations active — all pills are deselected. Click a pill to activate it.
                </p>
              )}
            </div>

            {/* Target Job Sites — interactive toggle pills */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-text-muted font-bold uppercase tracking-wider">Target Job Sites</label>
                <span className="text-[10px] text-text-muted">
                  {activeTargetSites.length}/{targetSites.length} active
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {targetSites.map((site, i) => {
                  const isActive = activeTargetSites.includes(site);
                  return (
                    <span
                      key={i}
                      className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 font-semibold border transition-all cursor-pointer select-none ${
                        isActive
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400'
                          : 'bg-card border-card-border/40 text-text-muted opacity-50 line-through'
                      }`}
                      onClick={() =>
                        setActiveTargetSites(prev =>
                          isActive ? prev.filter(s => s !== site) : [...prev, site]
                        )
                      }
                      title={isActive ? `Click to exclude ${site}` : `Click to include ${site}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-indigo-500' : 'bg-gray-500'}`} />
                      {site}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTargetSites(prev => prev.filter(s => s !== site));
                          removeArrayItem('targetSites', i);
                        }}
                        className="hover:text-red-400 cursor-pointer ml-0.5"
                        aria-label={`Delete job site: ${site}`}
                      >
                        &times;
                      </button>
                    </span>
                  );
                })}
              </div>
              {/* Quick helpers */}
              {targetSites.length > 1 && (
                <div className="flex gap-1.5 mb-2">
                  <button
                    onClick={() => setActiveTargetSites([...targetSites])}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-text-muted text-[10px]">·</span>
                  <button
                    onClick={() => setActiveTargetSites([])}
                    className="text-[10px] text-text-muted hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              )}
              {activeTargetSites.length === 0 && targetSites.length > 0 && (
                <p className="text-[10px] text-amber-500 mt-1">
                  ⚠️ No sites active — search will use all sites as fallback.
                </p>
              )}
              <input
                type="text"
                placeholder="Add site (e.g. dice.com) & Enter..."
                aria-label="Add target job site"
                className="input-field text-xs py-1.5 w-full bg-card border-card-border focus:border-foreground/30 text-foreground"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.currentTarget.value.trim()) {
                      const newSite = e.currentTarget.value.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "");
                      addArrayItem('targetSites', newSite);
                      setActiveTargetSites(prev => [...prev, newSite]);
                      e.currentTarget.value = '';
                    } else {
                      handleSearch();
                    }
                  }
                }}
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
                aria-label="Search radius in miles"
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

            {/* Primary Search CTA moved to sticky footer */}



            {/* Boolean Search Strings (Advanced Tools) */}
            <div className="mt-4 pt-4 mb-4 border-t border-card-border">
              <label className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2 block">Advanced Tools</label>
              <div className="space-y-2">
                <button
                  onClick={() => setShowBooleanTools(!showBooleanTools)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-black/5 dark:bg-white/5 border border-card-border rounded hover:bg-card-hover transition-colors text-xs font-semibold text-text-muted cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-orange-400" />
                    Boolean Search Strings
                  </div>
                  {showBooleanTools ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showBooleanTools && (
                  <div className="p-3 border border-card-border bg-card-hover/30 rounded space-y-3">
                    <p className="text-[10px] text-text-muted leading-relaxed">
                      Copy these AI-generated boolean strings to manually hunt on LinkedIn, Indeed, or Google.
                    </p>
                    
                    {/* Strict Title Search */}
                    <div>
                      <div className="flex justify-between mb-1 items-end">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Strict (LinkedIn)</span>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            const str = targetTitles.map(t => `"${t}"`).join(" OR ");
                            navigator.clipboard.writeText(str);
                          }} className="text-[10px] text-text-muted hover:text-white" title="Copy">
                            <Copy className="w-3 h-3" />
                          </button>
                          <a href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(targetTitles.map(t => `"${t}"`).join(" OR "))}`} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-400 hover:text-indigo-300" title="Open in LinkedIn">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                      <code className="block p-2 bg-slate-100 dark:bg-black/30 rounded text-[10px] font-mono text-slate-800 dark:text-slate-200 break-all border border-slate-200 dark:border-black/20 select-all">
                        {targetTitles.map(t => `"${t}"`).join(" OR ")}
                      </code>
                    </div>

                    {/* Broad Search */}
                    <div>
                      <div className="flex justify-between mb-1 items-end">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Broad (Indeed/Google)</span>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            const str = [...targetTitles, ...(alternativeTitles || [])].map(t => `"${t}"`).join(" OR ");
                            navigator.clipboard.writeText(`(${str})`);
                          }} className="text-[10px] text-text-muted hover:text-white" title="Copy">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <code className="block p-2 bg-slate-100 dark:bg-black/30 rounded text-[10px] font-mono text-slate-800 dark:text-slate-200 break-all border border-slate-200 dark:border-black/20 select-all">
                        ({[...targetTitles, ...(alternativeTitles || [])].map(t => `"${t}"`).join(" OR ")})
                      </code>
                    </div>

                  </div>
                )}
              </div>
            </div>

            {/* Search button moved above fold — renders above Suggest Smart Targets */}
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

            {/* Sparkline trend indicator */}
            <div className="pt-4 border-t border-card-border space-y-2">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-text-muted tracking-wider">
                <span>Discovery Trend</span>
                <span className="text-emerald-500 font-extrabold">+24% this week</span>
              </div>
              <div className="flex items-end justify-between h-8 px-1">
                {[4, 7, 5, 8, 12, 10, 15].map((val, idx) => (
                  <div
                    key={idx}
                    className="w-2.5 bg-indigo-500/20 hover:bg-indigo-500 dark:bg-indigo-500/30 dark:hover:bg-indigo-400 rounded-t transition-all cursor-pointer"
                    style={{ height: `${(val / 15) * 100}%` }}
                    title={`Day ${idx + 1}: ${val} jobs discovered`}
                  />
                ))}
              </div>
            </div>

            {/* Search HistoryPresets and log */}
            <div className="pt-4 border-t border-card-border space-y-3">
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Search History Log</span>
              <div className="space-y-2">
                {searchHistory.slice(0, 5).map((hist, idx) => (
                  <div key={idx} className="p-2 rounded bg-black/10 dark:bg-white/5 border border-card-border text-[10px] leading-relaxed flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-300 truncate">{hist.query}</p>
                      <p className="text-[9px] text-text-muted flex items-center gap-1">
                        <span className="uppercase">{hist.mode}</span>
                        <span>•</span>
                        <span>{getPostingAge(hist.date)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1 rounded font-bold text-[9px]">
                        +{hist.count}
                      </span>
                      <button
                        onClick={() => {
                          setTargetTitles([hist.query]);
                          handleSearch([hist.query]);
                        }}
                        className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase cursor-pointer"
                      >
                        Run
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Sticky CTA Footer */}
          <div className="shrink-0 p-6 bg-card/90 backdrop-blur-md border-t border-card-border shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.3)] z-10 flex flex-col gap-3">
            {/* Primary Search CTA */}
            <button 
              onClick={() => handleSearch()}
              disabled={isSearching}
              className={`w-full btn-primary justify-center disabled:opacity-50 !py-4 transition-all shadow-xl cursor-pointer ${searchMode === 'deep' ? '!bg-emerald-600 hover:!bg-emerald-500 shadow-emerald-600/20' : ''}`}
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  Agent Scanning...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current shrink-0" />
                  Search Jobs
                </>
              )}
            </button>

            {/* AI Suggestion Button */}
            <button 
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500/20 transition-all cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? "Analyzing Resume..." : "Suggest Smart Targets"}
            </button>
          </div>
      </aside>
      </Panel>
      </>
      )}

      {/* Discovery Strategy Toggle tab when collapsed */}
      {!showStrategyPanel && (
        <button 
          onClick={() => setShowStrategyPanel(true)}
          className="fixed right-0 top-24 w-6 h-12 bg-foreground hover:bg-foreground/90 rounded-l-xl flex items-center justify-center border border-r-0 border-card-border text-background shadow-2xl z-40 cursor-pointer transition-all duration-200 hover:scale-110 hover:pr-1.5 animate-in slide-in-from-right duration-300"
          title="Expand Discovery Strategy"
          aria-label="Expand Discovery Strategy"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}


      {/* Undo Dismiss Toast */}
      {undoDismissJob && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 glass-card !bg-slate-900/90 border-card-border shadow-2xl flex items-center gap-6 py-3 px-5 animate-in slide-in-from-bottom-8 duration-300 z-[90] border">
          <span className="text-xs font-semibold text-slate-300">
            Dismissed <strong>{undoDismissJob.title}</strong>
          </span>
          <button
            onClick={async () => {
              if (undoDismissJob) {
                setResults(prev => [undoDismissJob, ...prev]);
                await addJobs([undoDismissJob], activeProfileId);
                setUndoDismissJob(null);
                setStatus("Restored job listing.");
                setTimeout(() => setStatus(""), 3000);
              }
            }}
            className="px-3 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 transition-all cursor-pointer"
          >
            Undo
          </button>
          <button
            onClick={() => setUndoDismissJob(null)}
            className="text-text-muted hover:text-foreground text-xs font-bold font-mono"
          >
            ✕
          </button>
        </div>
      )}

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
              disabled={isMovingToPipeline}
              className={`px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-1.5 ${isMovingToPipeline ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isMovingToPipeline ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
                  Moving...
                </>
              ) : "Move to Pipeline"}
            </button>
            <button 
              onClick={() => handleBulkAnalyze()}
              disabled={isBulkAnalyzing}
              className={`px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 ${isBulkAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isBulkAnalyzing ? "Analyzing..." : "AI Analyze Matches"}
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
      {mounted && reviewingJob && createPortal(
        <div className="fixed inset-0 z-50 p-5 bg-[#0a0a0c]/80 backdrop-blur-sm animate-in fade-in duration-200 flex">
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="glass-card w-full h-full relative z-10 animate-in zoom-in-95 duration-200 flex flex-col p-6 rounded-2xl overflow-hidden border-card-border bg-card"
          >
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{reviewingJob.source}</span>
                <h2 id="modal-title" className="text-2xl font-bold font-outfit mt-1">{reviewingJob.title}</h2>
                <p className="text-text-muted">{reviewingJob.company} &bull; {reviewingJob.location}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{reviewingJob.score}%</div>
                <p className="text-[10px] text-text-muted uppercase font-bold">AI Match</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 space-y-6 mb-6">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col min-h-0">
                  <h4 className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2 shrink-0">
                    <Sparkles className="w-4 h-4" />
                    AI Reasoning
                  </h4>
                  <div className="overflow-y-auto text-slate-900 dark:text-slate-300 text-xs leading-relaxed flex-1 pr-1.5 scrollbar-thin scrollbar-thumb-emerald-500">
                    {reviewingJob.reason}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/10 dark:bg-white/5 border border-card-border flex flex-col min-h-0">
                  <h4 className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 mb-2 shrink-0">
                    Job Description
                  </h4>
                  <div className="overflow-y-auto text-text-muted text-[11px] leading-relaxed whitespace-pre-wrap flex-1 pr-1.5 scrollbar-thin scrollbar-thumb-indigo-500">
                    {isLoadingDescription ? (
                      <div className="space-y-3 animate-pulse">
                        <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-3/4" />
                        <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-5/6" />
                        <div className="h-4 bg-black/10 dark:bg-white/10 rounded" />
                        <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-2/3" />
                        <div className="space-y-2 pt-4">
                          <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-1/2" />
                          <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-5/6" />
                          <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-3/4" />
                        </div>
                      </div>
                    ) : (
                      highlightKeywords(stripHtml(reviewingJob.description || "No description provided."), [
                        ...(profile.skills || []),
                        ...targetTitles,
                        ...(profile.alternativeTitles || [])
                      ])
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 shrink-0">
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
              className="absolute top-4 right-4 text-text-muted hover:text-foreground text-xl p-1"
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>
        </div>,
        document.body
      )}
      {/* Dismiss Confirmation Modal */}
      {mounted && showDismissModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="dismiss-modal-title"
            className="glass-card w-full max-w-md p-8 space-y-6 border-red-500/30"
          >
            <div className="flex items-center gap-4 text-red-600 dark:text-red-400">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 id="dismiss-modal-title" className="font-bold text-xl">Dismiss {selectedIds.length} Results?</h3>
                <p className="text-xs text-text-muted">These roles will be removed from your discovery feed.</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setShowDismissModal(false)} className="flex-1 py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-all">Cancel</button>
              <button onClick={handleBulkDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-red-600/20">Confirm Dismiss</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Missing Parameters Modal */}
      {mounted && showMissingParamsModal && createPortal(
        <div className="fixed inset-0 z-[100] p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 flex">
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="missing-modal-title"
            className="glass-card w-full h-full border-indigo-500/30 flex flex-col items-center justify-center rounded-2xl overflow-hidden p-8 bg-card"
          >
            <div className="w-full max-w-md space-y-6">
              <div className="flex items-center gap-4 text-indigo-600 dark:text-indigo-400">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 id="missing-modal-title" className="font-bold text-xl">Missing Search Parameters</h3>
                  <p className="text-xs text-text-muted">Provide a target role and location to run your job search.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="missing-roles-input" className="text-xs text-text-muted font-bold">Target Roles (comma separated)</label>
                  <input 
                    id="missing-roles-input"
                    type="text" 
                    value={missingRoleInput} 
                    onChange={(e) => setMissingRoleInput(e.target.value)}
                    placeholder="e.g. Senior UX Designer, Product Designer" 
                    className="input-field text-sm w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="missing-locations-input" className="text-xs text-text-muted font-bold">Target Locations (semicolon separated)</label>
                  <input 
                    id="missing-locations-input"
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
                    alternativeTitles: alternativeTitles,
                    targetLocations: locs
                  };
                  await saveUserProfile(updatedProfile);

                  // Execute search directly with the new params
                  setIsSearching(true);
                  setStatus("Launching stealth browser...");
                  setSearchLogs(["[System] Initializing Discovery Agent...", "[System] Launching stealth browser..."]);
                  try {
                    let newJobs: Job[] = [];
                    if (searchMode === 'deep') {
                      setStatus("Precision Mode: Scanning ATS Platforms...");
                      const precisionTitles = roles.slice(0, 3);
                      newJobs = await runWebDiscovery(
                        precisionTitles, 
                        locs, 
                        radius, 
                        dreamCompanies,
                        alternativeTitles,
                        profile.matchStrictness || 'exact'
                      );
                    } else {
                      newJobs = await runJobSearch(
                        roles, 
                        locs, 
                        radius, 
                        profile.resumeText || "",
                        targetSites,
                        activeProfileId,
                        profile.matchStrictness || 'exact',
                        alternativeTitles
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
            </div> {/* closing max-w-md wrapper */}
          </div>
        </div>,
        document.body
      )}

      {/* ── Quota Guardrail Modal ────────────────────────────────────────── */}
      {mounted && showQuotaGuardrailModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md animate-in fade-in duration-300 flex items-center justify-center p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quota-guardrail-title"
            className="glass-card w-full max-w-lg border border-amber-500/30 bg-card rounded-2xl overflow-hidden shadow-2xl shadow-amber-900/20 animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-b border-amber-500/20 px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 id="quota-guardrail-title" className="font-bold text-base text-foreground">
                  High API Usage Warning
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Searching {activeSearchLocations.length} locations will consume significant API quota.
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-text-muted leading-relaxed">
                Your search will run <span className="font-bold text-foreground">{(pendingSearchTitles?.length || 1)} role{(pendingSearchTitles?.length || 1) > 1 ? 's' : ''}</span> across <span className="font-bold text-amber-500">{activeSearchLocations.length} locations</span>. This may take several minutes and exhaust your monthly API budget faster.
              </p>

              {/* Active locations display */}
              <div className="bg-card-hover/60 rounded-xl p-3 border border-card-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Locations in this search:</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeSearchLocations.map((loc, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1"
                    >
                      <button
                        onClick={() => setActiveSearchLocations(prev => prev.filter(l => l !== loc))}
                        className="text-amber-500/60 hover:text-red-400 cursor-pointer text-[10px] leading-none"
                        title={`Remove ${loc} from this search`}
                      >
                        ×
                      </button>
                      {loc}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-text-muted mt-2">
                  💡 Tip: Click × on a location above to remove it, then proceed.
                </p>
              </div>

              {/* Recommendation */}
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
                  ✦ Recommended: Focus on 1–3 locations per run
                </p>
                <p className="text-[11px] text-text-muted">
                  Search your primary city first, then re-run for others. Results accumulate — you won't lose previous finds.
                </p>
                {activeSearchLocations.length > 1 && (
                  <button
                    onClick={() => {
                      setActiveSearchLocations([activeSearchLocations[0]]);
                    }}
                    className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                  >
                    Focus on "{activeSearchLocations[0]}" only →
                  </button>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => {
                  setShowQuotaGuardrailModal(false);
                  setPendingSearchTitles(null);
                }}
                className="flex-1 py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const titles = pendingSearchTitles;
                  const locs = activeSearchLocations.filter(isValidLocation);
                  setShowQuotaGuardrailModal(false);
                  setPendingSearchTitles(null);
                  if (titles && locs.length > 0) {
                    // Pass locations as override to bypass guardrail on re-entry
                    await (handleSearch as any)(titles, locs);
                  }
                }}
                disabled={activeSearchLocations.length === 0}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50 cursor-pointer"
              >
                Proceed with {activeSearchLocations.length} Location{activeSearchLocations.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Search Progress Modal */}

      {mounted && isSearching && !isProgressModalMinimized && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/80 backdrop-blur-md animate-in fade-in duration-300">
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-progress-title"
            className="glass-card w-full max-w-3xl border border-zinc-800 bg-zinc-900/95 dark:bg-zinc-955/95 text-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col p-6 md:p-8 animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-6 shrink-0 pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                </div>
                <div>
                  <h3 id="modal-progress-title" className="font-bold text-lg font-outfit text-white tracking-wide">
                    Identity-Stealth Discovery Agent
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {searchMode === 'deep' ? 'Precision crawler scanning direct ATS platforms' : 'Standard agent scanning global channels'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsProgressModalMinimized(true)}
                  className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all cursor-pointer"
                  title="Minimize to Dock (Keep running in background)"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress Bar Area */}
            <div className="space-y-2 mb-6 shrink-0">
              <div className="flex justify-between items-center text-xs font-bold text-zinc-400">
                <span className="flex items-center gap-1.5 font-bold">
                  {totalSteps > 0 ? (
                    `Scanning Role ${completedSteps + 1} of ${totalSteps}`
                  ) : (
                    'Initializing agent engine...'
                  )}
                </span>
                <span className="text-indigo-400 font-extrabold text-sm">
                  {totalSteps > 0 ? `${progressPercent}%` : 'Connecting...'}
                </span>
              </div>
              
              <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden relative">
                {totalSteps > 0 ? (
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500 relative"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                ) : (
                  <div className="bg-indigo-600 h-full rounded-full animate-pulse w-1/3" />
                )}
              </div>
              
              {/* Stats and query badge */}
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-550 pt-1">
                <span>Radius: {radius} miles</span>
                <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-350">
                  Strictness: {profile.matchStrictness || 'exact'}
                </span>
              </div>
            </div>

            {/* Stepper + Logs Layout Grid */}
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
              {/* Stepper (Left 2 columns) */}
              <div className="md:col-span-2 flex flex-col min-h-0 bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 space-y-4">
                <h4 className="text-[10px] font-black uppercase text-zinc-450 tracking-widest flex items-center gap-2 shrink-0">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  Scanned Target Roles
                </h4>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {totalSteps > 0 ? (
                    scanningTitles.map((scan, i) => {
                      const isActive = scan.status === 'scanning';
                      const isDone = scan.status === 'done';
                      const isFailed = scan.status === 'failed';
                      
                      return (
                        <div 
                          key={i} 
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            isActive 
                              ? 'bg-indigo-500/10 border-indigo-500/30' 
                              : isDone 
                              ? 'bg-zinc-800/30 border-zinc-800/80 opacity-70' 
                              : 'bg-zinc-900 border-zinc-850 opacity-50'
                          }`}
                        >
                          <div className="shrink-0">
                            {isActive ? (
                              <div className="w-5 h-5 rounded-full bg-indigo-600/20 flex items-center justify-center relative">
                                <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                                <div className="absolute inset-0 border border-indigo-500 rounded-full animate-ping" />
                              </div>
                            ) : isDone ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            ) : isFailed ? (
                              <div className="w-5 h-5 rounded-full bg-rose-500/25 text-rose-400 flex items-center justify-center text-xs font-bold font-mono">
                                !
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-zinc-750 bg-zinc-850 text-zinc-550 flex items-center justify-center text-xs font-bold">
                                •
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-grow">
                            <p className="font-bold text-xs text-white truncate">{scan.title}</p>
                            <p className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                              {isActive ? 'Crawling sources...' : isDone ? 'Scanned successfully' : isFailed ? 'Quota limited' : 'Pending queue'}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center text-center p-4">
                      <p className="text-xs text-zinc-500 italic">Syncing targeted search sequences...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Logs Console (Right 3 columns) */}
              <div className="md:col-span-3 flex flex-col min-h-0 bg-black/40 border border-zinc-800 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2 shrink-0">
                  <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    Agent Telemetry Logs
                  </h4>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(searchLogs.join("\n"));
                      alert("Logs copied to clipboard.");
                    }}
                    className="text-[9px] font-bold text-zinc-405 hover:text-white uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-2.5 h-2.5" /> Copy
                  </button>
                </div>

                <div className="flex-grow overflow-y-auto font-mono text-[10px] text-zinc-300 leading-relaxed pr-2 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800 select-text">
                  {searchLogs.length > 0 ? (
                    searchLogs.map((log, i) => (
                      <div key={i} className="whitespace-pre-wrap truncate-none break-words">
                        <span className="text-zinc-500 select-none mr-1.5">›</span>
                        {log.includes("⚠️") || log.includes("Error") || log.includes("Failed") ? (
                          <span className="text-rose-400">{log}</span>
                        ) : log.includes("widening") || log.includes("radius") ? (
                          <span className="text-amber-400 font-semibold">{log}</span>
                        ) : log.includes("Found") || log.includes("Complete") ? (
                          <span className="text-emerald-400 font-bold">{log}</span>
                        ) : (
                          <span>{log}</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-550 italic font-sans text-xs">
                      Awaiting connection telemetry...
                    </div>
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-zinc-800 shrink-0">
              <span className="text-[10px] text-zinc-500 font-medium leading-relaxed max-w-sm text-center sm:text-left">
                The agent operates in the background on the server. You can safely hide this modal or close the tab without cancelling the discovery engine.
              </span>
              
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 font-bold">
                <button
                  onClick={() => setIsProgressModalMinimized(true)}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  Run in Background
                </button>
                
                <button
                  onClick={async () => {
                    setIsSearching(false);
                    await setAgentStatus({ isSearching: false, status: "Search aborted by user." });
                    setStatus("Search cancelled.");
                    setTimeout(() => setStatus(""), 3000);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-500/10 text-rose-450 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Abort Search
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Minimized Dock Bubble */}
      {mounted && isSearching && isProgressModalMinimized && createPortal(
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-300">
          <button 
            onClick={() => setIsProgressModalMinimized(false)}
            className="flex items-center gap-3 p-4 bg-slate-900/90 dark:bg-zinc-950/90 hover:bg-slate-800/90 dark:hover:bg-zinc-900/90 border border-indigo-500/30 text-white rounded-2xl shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-105 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 border-2 border-zinc-800 rounded-full" />
              <div 
                className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"
                style={{ animationDuration: '1.5s' }}
              />
              <span className="text-[10px] font-bold text-indigo-400">
                {totalSteps > 0 ? `${progressPercent}%` : '...'}
              </span>
            </div>

            <div className="text-left max-w-xs min-w-[120px]">
              <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">Discovery Engine</p>
              <p className="text-xs font-bold truncate text-zinc-100 max-w-[160px]">
                {status.split(" (Found")[0] || "Searching..."}
              </p>
            </div>

            <div className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 font-bold">
              <Sparkles className="w-3 h-3 animate-pulse" />
              {results.filter(j => newJobIds.has(j.id)).length} New
            </div>
          </button>
        </div>,
        document.body
      )}
    </PanelGroup>
  );
}

