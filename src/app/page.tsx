"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { 
  ArrowUpRight, 
  Target, 
  Send, 
  MessageSquare, 
  Sparkles,
  MapPin,
  Clock,
  ChevronRight,
  Settings,
  Search,
  ExternalLink,
  RefreshCw
} from "lucide-react";


import { fetchUserProfile, patchUserProfile, fetchJobs, updateJobStatus, runJobSearch, addJobs } from "@/app/actions/jobActions";

import { generateApplicationStrategy } from "@/app/actions/careerTools";
import { UserProfile } from "@/lib/db";
import Link from "next/link";
import { useProfile } from "@/components/ProfileContext";


export default function Dashboard() {
  const { activeProfileId } = useProfile();
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [radius, setRadius] = useState<number>(25);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [topJobs, setTopJobs] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");



  useEffect(() => {
    async function load() {
      setIsLoadingJobs(true);
      const p = await fetchUserProfile();
      if (p) setProfile(p);
      
      const allJobs = await fetchJobs();
      setJobs(allJobs);
      // Get top 3 new jobs with score > 70 or just highest scores
      const filtered = allJobs
        .filter((j: any) => j.status === 'Discovery')
        .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
        .slice(0, 3);
      setTopJobs(filtered);
      setIsLoadingJobs(false);

    }
    load();
  }, [activeProfileId]);

  const handleActionJob = async (jobId: string, status: string) => {
    await updateJobStatus(jobId, status as any);
    // Refresh top jobs
    refreshTopJobs();
  };

  const refreshTopJobs = async () => {
    const allJobs = await fetchJobs();
    setJobs(allJobs);
    const filtered = allJobs
      .filter((j: any) => j.status === 'Discovery')
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
      .slice(0, 3);
    setTopJobs(filtered);
  };


  const handleTriggerSearch = async () => {
    // Validate target titles and locations (filter out placeholder values)
    const validTitles = (profile.targetTitles || []).filter(t => t && !t.includes("[") && !t.includes("]") && t.trim() !== "");
    const validLocations = (profile.targetLocations || []).filter(l => l && !l.includes("[") && !l.includes("]") && !l.toLowerCase().includes("city, state") && !l.toLowerCase().includes("placeholder") && l.trim() !== "");

    if (validTitles.length === 0 || validLocations.length === 0) {
      setSearchStatus("Search failed: No valid target titles or locations configured. Please update your profile.");
      return;
    }

    setIsSearching(true);
    setSearchStatus("Initializing Daily Scan...");
    
    try {
      const newJobs = await runJobSearch(
        validTitles,
        validLocations,
        radius,
        profile.resumeText || ""
      );
      await addJobs(newJobs);
      await refreshTopJobs();
      setSearchStatus(`Found ${newJobs.length} new matches.`);
      setTimeout(() => setSearchStatus(""), 5000);
    } catch (e: any) {
      console.error(e);
      setSearchStatus(`Search failed: ${e?.message || "Verify your connection or scraping API keys."}`);
    } finally {
      setIsSearching(false);
    }
  };



  const removeArrayItem = async (field: 'targetTitles' | 'targetLocations', index: number) => {
    const arr = [...(profile[field] || [])];
    arr.splice(index, 1);
    setProfile(prev => ({ ...prev, [field]: arr }));
    await patchUserProfile({ [field]: arr }, activeProfileId);
  };

  const addArrayItem = async (field: 'targetTitles' | 'targetLocations', value: string) => {
    if (!value.trim()) return;
    const arr = [...(profile[field] || []), value.trim()];
    setProfile(prev => ({ ...prev, [field]: arr }));
    await patchUserProfile({ [field]: arr }, activeProfileId);
  };

  const handleGetStrategy = async () => {
    if (!(profile as any).geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      return;
    }
    setIsGeneratingStrategy(true);
    setShowStrategyModal(true);
    try {
      const result = await generateApplicationStrategy();
      setStrategy(result);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to generate weekly strategy.");
      setShowStrategyModal(false);
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold font-outfit text-foreground">Welcome back, {profile.fullName?.split(' ')[0] || 'Operator'}</h2>
          <p className="text-text-muted mt-1">Your discovery engine is monitoring 4 platforms for {profile.targetTitles?.[0] || 'your target'} roles.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-3">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-foreground text-background flex items-center justify-center text-[10px] font-bold">
                  {i === 1 ? "LN" : i === 2 ? "IN" : "RD"}
                </div>
              ))}
            </div>
            <button 
              onClick={handleTriggerSearch}
              disabled={isSearching}
              className="btn-primary disabled:opacity-50"
            >
              {isSearching ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isSearching ? "Searching..." : "Daily Scan"}
            </button>
          </div>
          {searchStatus && (
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest animate-pulse">{searchStatus}</p>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Jobs Found", value: jobs.length.toString(), icon: Target, color: "text-foreground", bg: "bg-foreground/5" },
          { label: "High Matches", value: jobs.filter(j => j.score >= 85).length.toString(), icon: Sparkles, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Applied", value: jobs.filter(j => j.status === 'Applied').length.toString(), icon: Send, color: "text-foreground", bg: "bg-foreground/5" },
          { label: "Interviews", value: jobs.filter(j => ['Recruiter Screen', 'Technical Round', 'Portfolio Presentation', '2nd Interview', 'Final Round'].includes(j.status)).length.toString(), icon: MessageSquare, color: "text-foreground", bg: "bg-foreground/5" },
        ].map((stat, i) => (
          <div key={i} className="glass-card flex flex-col gap-1 border border-card-border">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-2`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-text-muted text-sm font-medium">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{stat.value}</span>
              <span className="text-[10px] text-emerald-500 font-bold flex items-center">
                <ArrowUpRight className="w-3 h-3" /> +4%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Matches */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold font-outfit text-foreground">Top Matches Recommended</h3>
            <Link href="/tracker" className="text-sm text-foreground/80 hover:text-foreground hover:underline font-semibold transition-colors">View all matches</Link>
          </div>
          
          <div className="space-y-4">
            {isLoadingJobs ? (
              <div className="py-12 text-center text-text-muted">Loading your matches...</div>
            ) : topJobs.length === 0 ? (
              <div className="glass-card py-12 text-center space-y-4 border-dashed border-card-border">
                <Target className="w-10 h-10 text-text-muted/65 mx-auto" />
                <p className="text-text-muted font-medium">No high-match roles in discovery yet.</p>
                <Link href="/search" className="btn-secondary py-2 px-4 text-xs inline-block">Trigger Search →</Link>
              </div>
            ) : topJobs.map((job, i) => (
              <div key={i} className="glass-card group hover:border-foreground/20 transition-all border-card-border relative overflow-hidden">
                {/* Score Background Glow */}
                <div className={`absolute -right-12 -top-12 w-32 h-32 blur-3xl opacity-10 rounded-full ${job.score >= 85 ? 'bg-emerald-500' : 'bg-amber-500'}`} />

                <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-foreground/5 flex items-center justify-center font-black text-2xl text-foreground/75 border border-card-border group-hover:border-foreground/30 transition-colors">
                    {job.company[0]}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-lg text-foreground truncate group-hover:opacity-85 transition-opacity leading-tight">{job.title}</h4>
                        <p className="text-text-muted font-bold text-xs uppercase tracking-widest mt-0.5">{job.company}</p>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="flex flex-col items-end">
                            <span className={`text-2xl font-black ${job.score >= 85 ? 'text-emerald-500' : 'text-amber-500'}`}>{job.score}%</span>
                            <span className="text-[9px] text-text-muted uppercase font-black tracking-widest">Match</span>
                         </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-muted font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-text-muted/70" />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-text-muted/70" />
                        {job.time || 'Today'}
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <button 
                          onClick={() => handleActionJob(job.id, 'Triage')}
                          className="px-6 py-1.5 bg-foreground text-background hover:opacity-90 rounded-lg transition-all font-bold text-[10px] tracking-widest cursor-pointer"
                        >
                          APPLY NOW
                        </button>

                        <a 
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-card text-text-muted hover:text-foreground hover:bg-foreground/5 transition-all border border-card-border"
                          title="View Original Posting"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status Tracker & Quick Links */}
        <div className="space-y-6">
          <div className="glass-card bg-foreground/5 border-card-border">
            <h3 className="font-bold text-lg mb-2 text-foreground">Agent Status: Active</h3>
            <p className="text-sm text-text-muted mb-4 leading-relaxed">
              Automated scans are active. Head to the <span className="text-foreground font-semibold">Job Search</span> page to configure your settings and trigger live searches.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Next scheduled scan</span>
                <span className="font-medium text-foreground">18:00 Today</span>
              </div>
              <div className="h-1.5 w-full bg-foreground/10 rounded-full overflow-hidden">
                <div className="h-full bg-foreground w-[65%] rounded-full" />
              </div>
            </div>
          </div>

          <div className="glass-card space-y-4">
            <h3 className="font-bold text-foreground">Quick Ingest</h3>
            <div className="p-4 rounded-xl border border-dashed border-card-border hover:border-foreground/30 hover:bg-foreground/5 transition-all cursor-pointer group text-center">
              <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                <ArrowUpRight className="w-5 h-5 text-foreground rotate-45" />
              </div>
              <p className="text-sm font-semibold text-foreground">Update ATS Resume</p>
              <p className="text-[10px] text-text-muted mt-1">PDF, DOCX or TXT</p>
            </div>
          </div>

          {/* Application Strategy */}
          <div className="glass-card bg-emerald-500/5 border-emerald-500/10 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-foreground">Application Strategy</h3>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Get a personalized weekly application plan — how many to apply, how to tier roles, when to follow up, and which platforms suit your background.
            </p>
            <button
              onClick={handleGetStrategy}
              disabled={isGeneratingStrategy}
              className="w-full py-2 text-xs font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingStrategy ? "Generating..." : "✦ Get My Strategy"}
            </button>
          </div>
        </div>
      </div>

      {/* Strategy Modal */}
      {showStrategyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl max-h-[80vh] flex flex-col gap-4 bg-card border-card-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-lg text-foreground">Your Application Strategy</h3>
              </div>
              <button onClick={() => setShowStrategyModal(false)} className="text-text-muted hover:text-foreground cursor-pointer text-lg">&times;</button>
            </div>
            {isGeneratingStrategy ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-foreground/10 border-t-foreground rounded-full animate-spin" />
              </div>
            ) : (
              <textarea
                className="flex-1 bg-background text-foreground rounded-xl p-4 text-sm resize-none min-h-[400px] border border-card-border focus:ring-0 leading-relaxed outline-none"
                value={strategy || ""}
                readOnly
              />
            )}
            <div className="flex justify-end">
              <button
                onClick={() => strategy && navigator.clipboard.writeText(strategy)}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Copy Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
