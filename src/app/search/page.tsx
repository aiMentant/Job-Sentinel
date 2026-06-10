"use client";

import React, { useState, useEffect } from "react";

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
  ExternalLink
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
import { generateDreamCompanies } from "@/app/actions/careerTools";
import { Job, UserProfile } from "@/lib/db";
import Link from "next/link";
import { useProfile } from "@/components/ProfileContext";



export default function SearchPage() {
  const { activeProfileId } = useProfile();
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Job[]>([]);
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [radius, setRadius] = useState<number>(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewingJob, setReviewingJob] = useState<Job | null>(null);
  const [showHighScoresOnly, setShowHighScoresOnly] = useState(false);
  const [searchMode, setSearchMode] = useState<'standard' | 'deep'>('standard');
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [dreamCompanies, setDreamCompanies] = useState<any[]>([]);
  const [isGeneratingDreamList, setIsGeneratingDreamList] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'ghost' | 'companies'>('live');



  useEffect(() => {
    async function load() {
      const p = await fetchUserProfile();
      if (p) {
        setProfile({
          ...p,
          targetTitles: p.targetTitles || [],
          targetLocations: p.targetLocations || []
        });
        if (p.searchRadius) setRadius(p.searchRadius);
      }

      // Check for background search
      const agent = await getAgentStatus();
      if (agent.isSearching) {
        setIsSearching(true);
        setStatus(agent.status);
      }

      // Load existing "new" jobs from the database so they persist on navigation
      const { fetchJobs } = await import("@/app/actions/jobActions");
      const allJobs = await fetchJobs();
      setResults(allJobs.filter((j: any) => j.status === 'Discovery'));
    }
    load();

    // Poll for status if searching
    const interval = setInterval(async () => {
      const agent = await getAgentStatus();
      if (agent.isSearching) {
        setIsSearching(true);
        setStatus(agent.status);
      } else if (isSearching) {
        // Just finished
        setIsSearching(false);
        // Refresh the list to show all 'new' jobs including the latest matches
        const allJobs = await fetchJobs();
        setResults(allJobs.filter((j: any) => j.status === 'Discovery'));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isSearching, activeProfileId]);

  useEffect(() => {
    // Only patch radius — never save partial profile state
    if (radius && profile.searchRadius !== radius) {
      patchUserProfile({ searchRadius: radius });
    }
  }, [radius]); // deliberately NOT including profile in deps

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredResults = results
    .filter(j => {
      const isGhostFlagged = (j.reason || "").toLowerCase().includes("flag") || (j.reason || "").toLowerCase().includes("ghost") || (j.reason || "").toLowerCase().includes("talent pool");
      const isRejected = j.status === 'Rejected' && isGhostFlagged;
      
      if (activeTab === 'live') return !isRejected && (!showHighScoresOnly || j.score >= 80);
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
    await toggleJobFavourite(id);
  };

  const handleAnalyze = async (jobId: string) => {
    // Show loading state in the result card
    setResults(prev => prev.map(j => j.id === jobId ? { ...j, reason: "AI is analyzing..." } : j));
    
    try {
      const result = await analyzeSingleJob(jobId);
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

  const handleBulkDelete = async () => {
    await bulkDeleteJobs(selectedIds);
    setResults(prev => prev.filter(j => !selectedIds.includes(j.id)));
    setSelectedIds([]);
    setShowDismissModal(false);
  };


  const handleBulkMove = async () => {
    // In our new workflow, "Move to Pipeline" means Starring the jobs
    setResults(prev => prev.map(j => selectedIds.includes(j.id) ? { ...j, isFavourite: true } : j));
    // We'd need a bulk favourite action in jobActions, or just loop it
    const { toggleJobFavourite } = await import("@/app/actions/jobActions");
    for (const id of selectedIds) {
      await toggleJobFavourite(id);
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

  const removeArrayItem = async (field: 'targetTitles' | 'targetLocations', index: number) => {
    const arr = [...(profile[field] || [])];
    arr.splice(index, 1);
    setProfile(prev => ({ ...prev, [field]: arr }));
    await patchUserProfile({ [field]: arr });
  };

  const addArrayItem = async (field: 'targetTitles' | 'targetLocations', value: string) => {
    if (!value.trim()) return;
    const cleanValue = value.trim();
    if (profile[field]?.includes(cleanValue)) return; // Prevent duplicates
    
    const arr = [...(profile[field] || []), cleanValue];
    setProfile(prev => ({ ...prev, [field]: arr }));
    await patchUserProfile({ [field]: arr });
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
      const uniqueTitles = Array.from(new Set([...(profile.targetTitles || []), ...(data.targetTitles || [])]));
      const uniqueLocations = Array.from(new Set([...(profile.targetLocations || []), ...(data.targetLocations || [])]));

      const newProfile = { 
        ...profile, 
        targetTitles: uniqueTitles,
        targetLocations: uniqueLocations
      };
      setProfile(newProfile);
      await patchUserProfile({ 
        targetTitles: uniqueTitles,
        targetLocations: uniqueLocations 
      });
      setStatus("Search parameters updated from AI.");
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
        setProfile({
          ...p,
          targetTitles: p.targetTitles || [],
          targetLocations: p.targetLocations || []
        });
        if (p.searchRadius) setRadius(p.searchRadius);
        setStatus("Identity Synced: Parameters loaded from master profile.");
        setTimeout(() => setStatus(""), 3000);
      }
    } catch (e) {
      setStatus("Sync Failed: Check profile database.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setStatus("Launching stealth browser...");
    
    try {
      let newJobs: Job[] = [];
      
      if (searchMode === 'deep') {
        setStatus("Precision Mode: Scanning ATS Platforms...");
        // Use top 3 titles for deep search to avoid noise
        const precisionTitles = (profile.targetTitles || []).slice(0, 3);
        newJobs = await runWebDiscovery(precisionTitles, profile.targetLocations || ["UK"], radius);

      } else {
        newJobs = await runJobSearch(
          profile.targetTitles || [], 
          profile.targetLocations || [], 
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
    const list = await generateDreamCompanies(profile.targetLocations || ["UK"], radius);
    setDreamCompanies(list);
    setIsGeneratingDreamList(false);
    setActiveTab('companies');
    setStatus("");
  };


  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold font-outfit">Discovery Engine</h2>
          <p className="text-slate-400 mt-1">Configure your multi-platform scraper. Star jobs to send them to your Pipeline.</p>
        </div>

        {/* Global Platform Toggle */}
        <div className="flex flex-col items-end gap-2">
          <div className="p-1 bg-white/5 rounded-xl border border-white/5 flex gap-1 w-64 shadow-2xl">
            <button 
              onClick={() => setSearchMode('standard')}
              className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all ${searchMode === 'standard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Standard
            </button>
            <button 
              onClick={() => setSearchMode('deep')}
              className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all ${searchMode === 'deep' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Deep Web
            </button>
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mr-2">
            {searchMode === 'standard' ? 'Aggregators: LinkedIn, Indeed, Reed' : 'Precision: Lever, Greenhouse, Workable'}
          </p>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Search Config */}
        <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Discovery Strategy</h3>
              <div className="flex gap-2">
                <button 
                  onClick={handleReload}
                  disabled={isRegenerating}
                  className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all group"
                  title="Sync with Identity"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                </button>
              </div>
            </div>


            
            {/* Target Titles */}
            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Target Roles</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.targetTitles?.map((title, i) => (
                  <span key={i} className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-[11px] text-indigo-300 flex items-center gap-1.5">
                    {title}
                    <button onClick={() => removeArrayItem('targetTitles', i)} className="hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Add role & press Enter..." 
                className="input-field text-xs py-1.5 w-full"
                onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('targetTitles', e.currentTarget.value); e.currentTarget.value = ''; } }}
              />
            </div>

            {/* Target Locations */}
            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Locations / Postcodes</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.targetLocations?.map((loc, i) => (
                  <span key={i} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[11px] text-emerald-300 flex items-center gap-1.5">
                    {loc}
                    <button onClick={() => removeArrayItem('targetLocations', i)} className="hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Add location & press Enter..." 
                className="input-field text-xs py-1.5 w-full"
                onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('targetLocations', e.currentTarget.value); e.currentTarget.value = ''; } }}
              />
            </div>

            {/* Radius Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Search Radius</label>
                <span className="text-xs font-bold text-white">{radius} miles</span>
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
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-medium">
                <span>5m</span>
                <span>50m</span>
                <span>100m</span>
                <span>200m</span>
              </div>
            </div>

            {/* AI Suggestion Button */}
            <button 
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500/20 transition-all mb-2"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? "Analyzing Resume..." : "Suggest Smart Targets"}
            </button>


            <button 
              onClick={handleSearch}
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
                 <div className="flex items-center gap-2 text-emerald-400 font-bold text-[10px] uppercase tracking-widest">
                    <Wand2 className="w-3 h-3" />
                    Precision Mode Active
                 </div>
                 <p className="text-[10px] text-slate-500 leading-relaxed">
                   Deep Web discovery is now optimized for your <b>top 3 roles</b>. This minimizes noise and focuses exclusively on high-value ATS boards.
                 </p>
              </div>
            )}

            
            {status && (
              <p className="text-[10px] text-center text-slate-500 animate-pulse">{status}</p>
            )}
          </div>


        {/* Search Results */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5">
            <div className="flex gap-8">
              <button 
                onClick={() => setActiveTab('live')}
                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'live' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Live Opportunities
                {activeTab === 'live' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400 animate-in fade-in duration-300" />}
              </button>
              <button 
                onClick={() => setActiveTab('ghost')}
                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'ghost' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Rejected / Flagged
                {activeTab === 'ghost' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 animate-in fade-in duration-300" />}
              </button>
              <button 
                onClick={() => setActiveTab('companies')}
                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'companies' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Dream Companies
                {activeTab === 'companies' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400 animate-in fade-in duration-300" />}
              </button>

            </div>
            
            <div className="flex items-center gap-4 pb-4">
              <button 
                onClick={selectAll}
                className="btn-secondary py-1 px-3 text-[10px] font-bold uppercase tracking-wider"
              >
                {selectedIds.length === filteredResults.length ? "Deselect All" : "Select All"}
              </button>
              <button 
                onClick={() => setShowHighScoresOnly(!showHighScoresOnly)}
                className={`btn-secondary py-1 px-3 text-[10px] font-bold uppercase tracking-wider ${showHighScoresOnly ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' : ''}`}
              >
                <Filter className="w-3 h-3" />
                {showHighScoresOnly ? "80%+" : "Filter"}
              </button>
            </div>
          </div>

          {activeTab === 'companies' ? (
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">Target Company Discovery</h3>
                    <p className="text-xs text-slate-500">AI-researched firms that hire for your specific background within {radius} miles.</p>
                  </div>
                  <button 
                    onClick={handleGenerateDreamList}
                    disabled={isGeneratingDreamList}
                    className="btn-primary py-2 px-4 text-xs"
                  >
                    {isGeneratingDreamList ? "Agent Researching..." : "✦ Refresh Dream List"}
                  </button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dreamCompanies.length === 0 ? (
                    <div className="md:col-span-2 glass-card py-20 text-center space-y-4 border-dashed border-white/10">
                       <Building2 className="w-12 h-12 text-slate-700 mx-auto" />
                       <p className="text-slate-500 font-medium italic">No research data yet. Trigger the AI to find companies.</p>
                    </div>
                  ) : dreamCompanies.map((company, i) => (
                    <div key={i} className="glass-card hover:border-indigo-500/30 transition-all group">
                       <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">{company.name}</h4>
                          <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded text-slate-400">{company.industry}</span>
                       </div>
                       <p className="text-xs text-slate-400 leading-relaxed mb-4 italic">"{company.reasoning}"</p>
                       <div className="flex gap-2">
                          <button className="flex-1 py-2 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-lg transition-all text-[10px] font-black uppercase tracking-widest">Watch Company</button>
                          {company.careerUrl && (
                            <a href={company.careerUrl} target="_blank" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white border border-white/10">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div className="glass-card py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-slate-600" />
              </div>
              <div>
                <p className="font-bold">No active search running</p>
                <p className="text-sm text-slate-500">Trigger the agent to scan platforms for matches.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredResults.map((job) => (
                <div key={job.id} className={`glass-card flex items-center gap-6 group hover:border-indigo-500/30 transition-all ${selectedIds.includes(job.id) ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}>
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(job.id)}
                      onChange={() => toggleSelection(job.id)}
                      className="w-5 h-5 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 transition-all cursor-pointer"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{job.source}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getPostingAge(job.postedAt, job.createdAt)}
                      </span>
                      {(job.ghostScore ?? 0) > 60 && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Ghost {job.ghostScore}%
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-lg">{job.title}</h4>
                    <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                      <span className="font-medium text-slate-300">{job.company}</span>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {job.location}
                      </div>
                      {job.salaryRange && (
                        <span className="text-emerald-400 text-xs font-bold">{job.salaryRange}</span>
                      )}
                    </div>
                    
                    {/* AI Insights / Status Message */}
                    {job.reason && (
                      <div className="mt-3 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-slate-300 leading-relaxed italic">{job.reason}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="w-px h-12 bg-white/5" />
                  
                  <div className="text-center min-w-[80px]">
                    {job.score > 0 ? (
                      <>
                        <div className={`text-2xl font-bold ${job.score > 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                          {job.score}%
                        </div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">AI Match</p>
                      </>
                    ) : (
                      <div className="py-2">
                        <span className="px-2 py-1 rounded bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {job.score === 0 && (
                      <button
                        onClick={() => handleAnalyze(job.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 text-xs font-bold transition-all border border-indigo-600/20"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Analyze Match
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleFavourite(job.id)}
                      className={`p-2 rounded-lg transition-all ${job.isFavourite ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-600 hover:text-yellow-400'}`}
                      title={job.isFavourite ? "Remove from Favourites" : "Add to Favourites"}
                    >
                      <Star className={`w-4 h-4 ${job.isFavourite ? 'fill-current' : ''}`} />
                    </button>
                    <button 
                      onClick={() => toggleSelection(job.id)}
                      className={`p-2 rounded-lg transition-all ${selectedIds.includes(job.id) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setReviewingJob(job)}
                      className="btn-primary py-2 px-4 text-xs"
                    >
                      Quick Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 glass-card !bg-slate-900/90 border-white/10 shadow-2xl flex items-center gap-8 py-3 px-6 animate-in slide-in-from-bottom-8 duration-300 z-40 border">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
              {selectedIds.length}
            </span>
            <span className="font-bold text-xs uppercase tracking-widest text-slate-300">Selected</span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex gap-2">
            <button 
              onClick={handleBulkMove}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
            >
              Move to Pipeline
            </button>
            <button 
              onClick={() => setShowDismissModal(true)}
              className="px-4 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-colors"
            >
              Dismiss Results
            </button>

            <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white">
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
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{reviewingJob.source}</span>
                <h2 className="text-2xl font-bold font-outfit mt-1">{reviewingJob.title}</h2>
                <p className="text-slate-400">{reviewingJob.company} &bull; {reviewingJob.location}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-emerald-400">{reviewingJob.score}%</div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">AI Match</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <h4 className="text-xs font-bold uppercase text-emerald-400 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Reasoning
                </h4>
                <p className="text-slate-300 text-sm leading-relaxed">
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
                <button 
                  onClick={() => handleExpressApply(reviewingJob)}
                  className="flex-1 btn-primary justify-center py-3"
                >
                  Express Apply Now
                </button>

              </div>
            </div>

            <button 
              onClick={() => setReviewingJob(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
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
            <div className="flex items-center gap-4 text-red-400">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-xl">Dismiss {selectedIds.length} Results?</h3>
                <p className="text-xs text-slate-500">These roles will be removed from your discovery feed.</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setShowDismissModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-sm transition-all">Cancel</button>
              <button onClick={handleBulkDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-red-600/20">Confirm Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

