"use client";

import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Target, 
  Users, 
  Trophy,
  Search,
  MapPin,
  Sparkles,
  MoreVertical,
  ExternalLink,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Mail,
  Send,
  RefreshCw,
  Play,
  Download,
  CheckCircle,
  Share2,
} from "lucide-react";
import { fetchJobs, updateJobStatus, deleteJob, generateCoverLetter, updateJob, saveApplicationDraft, markApplicationReady, fetchFullJobDescription } from "@/app/actions/jobActions";

import { resolveApproval } from "@/app/actions/agentStatus";

import { personalizeCoverLetter, generateRecruiterMessage, matchToJobDescription, optimizeApplicationPackage } from "@/app/actions/careerTools";
import { Job } from "@/lib/db";
import { useProfile } from "@/components/ProfileContext";

const statuses = [
  { id: 'new', label: 'Discovery Inbox', color: 'bg-blue-500' },
  { id: 'triage', label: 'Triage (Match Scan)', color: 'bg-yellow-500' },
  { id: 'drafting', label: 'Drafting (Approved)', color: 'bg-amber-500' },
  { id: 'ready', label: 'Ready for Bot', color: 'bg-indigo-500' },
  { id: 'applied', label: 'Submitted', color: 'bg-emerald-500' },
  { id: 'interviewing', label: 'Interviews', color: 'bg-purple-500' },
  { id: 'rejected', label: 'Closed', color: 'bg-slate-600' },
] as const;

export default function TrackerPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [tailoringJob, setTailoringJob] = useState<Job | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [jdInput, setJdInput] = useState(""); // for cover letter personalization
  const [recruiterModal, setRecruiterModal] = useState<{ job: Job; messages: { linkedin: string; email: string } | null } | null>(null);
  const [isGeneratingRecruiter, setIsGeneratingRecruiter] = useState(false);
  const [jdMatchModal, setJdMatchModal] = useState<{ job: Job; result: any } | null>(null);
  const [jdMatchInput, setJdMatchInput] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  // New Unified Optimizer state
  const [optimizeModal, setOptimizeModal] = useState<{ 
    job: Job; 
    jd: string; 
    result: any | null; 
    isGenerating: boolean 
  } | null>(null);
  const [agent, setAgent] = useState({ isSubmitting: false, status: "Idle", lastUpdated: "", resultsFound: 0, progress: 0, currentJobTitle: "" });
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const { activeProfileId } = useProfile();
  const [contextMenu, setContextMenu] = useState<{ job: Job; top: number; right: number } | null>(null);

  useEffect(() => {
    loadJobs();
  }, [activeProfileId]);
  
  useEffect(() => {
    async function poll() {
      const { fetchJobs, fetchUserProfile } = await import("@/app/actions/jobActions");
      const { getAgentStatus } = await import("@/app/actions/agentStatus");
      const [j, p, s] = await Promise.all([fetchJobs(), fetchUserProfile(), getAgentStatus()]);
      if (j) setJobs(j);
      if (p) setProfile(p);
      if (s) setAgent(s as any);
    }
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [activeProfileId]);

  async function loadJobs() {
    setLoading(true);
    const data = await fetchJobs();
    setJobs(data);
    setLoading(false);
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (confirm(`Delete ${selectedIds.length} jobs?`)) {
      const { bulkDeleteJobs } = await import("@/app/actions/jobActions");
      await bulkDeleteJobs(selectedIds);
      setSelectedIds([]);
      loadJobs();
    }
  };

  const handleUpdateStatus = async (id: string, status: any) => {
    await updateJobStatus(id, status as any);
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j));
    setActiveMenu(null);
  };

  const [isBulkOptimizing, setIsBulkOptimizing] = useState(false);

  const handleBulkOptimize = async () => {
    if (!profile || !profile.geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      return;
    }
    const draftingJobs = jobs.filter(j => (j.status as any) === 'drafting');
    if (draftingJobs.length === 0) return;
    
    if (confirm(`Run AI Auto-Tailor for ${draftingJobs.length} jobs? This will rewrite resumes and cover letters for each.`)) {
      setIsBulkOptimizing(true);
      setAgent(prev => ({ ...prev, isSubmitting: true, status: "AI is tailoring applications...", progress: 0 }));
      
      const { optimizeApplicationPackage } = await import("@/app/actions/careerTools");
      const { updateJob } = await import("@/app/actions/jobActions");

      for (let i = 0; i < draftingJobs.length; i++) {
        const job = draftingJobs[i];
        setAgent(prev => ({ ...prev, status: `Tailoring ${job.company}...`, progress: Math.round(((i+1)/draftingJobs.length)*100) }));
        
        try {
          const result = await optimizeApplicationPackage(job.description || "", job.title, job.company);
          await updateJob(job.id, {
            ...job,
            score: result.matchScore,
            coverLetterText: result.tailoredCoverLetter,
            tailoredResumeText: result.tailoredResumeText,
            recruiterHookLinkedin: result.linkedinHook,
            recruiterHookEmail: result.emailHook,
            applicationNotes: result.applicationStrategy,
            applicationStatus: { 
              ...job.applicationStatus, 
              stage: 'ready', 
              lastUpdated: new Date().toISOString() 
            }
          });
          // Also move status to ready automatically if successful
          await updateJobStatus(job.id, 'ready' as any);
        } catch (e) {
          console.error(`Failed to optimize ${job.company}:`, e);
        }
      }
      
      setIsBulkOptimizing(false);
      setAgent(prev => ({ ...prev, isSubmitting: false, status: "Finished AI Tailoring", progress: 100 }));
      loadJobs(); // Refresh the board
    }
  };

  const handleBulkMatch = async () => {
    if (!profile || !profile.geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      return;
    }
    const triageJobs = jobs.filter(j => (j.status as any) === 'triage');
    if (triageJobs.length === 0) return;
    
    setAgent(prev => ({ ...prev, isSubmitting: true, status: "Scanning roles for match fit...", progress: 0 }));
    const { matchToJobDescription } = await import("@/app/actions/careerTools");
    const { updateJob } = await import("@/app/actions/jobActions");

    for (let i = 0; i < triageJobs.length; i++) {
      const job = triageJobs[i];
      setAgent(prev => ({ ...prev, status: `Analyzing ${job.company}...`, progress: Math.round(((i+1)/triageJobs.length)*100) }));
      
      try {
        let currentDescription = job.description || "";
        
        // If it's a placeholder, go get the real one first
        if (currentDescription.includes("Details fetched during search")) {
          const { fetchFullJobDescription } = await import("@/app/actions/jobActions");
          currentDescription = await fetchFullJobDescription(job.id, job.url);
        }

        const result = await matchToJobDescription(currentDescription);
        await updateJob(job.id, {
          ...job,
          description: currentDescription,
          score: result.matchScore,
          applicationNotes: `Missing Keywords: ${result.missingKeywords.join(', ')}`
        });
      } catch (e) {
        console.error(`Failed to scan ${job.company}:`, e);
      }
    }
    
    setAgent(prev => ({ ...prev, isSubmitting: false, status: "Finished Match Analysis", progress: 100 }));
    loadJobs();
  };

  const exportToCSV = () => {
    const headers = ["ID", "Title", "Company", "Location", "Score", "Status", "Source", "URL"];
    const rows = jobs.map(j => [
      j.id, 
      j.title.replace(/,/g, ''), 
      j.company.replace(/,/g, ''), 
      j.location.replace(/,/g, ''), 
      j.score, 
      j.status, 
      j.source, 
      j.url
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `job_sentinel_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const handleExecuteSubmissions = async () => {
    const readyJobs = jobs.filter(j => (j.status as any) === 'ready');
    if (readyJobs.length === 0) return;
    
    if (confirm(`Start automated submission for ${readyJobs.length} jobs?`)) {
      setAgent(prev => ({ ...prev, isSubmitting: true, status: "Initializing Engine...", progress: 5 }));
      const { runBulkSubmissions } = await import("@/app/actions/submissionAgent");
      // Fire and forget so the UI doesn't hang
      runBulkSubmissions(readyJobs).catch(console.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to remove this job?")) {
      await deleteJob(id);
      setJobs(prev => prev.filter(j => j.id !== id));
      setActiveMenu(null);
    }
  };

  const handleTailorCoverLetter = async (job: Job) => {
    setTailoringJob(job);
    setIsGenerating(true);
    setCoverLetter("");
    try {
      // Use personalizeCoverLetter if a JD is provided, else fall back to basic generation
      const letter = jdInput.trim()
        ? await personalizeCoverLetter(jdInput, job.title, job.company)
        : await generateCoverLetter(job.id);
      setCoverLetter(letter);
    } catch (e) {
      setCoverLetter("Failed to generate cover letter. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRecruiterMessage = async (job: Job) => {
    // If we already have hooks from the Auto-Tailor, use them instantly
    if (job.recruiterHookLinkedin && job.recruiterHookEmail) {
      setRecruiterModal({ job, messages: { linkedin: job.recruiterHookLinkedin, email: job.recruiterHookEmail } });
      return;
    }

    setRecruiterModal({ job, messages: null });
    setIsGeneratingRecruiter(true);
    const { generateRecruiterMessage } = await import("@/app/actions/careerTools");
    const result = await generateRecruiterMessage(job.title, job.company, job.description);
    setRecruiterModal({ job, messages: result });
    setIsGeneratingRecruiter(false);
  };

  const handleJdMatch = async () => {
    if (!jdMatchModal?.job || !jdMatchInput.trim()) return;
    setIsMatching(true);
    
    let jd = jdMatchInput.trim();
    
    // Check if input is a URL
    if (jd.startsWith('http')) {
      setAgent(prev => ({ ...prev, status: `Fetching autonomous JD from ${jd}...`, isSubmitting: true }));
      try {
        const { fetchFullJobDescription } = await import("@/app/actions/jobActions");
        jd = await fetchFullJobDescription(jdMatchModal.job.id, jd);
        setJdMatchInput(jd);
      } catch (e) {
        console.error("URL fetch failed:", e);
      } finally {
        setAgent(prev => ({ ...prev, isSubmitting: false, status: "Idle" }));
      }
    }

    const result = await matchToJobDescription(jd, undefined);
    setJdMatchModal({ job: jdMatchModal.job, result });
    setIsMatching(false);
  };


  const handleStartOptimize = async (job: Job) => {
    let jd = job.description || "";
    
    // If it's a placeholder, fetch it autonomously first
    if (jd.includes("Details fetched during search")) {
      setAgent(prev => ({ ...prev, status: `Fetching full details for ${job.company}...`, isSubmitting: true }));
      try {
        const { fetchFullJobDescription } = await import("@/app/actions/jobActions");
        const { updateJob } = await import("@/app/actions/jobActions");
        jd = await fetchFullJobDescription(job.id, job.url);
        // Save the real description to the DB for future use
        await updateJob(job.id, { description: jd });
      } catch (e) {
        console.error("Failed to fetch full description:", e);
      } finally {
        setAgent(prev => ({ ...prev, isSubmitting: false, status: "Idle" }));
      }
    }

    setOptimizeModal({ 
      job: { ...job, description: jd }, 
      jd, 
      result: job.tailoredResumeText ? {
        matchScore: job.score,
        missingKeywords: [], 
        tailoredResumeText: job.tailoredResumeText,
        tailoredCoverLetter: job.coverLetterText,
        applicationStrategy: job.applicationNotes || ""
      } : null, 
      isGenerating: false 
    });
  };

  const handleRunOptimization = async () => {
    if (!profile || !profile.geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      return;
    }
    if (!optimizeModal || !optimizeModal.jd.trim()) return;
    setOptimizeModal(prev => prev ? { ...prev, isGenerating: true } : null);
    try {
      const { optimizeApplicationPackage } = await import("@/app/actions/careerTools");
      const result = await optimizeApplicationPackage(
        optimizeModal.jd, 
        optimizeModal.job.title, 
        optimizeModal.job.company
      );
      setOptimizeModal(prev => prev ? { ...prev, result, isGenerating: false } : null);
    } catch (e) {
      alert("AI Optimization failed. Quota reached?");
      setOptimizeModal(prev => prev ? { ...prev, isGenerating: false } : null);
    }
  };

  const handleSaveReady = async () => {
    if (!optimizeModal || !optimizeModal.result) return;
    const { job, jd, result } = optimizeModal;
    
    await saveApplicationDraft(job.id, {
      tailoredResumeText: result.tailoredResumeText,
      coverLetterText: result.tailoredCoverLetter,
      applicationNotes: result.applicationStrategy
    });
    
    await markApplicationReady(job.id);
    setOptimizeModal(null);
    loadJobs();
  };

  const stats = [
    { label: "Total Applications", value: jobs.length.toString(), icon: Briefcase, color: "text-blue-400" },
    { label: "AI Matches (>80%)", value: jobs.filter(j => j.score >= 80).length.toString(), icon: Target, color: "text-emerald-400" },
    { label: "Interviews", value: jobs.filter(j => j.status === 'interviewing').length.toString(), icon: Users, color: "text-purple-400" },
    { label: "Offered", value: jobs.filter(j => j.status === 'offered').length.toString(), icon: Trophy, color: "text-yellow-400" },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold font-outfit text-white">Application Pipeline</h2>
          <p className="text-slate-400 mt-1">Tailor, approve, and execute automated submissions for your top matches.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportToCSV}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold border border-white/5 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            EXPORT CSV
          </button>
          <button className="btn-secondary py-2" onClick={handleBulkDelete} disabled={selectedIds.length === 0}>
            Delete ({selectedIds.length})
          </button>
          <button 
            onClick={handleExecuteSubmissions}
            disabled={jobs.filter(j => (j.status as any) === 'ready').length === 0}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            EXECUTE [{jobs.filter(j => (j.status as any) === 'ready').length}] SUBMISSIONS
          </button>
        </div>
      </div>

      {/* Submission Progress Banner */}
      {agent.isSubmitting && (
        <div className="glass-card !bg-indigo-600 border-indigo-400 shadow-xl shadow-indigo-500/20 py-4 px-6 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Automated Agent Active</p>
                <p className="text-sm font-bold text-white">Submitting to: {agent.currentJobTitle || "Company..."}</p>
              </div>
            </div>
            <span className="text-xl font-black text-white">{agent.progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-500 ease-out"
              style={{ width: `${agent.progress}%` }}
            />
          </div>
          <p className="text-[10px] text-indigo-100 mt-2 font-medium italic opacity-80">{agent.status}</p>
          
          {(agent as any).needsApproval && (
            <button 
              onClick={async () => {
                const { resolveApproval } = await import("@/app/actions/agentStatus");
                await resolveApproval();
              }}
              className="mt-3 w-full py-2 bg-white text-indigo-600 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 animate-bounce shadow-lg"
            >
              <CheckCircle className="w-4 h-4" />
              Resume Mission (Action Complete)
            </button>
          )}
        </div>

      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="glass-card relative overflow-hidden group py-4">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban Board - Horizontal Scrollable */}
      <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent snap-x snap-mandatory">

        {statuses.map(status => (
          <div key={status.id} className="w-[340px] flex-shrink-0 flex flex-col h-full bg-[#0d0d0f]/40 backdrop-blur-md rounded-[2rem] border border-white/5 pb-4 snap-start shadow-2xl">

            <div className="p-6 flex flex-col gap-4 sticky top-0 bg-[#0a0a0c]/80 backdrop-blur-xl z-10 rounded-t-[2rem] border-b border-white/5 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${status.color} shadow-lg shadow-${status.color.split('-')[1]}-500/50`} />
                  <h3 className="font-bold text-[11px] uppercase tracking-[0.2em] text-slate-400">{status.label.split(' (')[0]}</h3>
                  <span className="bg-white/5 text-slate-500 text-[10px] px-2.5 py-1 rounded-full font-black">
                    {jobs.filter(j => {
                      if (status.id === 'new') return j.status === 'new' && j.isFavourite;
                      return (j.status as any) === status.id;
                    }).length}
                  </span>
                </div>
              </div>
              
              {/* Contextual Action Button - Full Width for better UX */}
              {status.id === 'new' && jobs.filter(j => j.status === 'new' && j.isFavourite).length > 0 && (
                <button 
                  onClick={async () => {
                    const jobsToMove = jobs.filter(j => j.status === 'new' && j.isFavourite);
                    for (const j of jobsToMove) await updateJobStatus(j.id, 'triage' as any);
                    loadJobs();
                  }}
                  className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border border-indigo-600/20"
                >
                  Triage All
                </button>
              )}
              {status.id === 'triage' && jobs.filter(j => (j.status as any) === 'triage').length > 0 && (
                <button 
                  onClick={handleBulkMatch}
                  className="w-full py-2 bg-yellow-500/10 hover:bg-yellow-500 text-yellow-500 hover:text-black rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border border-yellow-500/20"
                >
                  Analyze All
                </button>
              )}
              {status.id === 'drafting' && jobs.filter(j => (j.status as any) === 'drafting').length > 0 && (
                <button 
                  onClick={handleBulkOptimize}
                  disabled={isBulkOptimizing}
                  className="w-full py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border border-amber-500/20 disabled:opacity-30"
                >
                  Tailor All
                </button>
              )}
            </div>

            
            <div className="flex-1 space-y-4 px-4 pr-2 scrollbar-hide max-h-[calc(100vh-420px)] overflow-y-auto overflow-x-visible">
              {jobs.filter(j => {
                if (status.id === 'new') return j.status === 'new' && j.isFavourite;
                return (j.status as any) === status.id;
              }).map((job) => (
                <div key={job.id} className="group glass-card p-5 hover:border-white/20 transition-all cursor-grab active:cursor-grabbing border-white/5 hover:bg-white/[0.03]">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-indigo-400/60 uppercase tracking-[0.2em]">{job.source}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-black ${job.score >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {job.score > 0 ? `${job.score}% MATCH` : 'PENDING'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setContextMenu(contextMenu?.job.id === job.id ? null : { 
                          job, 
                          top: rect.bottom + 6, 
                          right: window.innerWidth - rect.right 
                        });
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <h4 className="font-bold text-[13px] leading-tight mb-1 text-slate-100 group-hover:text-white transition-colors">{job.title}</h4>
                  <p className="text-[11px] text-slate-500 font-medium mb-4">{job.company}</p>


                  {/* Keyword Gaps (Visible in Triage) */}
                  {status.id === 'triage' && job.applicationNotes?.includes('Missing Keywords:') && (
                    <div className="mb-4">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">Gaps Identified</p>
                      <div className="flex flex-wrap gap-1.5">
                        {job.applicationNotes.replace('Missing Keywords: ', '').split(',').slice(0, 3).map((kw, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-red-500/5 text-red-400/80 text-[9px] font-bold border border-red-500/10 lowercase">
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Status Badges */}
                  {(job.coverLetterText || job.tailoredResumeText) && status.id !== 'triage' && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {job.coverLetterText && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/5 text-emerald-400 text-[8px] font-black uppercase border border-emerald-500/10">
                          <CheckCircle className="w-2.5 h-2.5" />
                          CL READY
                        </div>
                      )}
                      {job.tailoredResumeText && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/5 text-blue-400 text-[8px] font-black uppercase border border-blue-500/10">
                          <Sparkles className="w-2.5 h-2.5" />
                          RESUME
                        </div>
                      )}
                    </div>
                  )}


                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => handleStartOptimize(job)}
                      className={`w-full py-1.5 rounded text-[10px] font-black tracking-tighter transition-all border uppercase
                        ${status.id === 'triage' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20' : 
                          status.id === 'drafting' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20' :
                          'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'}`}
                    >
                      {status.id === 'triage' ? 'SCAN MATCH' : status.id === 'drafting' ? 'REWRITE' : 'OPTIMIZE'}
                    </button>

                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Global Context Menu Portal - outside all backdrop-blur/overflow stacking contexts */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-[9999] w-52 rounded-xl border border-white/10 shadow-2xl p-1 animate-in fade-in duration-150"
            style={{ top: contextMenu.top, right: contextMenu.right, background: 'rgba(15,15,20,0.97)' }}
          >
            {statuses.map(s => (
              <button
                key={s.id}
                onClick={() => { handleUpdateStatus(contextMenu.job.id, s.id); setContextMenu(null); }}
                className="w-full text-left px-3 py-2 text-[11px] font-medium hover:bg-white/5 rounded transition-colors flex items-center gap-2 text-slate-300"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                Move to {s.label}
              </button>
            ))}
            <div className="h-px bg-white/5 my-1" />
            <button
              onClick={() => { handleRecruiterMessage(contextMenu.job); setContextMenu(null); }}
              className="w-full text-left px-3 py-2 text-[11px] font-medium hover:bg-white/5 rounded transition-colors flex items-center gap-2 text-purple-400"
            >
              <Mail className="w-3.5 h-3.5" /> Recruiter Message
            </button>
            <button
              onClick={() => { handleTailorCoverLetter(contextMenu.job); setContextMenu(null); }}
              className="w-full text-left px-3 py-2 text-[11px] font-medium hover:bg-white/5 rounded transition-colors flex items-center gap-2 text-indigo-400"
            >
              <FileText className="w-3.5 h-3.5" /> Tailor Cover Letter
            </button>
            <button
              onClick={() => { setJdMatchModal({ job: contextMenu.job, result: null }); setContextMenu(null); }}
              className="w-full text-left px-3 py-2 text-[11px] font-medium hover:bg-white/5 rounded transition-colors flex items-center gap-2 text-amber-400"
            >
              <Target className="w-3.5 h-3.5" /> Match to JD
            </button>
            <div className="h-px bg-white/5 my-1" />
            <button
              onClick={() => { handleDelete(contextMenu.job.id); setContextMenu(null); }}
              className="w-full text-left px-3 py-2 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 rounded transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Opportunity
            </button>
          </div>
        </>
      )}

      {/* Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 glass-card !bg-indigo-600/90 border-white/20 shadow-2xl flex items-center gap-8 py-3 px-6 animate-in slide-in-from-bottom-8 duration-300 z-40">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {selectedIds.length}
            </span>
            <span className="font-bold text-sm">Jobs Selected</span>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex gap-2">
            <button onClick={handleBulkDelete} className="px-4 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors">
              Bulk Delete
            </button>
            <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 text-xs font-medium text-indigo-100 hover:text-white">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Cover Letter Modal */}
      {tailoringJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0a0a0c]/90 backdrop-blur-md" onClick={() => setTailoringJob(null)} />
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10 animate-in zoom-in-95 duration-200 flex flex-col p-0">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                  <FileText className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-outfit">Tailored Cover Letter</h3>
                  <p className="text-sm text-slate-400">For {tailoringJob.title} at {tailoringJob.company}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                   onClick={() => handleTailorCoverLetter(tailoringJob)}
                   className="btn-secondary py-2"
                   disabled={isGenerating}
                >
                  <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => window.open(tailoringJob.url, '_blank')}
                          className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10px] font-bold transition-colors"
                        >
                          OPEN URL
                        </button>
                        {((tailoringJob.status as any) === 'submitted' || (tailoringJob.status as any) === 'applied') && (
                          <button 
                            onClick={() => window.open(`/proofs/${tailoringJob.id}.png`, '_blank')}
                            className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold transition-colors border border-emerald-500/20"
                          >
                            VIEW PROOF
                          </button>
                        )}
                      </div>
                <button 
                  onClick={() => setTailoringJob(null)}
                  className="p-2 text-slate-500 hover:text-white"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0c]">
              {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
                  <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-indigo-400 font-medium animate-pulse">AI is crafting your tailored story...</p>
                </div>
              ) : (
                <textarea 
                  className="w-full h-[500px] bg-transparent border-none focus:ring-0 text-slate-300 font-serif text-lg leading-relaxed resize-none"
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="The AI will generate your cover letter here..."
                />
              )}
            </div>

            {/* JD input for personalization - tool 5 */}
            <div className="px-8 pb-4 bg-[#0a0a0c] border-t border-white/5">
              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1 block mt-3">
                ✦ Paste Job Description to Personalize (optional)
              </label>
              <textarea
                className="w-full h-20 input-field font-mono text-xs resize-none"
                value={jdInput}
                onChange={(e) => setJdInput(e.target.value)}
                placeholder="Paste the JD here, then click Regenerate to produce a role-specific cover letter..."
              />
            </div>

            <div className="p-6 border-t border-white/5 bg-white/5 flex justify-between items-center">
              <button 
                onClick={() => {
                   if(confirm("Delete this draft?")) {
                      setCoverLetter("");
                      setTailoringJob(null);
                   }
                }}
                className="text-rose-400 text-sm font-bold hover:text-rose-300 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Draft
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={async () => {
                    await saveApplicationDraft(tailoringJob.id, { coverLetterText: coverLetter });
                    setTailoringJob(null);
                    loadJobs();
                  }}
                  className="btn-secondary py-2 px-6"
                >
                  Save as Draft
                </button>
                <button 
                  onClick={async () => {
                    await saveApplicationDraft(tailoringJob.id, { coverLetterText: coverLetter });
                    await updateJobStatus(tailoringJob.id, 'ready' as any);
                    setTailoringJob(null);
                    loadJobs();
                  }}
                  className="btn-primary py-2 px-8 flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Ready to Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}




      {/* Recruiter Outreach Modal */}
      {recruiterModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#121215] border border-white/10 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Recruiter Outreach</h3>
                  <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{recruiterModal.job.company}</p>
                </div>
              </div>
              <button onClick={() => setRecruiterModal(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-all"><XCircle className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {isGeneratingRecruiter ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-sm font-bold text-indigo-400 animate-pulse">Generating hooks...</p>
                </div>
              ) : recruiterModal.messages ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Share2 className="w-3 h-3" /> LinkedIn Hook</p>
                      <button onClick={() => copyToClipboard(recruiterModal.messages!.linkedin)} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">Copy</button>
                    </div>
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-sm leading-relaxed text-slate-300 italic">
                      "{recruiterModal.messages.linkedin}"
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Mail className="w-3 h-3" /> Email Follow-up</p>
                      <button onClick={() => copyToClipboard(recruiterModal.messages!.email)} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">Copy</button>
                    </div>
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap italic">
                      {recruiterModal.messages.email}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-12">Click "Generate" to create outreach hooks.</p>
              )}
            </div>
          </div>
        </div>
      )}      {/* Optimizer Modal */}
      {optimizeModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0f0f12] border border-white/10 w-full max-w-6xl h-[90vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-3xl bg-amber-500 flex items-center justify-center text-black">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-white">Full Application Optimization</h3>
                  <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{optimizeModal.job.company} • {optimizeModal.job.title}</p>
                </div>
              </div>
              <button onClick={() => setOptimizeModal(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-500 transition-all"><XCircle className="w-8 h-8" /></button>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* Left Column: Input & Context */}
              <div className="w-1/3 border-r border-white/5 p-8 overflow-y-auto space-y-8">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Job Description Source</label>
                  <textarea 
                    value={optimizeModal.jd}
                    onChange={(e) => setOptimizeModal(prev => prev ? { ...prev, jd: e.target.value } : null)}
                    className="w-full h-96 bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-xs font-mono text-slate-400 focus:border-amber-500/50 outline-none transition-all scrollbar-hide"
                    placeholder="Paste job details here..."
                  />
                </div>
                <button 
                  onClick={handleRunOptimization}
                  disabled={optimizeModal.isGenerating}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {optimizeModal.isGenerating ? (
                    <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> ANALYZING...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> RUN STAFF TRANSFORMATION</>
                  )}
                </button>
              </div>

              {/* Right Column: AI Output */}
              <div className="flex-1 p-8 overflow-y-auto space-y-12 bg-white/[0.01]">
                {!optimizeModal.result ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <Sparkles className="w-12 h-12 mb-4 text-slate-600" />
                    <p className="text-lg font-bold text-slate-400">Ready to Transform</p>
                    <p className="text-sm text-slate-500 max-w-xs">Click the button on the left to run the full 7-module optimization package.</p>
                  </div>
                ) : (
                  <div className="space-y-12">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Match Score</p>
                        <p className={`text-4xl font-black ${optimizeModal.result.matchScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{optimizeModal.result.matchScore}%</p>
                      </div>
                      <div className="col-span-2 p-6 rounded-3xl bg-white/[0.02] border border-white/5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Strategic Advice</p>
                        <p className="text-xs text-slate-300 font-bold leading-relaxed">{optimizeModal.result.applicationStrategy}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><FileText className="w-3 h-3" /> Tailored Resume Content</p>
                        <button onClick={() => copyToClipboard(optimizeModal.result!.tailoredResumeText)} className="text-[10px] font-bold text-amber-500 hover:text-amber-400 uppercase tracking-widest">Copy Content</button>
                      </div>
                      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 text-xs font-mono text-slate-400 leading-relaxed whitespace-pre-wrap">
                        {optimizeModal.result.tailoredResumeText}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Mail className="w-3 h-3" /> Personalized Cover Letter</p>
                        <button onClick={() => copyToClipboard(optimizeModal.result!.tailoredCoverLetter)} className="text-[10px] font-bold text-amber-500 hover:text-amber-400 uppercase tracking-widest">Copy Content</button>
                      </div>
                      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 text-xs font-mono text-slate-400 leading-relaxed whitespace-pre-wrap italic">
                        {optimizeModal.result.tailoredCoverLetter}
                      </div>
                    </div>

                    <div className="pt-8 border-t border-white/5">
                      <button 
                        onClick={handleSaveReady}
                        className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-2xl font-black text-lg uppercase tracking-tighter transition-all shadow-xl shadow-emerald-500/20"
                      >
                        CONFIRM & MOVE TO "READY FOR BOT"
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JD Match Modal */}
      {jdMatchModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0f0f12] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Match to JD</h3>
                  <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{jdMatchModal.job.company}</p>
                </div>
              </div>
              <button onClick={() => setJdMatchModal(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-all"><XCircle className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 space-y-6">
              {!jdMatchModal.result ? (
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Paste Job Description</label>
                  <textarea 
                    value={jdMatchInput}
                    onChange={(e) => setJdMatchInput(e.target.value)}
                    className="w-full h-48 bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-xs font-mono text-slate-400 focus:border-amber-500/50 outline-none transition-all"
                    placeholder="Paste the JD here to analyze keyword gaps and match score..."
                  />
                  <button 
                    onClick={handleJdMatch}
                    disabled={isMatching || !jdMatchInput.trim()}
                    className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {isMatching ? "AI ANALYZING..." : "RUN MATCH SCAN"}
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between p-6 rounded-3xl bg-white/[0.02] border border-white/5">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Match Score</p>
                      <p className={`text-4xl font-black ${jdMatchModal.result.matchScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{jdMatchModal.result.matchScore}%</p>
                    </div>
                    <div className="text-right">
                       <p className="text-xs text-slate-400 font-medium italic">"{jdMatchModal.result.rewrittenSummary}"</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">Missing Keywords</p>
                    <div className="flex flex-wrap gap-2">
                      {jdMatchModal.result.missingKeywords.map((kw: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold">{kw}</span>
                      ))}
                      {jdMatchModal.result.missingKeywords.length === 0 && <p className="text-xs text-emerald-400 font-bold italic">No gaps detected! You are a strong fit.</p>}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setJdMatchModal(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl font-bold text-xs transition-all">Close</button>
                    <button 
                      onClick={() => {
                        handleStartOptimize(jdMatchModal.job);
                        setJdMatchModal(null);
                      }}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs transition-all uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                    >
                      Start Full Optimization
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

