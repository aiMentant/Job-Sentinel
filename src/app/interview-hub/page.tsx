"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Briefcase, 
  Target, 
  Users, 
  Trophy,
  Sparkles,
  ExternalLink,
  Mail,
  Send,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Award,
  BookOpen,
  DollarSign,
  Check,
  Save,
  Trash2
} from "lucide-react";
import { fetchJobs, updateJob } from "@/app/actions/jobActions";
import { generateInterviewPrepMaterial } from "@/app/actions/careerTools";
import { Job } from "@/lib/db";
import { useProfile } from "@/components/ProfileContext";

// Converts **bold** and *italic* markdown to HTML spans safely (no DOMParser needed)
function renderMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<span class="font-bold text-foreground">$1</span>')
    .replace(/\n/g, '<br />');
}

function InterviewHubContent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'pitch' | 'behavioral' | 'technical' | 'reverse' | 'salary'>('pitch');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Refine text hook states
  const [refineInstructions, setRefineInstructions] = useState<Record<string, string>>({});
  const [isRefining, setIsRefining] = useState<Record<string, boolean>>({});
  // Which answer block is currently in text-edit mode (null = all in rendered view)
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const { activeProfileId } = useProfile();
  const searchParams = useSearchParams();
  const targetJobId = searchParams.get('jobId');

  useEffect(() => {
    loadJobs();
  }, [activeProfileId]);

  useEffect(() => {
    if (targetJobId && jobs.length > 0) {
      const found = jobs.find((j: Job) => j.id === targetJobId);
      if (found) {
        setSelectedJob(found);
        // Default tab routing based on job status
        if (found.status === 'Applied' || found.status === 'Ready' || found.status === 'Recruiter Screen') {
          setActiveTab('pitch');
        } else if (found.status === 'Technical Round') {
          setActiveTab('technical');
        } else if (found.status === 'Portfolio Presentation') {
          setActiveTab('behavioral');
        } else if (found.status === '2nd Interview' || found.status === 'Final Round') {
          setActiveTab('behavioral');
        } else if (found.status === 'Offer') {
          setActiveTab('salary');
        }
      }
    }
  }, [targetJobId, jobs]);

  const prepAttemptedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (selectedJob && !selectedJob.interviewPrepData && !prepAttemptedIds.current.has(selectedJob.id)) {
      prepAttemptedIds.current.add(selectedJob.id);
      handleGeneratePrep(selectedJob);
    }
  }, [selectedJob]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const allJobs = await fetchJobs(activeProfileId);
      const interviewStages = [
        'Ready',
        'Applied',
        'Recruiter Screen', 
        'Technical Round', 
        'Portfolio Presentation', 
        '2nd Interview', 
        'Final Round',
        'Offer'
      ];
      const filtered = allJobs.filter((j: any) => interviewStages.includes(j.status));
      setJobs(filtered);
      
      // Select the job passed via query params if available, else default to first
      const found = filtered.find((j: Job) => j.id === targetJobId);
      if (found) {
        setSelectedJob(found);
        if (found.status === 'Applied' || found.status === 'Ready' || found.status === 'Recruiter Screen') {
          setActiveTab('pitch');
        } else if (found.status === 'Technical Round') {
          setActiveTab('technical');
        } else if (found.status === 'Portfolio Presentation') {
          setActiveTab('behavioral');
        } else if (found.status === '2nd Interview' || found.status === 'Final Round') {
          setActiveTab('behavioral');
        } else if (found.status === 'Offer') {
          setActiveTab('salary');
        }
      } else if (filtered.length > 0) {
        setSelectedJob(filtered[0]);
        if (filtered[0].status === 'Applied' || filtered[0].status === 'Ready' || filtered[0].status === 'Recruiter Screen') {
          setActiveTab('pitch');
        } else if (filtered[0].status === 'Technical Round') {
          setActiveTab('technical');
        } else if (filtered[0].status === 'Portfolio Presentation') {
          setActiveTab('behavioral');
        } else if (filtered[0].status === '2nd Interview' || filtered[0].status === 'Final Round') {
          setActiveTab('behavioral');
        } else if (filtered[0].status === 'Offer') {
          setActiveTab('salary');
        }
      } else {
        setSelectedJob(null);
      }
    } catch (e) {
      console.error("Failed to load interview stages:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePrep = async (job: Job) => {
    setIsGenerating(true);
    try {
      const prep = await generateInterviewPrepMaterial(
        job.description || "",
        job.title,
        job.company,
        activeProfileId
      );
      
      const updated = {
        ...job,
        interviewPrepData: prep
      };
      
      await updateJob(job.id, updated);
      setSelectedJob(updated);
      setJobs(prev => prev.map(j => j.id === job.id ? updated : j));
    } catch (e) {
      alert("Failed to generate interview guide. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefinePrep = async (section: 'pitch' | 'behavioral' | 'technical' | 'reverse' | 'salary', index?: number) => {
    if (!selectedJob || !selectedJob.interviewPrepData) return;
    const key = index !== undefined ? `${section}-${index}` : section;
    const instruction = refineInstructions[key];
    if (!instruction || !instruction.trim()) return;

    setIsRefining(prev => ({ ...prev, [key]: true }));
    try {
      const { refineInterviewPrepSection } = await import("@/app/actions/careerTools");
      
      let currentText = "";
      let extraContext = "";
      if (section === 'pitch') {
        currentText = selectedJob.interviewPrepData.pitch || "";
      } else if (section === 'salary') {
        currentText = selectedJob.interviewPrepData.salaryNegotiation || "";
      } else if (section === 'behavioral' && index !== undefined && selectedJob.interviewPrepData.behavioralQuestions) {
        currentText = selectedJob.interviewPrepData.behavioralQuestions[index].a || "";
        extraContext = selectedJob.interviewPrepData.behavioralQuestions[index].q || "";
      } else if (section === 'technical' && index !== undefined && selectedJob.interviewPrepData.technicalQuestions) {
        currentText = selectedJob.interviewPrepData.technicalQuestions[index].a || "";
        extraContext = selectedJob.interviewPrepData.technicalQuestions[index].q || "";
      } else if (section === 'reverse') {
        currentText = (selectedJob.interviewPrepData.reverseQuestions || []).join("\n");
      }

      const refinedText = await refineInterviewPrepSection(
        section,
        currentText,
        instruction,
        selectedJob.title,
        selectedJob.company,
        extraContext
      );

      const updatedPrepData = { ...selectedJob.interviewPrepData };
      if (section === 'pitch') {
        updatedPrepData.pitch = refinedText;
      } else if (section === 'salary') {
        updatedPrepData.salaryNegotiation = refinedText;
      } else if (section === 'behavioral' && index !== undefined && updatedPrepData.behavioralQuestions) {
        const list = [...updatedPrepData.behavioralQuestions];
        list[index] = { ...list[index], a: refinedText };
        updatedPrepData.behavioralQuestions = list;
      } else if (section === 'technical' && index !== undefined && updatedPrepData.technicalQuestions) {
        const list = [...updatedPrepData.technicalQuestions];
        list[index] = { ...list[index], a: refinedText };
        updatedPrepData.technicalQuestions = list;
      } else if (section === 'reverse') {
        updatedPrepData.reverseQuestions = refinedText.split("\n").map(l => l.replace(/^[•\-\*\s\d\.\)]+/, '').trim()).filter(Boolean);
      }

      const updatedJob = { ...selectedJob, interviewPrepData: updatedPrepData };
      setSelectedJob(updatedJob);
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
      setRefineInstructions(prev => ({ ...prev, [key]: "" }));
    } catch (e) {
      alert("Failed to refine prep content.");
    } finally {
      setIsRefining(prev => ({ ...prev, [key]: false }));
    }
  };

  const getNextStatus = (currentStatus: string): string => {
    switch (currentStatus) {
      case 'Recruiter Screen': return 'Technical Round';
      case 'Technical Round': return 'Portfolio Presentation';
      case 'Portfolio Presentation': return '2nd Interview';
      case '2nd Interview': return 'Final Round';
      case 'Final Round': return 'Offer';
      default: return currentStatus;
    }
  };

  const handleSavePrep = async () => {
    if (!selectedJob) return;
    setIsSaving(true);
    try {
      const nextStatus = getNextStatus(selectedJob.status);
      const updatedJob = {
        ...selectedJob,
        status: nextStatus as any
      };
      await updateJob(selectedJob.id, updatedJob);
      setSelectedJob(updatedJob);
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
      alert(`Interview Prep Guide successfully saved! Job moved to "${nextStatus}" in the Active Pipeline.`);
    } catch (e) {
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string = "Copied to clipboard!") => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto h-[calc(100vh-80px)] flex flex-col">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold font-outfit text-foreground">Interview Hub</h2>
          <p className="text-text-muted mt-1">Access AI-generated command centers for your active interview processes.</p>
        </div>
        
        {selectedJob && selectedJob.interviewPrepData && (
          <button
            onClick={handleSavePrep}
            disabled={isSaving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg flex items-center gap-2"
          >
            {isSaving ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save All Prep Edits
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-sm font-bold text-text-muted animate-pulse">Loading Interview Hub...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex-1 glass-card rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-xl text-foreground">No Active Interviews Yet</h3>
            <p className="text-sm text-text-muted mt-2 max-w-sm">Drag a job card into one of the "Interview" stages on the Active Pipeline board to unlock your Interview Hub guides.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex gap-8">
          
          {/* Left Column: Interviewing Companies List */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-hide">
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Active Companies</h4>
            {jobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              return (
                <button
                  key={job.id}
                  onClick={() => {
                    setSelectedJob(job);
                    if (job.status === 'Applied' || job.status === 'Ready' || job.status === 'Recruiter Screen') {
                      setActiveTab('pitch');
                    } else if (job.status === 'Technical Round') {
                      setActiveTab('technical');
                    } else if (job.status === 'Portfolio Presentation') {
                      setActiveTab('behavioral');
                    } else if (job.status === '2nd Interview' || job.status === 'Final Round') {
                      setActiveTab('behavioral');
                    } else if (job.status === 'Offer') {
                      setActiveTab('salary');
                    } else {
                      setActiveTab('pitch');
                    }
                  }}
                  className={`w-full text-left p-5 rounded-[2rem] border transition-all flex flex-col gap-2 ${
                    isSelected 
                      ? "bg-foreground/5 border-card-border shadow-lg" 
                      : "bg-card border-transparent hover:border-card-border"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">{job.status}</span>
                    {job.interviewPrepData && (
                      <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded border border-emerald-500/20 uppercase">Prep Ready</span>
                    )}
                  </div>
                  <h5 className="font-bold text-sm text-foreground line-clamp-1">{job.company}</h5>
                  <p className="text-xs text-text-muted line-clamp-1 font-medium">{job.title}</p>
                </button>
              );
            })}
          </div>

          {/* Right Column: AI Prep Command Center */}
          <div className="flex-1 bg-card border border-card-border rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
            {selectedJob && (
              <>
                {/* Selected Job Header */}
                <div className="p-8 border-b border-card-border flex justify-between items-center bg-black/[0.01] dark:bg-white/[0.01]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-3xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-foreground">{selectedJob.company}</h3>
                      <p className="text-xs text-text-muted uppercase font-black tracking-widest">{selectedJob.title}</p>
                    </div>
                  </div>
                  {selectedJob.interviewPrepData && (
                    <button 
                      onClick={() => handleGeneratePrep(selectedJob)}
                      disabled={isGenerating}
                      className="btn-secondary py-2.5 px-4 text-xs font-bold gap-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} /> Re-Generate Guide
                    </button>
                  )}
                </div>

                {/* Main Content Area */}
                {!selectedJob.interviewPrepData ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
                    {isGenerating ? (
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-4 border-amber-500/25 border-t-amber-500 rounded-full animate-spin" />
                        <p className="text-lg font-bold text-foreground">Assembling AI Interview Hub...</p>
                        <p className="text-sm text-text-muted max-w-xs leading-relaxed">Analyzing requirements, drafting likely questions, reverse prompts, and salary talk-tracks...</p>
                      </div>
                    ) : (
                      <>
                        <Sparkles className="w-12 h-12 text-amber-500 animate-pulse" />
                        <div>
                          <h4 className="font-bold text-lg text-foreground">Build Interview Command Center</h4>
                          <p className="text-sm text-text-muted max-w-sm mt-2 leading-relaxed">Let Gemini analyze this company and job description to formulate custom pitches, expected behavioral/technical STAR guides, and negotiation metrics.</p>
                        </div>
                        <button
                          onClick={() => handleGeneratePrep(selectedJob)}
                          className="btn-primary px-8 py-3.5 text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20"
                        >
                          Generate AI Prep Guide
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* Inner Tabs Navigation */}
                    <div className="px-8 py-4 border-b border-card-border flex gap-6 overflow-x-auto scrollbar-hide bg-black/[0.01] dark:bg-white/[0.01]">
                      {[
                        { id: 'pitch', label: 'Elevator Pitch', icon: Users },
                        { id: 'behavioral', label: 'Behavioral Prep', icon: Award },
                        { id: 'technical', label: 'Technical Prep', icon: BookOpen },
                        { id: 'reverse', label: 'Questions to Ask', icon: Send },
                        { id: 'salary', label: 'Negotiation Strategy', icon: DollarSign }
                      ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${
                              isActive 
                                ? "border-amber-500 text-amber-500" 
                                : "border-transparent text-text-muted hover:text-foreground"
                            }`}
                          >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Scrollable Details Area */}
                    <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                      
                      {/* PITCH TAB */}
                      {activeTab === 'pitch' && (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-bold text-base text-foreground">Your Tailored Elevator Pitch</h4>
                              <p className="text-xs text-text-muted">A compelling 1-minute script to answer the "Tell me about yourself" question.</p>
                            </div>
                            <button 
                              onClick={() => copyToClipboard(selectedJob.interviewPrepData?.pitch || "", "Pitch copied!")}
                              className="btn-secondary py-2 px-3.5 text-xs font-bold gap-2"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy Pitch
                            </button>
                          </div>
                          
                          <textarea
                            value={selectedJob.interviewPrepData?.pitch || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (selectedJob && selectedJob.interviewPrepData) {
                                setSelectedJob({
                                  ...selectedJob,
                                  interviewPrepData: { ...selectedJob.interviewPrepData, pitch: val }
                                });
                              }
                            }}
                            className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-card-border rounded-2xl p-6 stepper-textarea focus:border-indigo-500/50 outline-none font-sans resize-none overflow-hidden"
                            rows={Math.max(5, Math.ceil((selectedJob.interviewPrepData?.pitch || "").length / 85) + (selectedJob.interviewPrepData?.pitch || "").split('\n').length - 1)}
                            placeholder="Your elevator pitch..."
                          />

                          {/* Inline AI Refine/Tweak Pitch */}
                          <div className="flex gap-2 items-center w-full max-w-2xl">
                            <div className="flex-1 p-2 bg-black/[0.03] dark:bg-white/5 border border-card-border rounded-xl flex items-center gap-2">
                              <input 
                                type="text" 
                                value={refineInstructions['pitch'] || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setRefineInstructions(prev => ({ ...prev, pitch: val }));
                                }}
                                placeholder="Tweak pitch (e.g. 'emphasize my leadership style', 'keep it under 120 words')..."
                                className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-foreground outline-none"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRefinePrep('pitch'); } }}
                              />
                            </div>
                            <button 
                              onClick={() => handleRefinePrep('pitch')}
                              disabled={isRefining['pitch'] || !(refineInstructions['pitch'] || "").trim()}
                              className="px-4 py-2 bg-indigo-950 dark:bg-indigo-300 hover:bg-indigo-900 dark:hover:bg-indigo-200 disabled:opacity-30 text-white dark:text-slate-950 rounded-xl text-xs font-bold dark:font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              {isRefining['pitch'] ? (
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-slate-950/30 dark:border-t-slate-950 rounded-full animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-white dark:text-slate-950" />
                              )}
                              Refine Pitch
                            </button>
                          </div>
                        </div>
                      )}

                      {/* BEHAVIORAL TAB */}
                      {activeTab === 'behavioral' && (
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-bold text-base text-foreground">STAR Behavioral Guide</h4>
                            <p className="text-xs text-text-muted">Expected questions paired with guidelines to frame your answers using the STAR method.</p>
                          </div>
                          
                          <div className="space-y-8">
                            {selectedJob.interviewPrepData?.behavioralQuestions?.map((item, idx) => {
                              const linesCount = item.a.split('\n').length;
                              const computedRows = Math.max(3, Math.ceil(item.a.length / 85) + linesCount - 1);
                              const key = `behavioral-${idx}`;
                              return (
                                <div key={idx} className="space-y-3 relative group/qa pb-8 border-b border-card-border/30 last:border-b-0 last:pb-0">
                                  <div className="flex justify-between items-center gap-3">
                                    <input 
                                      type="text"
                                      value={item.q}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const prep = selectedJob?.interviewPrepData;
                                        if (!prep?.behavioralQuestions) return;
                                        const list = [...prep.behavioralQuestions];
                                        list[idx] = { ...list[idx], q: val };
                                        setSelectedJob({ ...selectedJob, interviewPrepData: { ...prep, behavioralQuestions: list } });
                                      }}
                                      className="flex-1 bg-transparent border-none font-bold text-sm text-purple-600 dark:text-purple-400 focus:ring-0 outline-none p-0"
                                      placeholder="Behavioral Question"
                                    />
                                    <button
                                      onClick={() => {
                                        const prep = selectedJob?.interviewPrepData;
                                        if (!prep?.behavioralQuestions) return;
                                        const list = prep.behavioralQuestions.filter((_, i) => i !== idx);
                                        setSelectedJob({ ...selectedJob, interviewPrepData: { ...prep, behavioralQuestions: list } });
                                      }}
                                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover/qa:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                      title="Delete Question"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  
                                  {/* Answer: rendered markdown preview, click to edit */}
                                  {editingKey === key ? (
                                    <textarea
                                      autoFocus
                                      value={item.a}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const prep = selectedJob?.interviewPrepData;
                                        if (!prep?.behavioralQuestions) return;
                                        const list = [...prep.behavioralQuestions];
                                        list[idx] = { ...list[idx], a: val };
                                        setSelectedJob({ ...selectedJob, interviewPrepData: { ...prep, behavioralQuestions: list } });
                                      }}
                                      onBlur={() => setEditingKey(null)}
                                      className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-indigo-500/50 rounded-xl p-4 stepper-textarea focus:outline-none font-sans resize-none overflow-hidden"
                                      placeholder="STAR Method Answer Guide"
                                      rows={computedRows}
                                    />
                                  ) : (
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setEditingKey(key)}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditingKey(key); }}
                                      title="Click to edit"
                                      className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-card-border hover:border-indigo-500/40 rounded-xl p-4 stepper-textarea font-sans cursor-text leading-relaxed text-sm min-h-[3rem] transition-colors"
                                      dangerouslySetInnerHTML={{ __html: renderMarkdown(item.a) || '<span class="opacity-40">STAR Method Answer Guide...</span>' }}
                                    />
                                  )}

                                  {/* Inline AI Tweak */}
                                  <div className="flex gap-2 items-center w-full max-w-2xl">
                                    <div className="flex-1 p-2 bg-black/[0.03] dark:bg-white/5 border border-card-border rounded-xl flex items-center gap-2">
                                      <input 
                                        type="text" 
                                        value={refineInstructions[key] || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setRefineInstructions(prev => ({ ...prev, [key]: val }));
                                        }}
                                        placeholder="Tweak response (e.g. 'emphasize my scale metrics', 'make it sound more leadership-focused')..."
                                        className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-foreground outline-none"
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRefinePrep('behavioral', idx); } }}
                                      />
                                    </div>
                                    <button 
                                      onClick={() => handleRefinePrep('behavioral', idx)}
                                      disabled={isRefining[key] || !(refineInstructions[key] || "").trim()}
                                      className="px-4 py-2 bg-indigo-950 dark:bg-indigo-300 hover:bg-indigo-900 dark:hover:bg-indigo-200 disabled:opacity-30 text-white dark:text-slate-950 rounded-xl text-xs font-bold dark:font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                    >
                                      {isRefining[key] ? (
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-slate-950/30 dark:border-t-slate-950 rounded-full animate-spin" />
                                      ) : (
                                        <Sparkles className="w-3.5 h-3.5 text-white dark:text-slate-950" />
                                      )}
                                      Refine Answer
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* TECHNICAL TAB */}
                      {activeTab === 'technical' && (
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-bold text-base text-foreground">Technical Q&A Guidelines</h4>
                            <p className="text-xs text-text-muted">Predictive technical questions derived from the job's core skill requirements.</p>
                          </div>

                          <div className="space-y-8">
                            {selectedJob.interviewPrepData?.technicalQuestions?.map((item, idx) => {
                              const linesCount = item.a.split('\n').length;
                              const computedRows = Math.max(3, Math.ceil(item.a.length / 85) + linesCount - 1);
                              const key = `technical-${idx}`;
                              return (
                                <div key={idx} className="space-y-3 relative group/qa pb-8 border-b border-card-border/30 last:border-b-0 last:pb-0">
                                  <div className="flex justify-between items-center gap-3">
                                    <input 
                                      type="text"
                                      value={item.q}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const prep = selectedJob?.interviewPrepData;
                                        if (!prep?.technicalQuestions) return;
                                        const list = [...prep.technicalQuestions];
                                        list[idx] = { ...list[idx], q: val };
                                        setSelectedJob({ ...selectedJob, interviewPrepData: { ...prep, technicalQuestions: list } });
                                      }}
                                      className="flex-1 bg-transparent border-none font-bold text-sm text-purple-600 dark:text-purple-400 focus:ring-0 outline-none p-0"
                                      placeholder="Technical Question"
                                    />
                                    <button
                                      onClick={() => {
                                        const prep = selectedJob?.interviewPrepData;
                                        if (!prep?.technicalQuestions) return;
                                        const list = prep.technicalQuestions.filter((_, i) => i !== idx);
                                        setSelectedJob({ ...selectedJob, interviewPrepData: { ...prep, technicalQuestions: list } });
                                      }}
                                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover/qa:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                      title="Delete Question"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  
                                  {/* Answer: rendered markdown preview, click to edit */}
                                  {editingKey === key ? (
                                    <textarea
                                      autoFocus
                                      value={item.a}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const prep = selectedJob?.interviewPrepData;
                                        if (!prep?.technicalQuestions) return;
                                        const list = [...prep.technicalQuestions];
                                        list[idx] = { ...list[idx], a: val };
                                        setSelectedJob({ ...selectedJob, interviewPrepData: { ...prep, technicalQuestions: list } });
                                      }}
                                      onBlur={() => setEditingKey(null)}
                                      className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-indigo-500/50 rounded-xl p-4 stepper-textarea focus:outline-none font-sans resize-none overflow-hidden"
                                      placeholder="Technical Guidelines"
                                      rows={computedRows}
                                    />
                                  ) : (
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setEditingKey(key)}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditingKey(key); }}
                                      title="Click to edit"
                                      className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-card-border hover:border-indigo-500/40 rounded-xl p-4 stepper-textarea font-sans cursor-text leading-relaxed text-sm min-h-[3rem] transition-colors"
                                      dangerouslySetInnerHTML={{ __html: renderMarkdown(item.a) || '<span class="opacity-40">Technical Guidelines...</span>' }}
                                    />
                                  )}

                                  {/* Inline AI Tweak */}
                                  <div className="flex gap-2 items-center w-full max-w-2xl">
                                    <div className="flex-1 p-2 bg-black/[0.03] dark:bg-white/5 border border-card-border rounded-xl flex items-center gap-2">
                                      <input 
                                        type="text" 
                                        value={refineInstructions[key] || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setRefineInstructions(prev => ({ ...prev, [key]: val }));
                                        }}
                                        placeholder="Tweak response (e.g. 'sound more senior', 'include security details')..."
                                        className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-foreground outline-none"
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRefinePrep('technical', idx); } }}
                                      />
                                    </div>
                                    <button 
                                      onClick={() => handleRefinePrep('technical', idx)}
                                      disabled={isRefining[key] || !(refineInstructions[key] || "").trim()}
                                      className="px-4 py-2 bg-indigo-950 dark:bg-indigo-300 hover:bg-indigo-900 dark:hover:bg-indigo-200 disabled:opacity-30 text-white dark:text-slate-950 rounded-xl text-xs font-bold dark:font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                    >
                                      {isRefining[key] ? (
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-slate-950/30 dark:border-t-slate-950 rounded-full animate-spin" />
                                      ) : (
                                        <Sparkles className="w-3.5 h-3.5 text-white dark:text-slate-950" />
                                      )}
                                      Refine Answer
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* REVERSE TAB */}
                      {activeTab === 'reverse' && (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-bold text-base text-foreground">Questions to Ask Interviewers</h4>
                              <p className="text-xs text-text-muted">Smart, context-driven questions to evaluate the company and demonstrate interest.</p>
                            </div>
                            <button 
                              onClick={() => copyToClipboard(selectedJob.interviewPrepData?.reverseQuestions?.join("\n\n") || "", "Questions copied!")}
                              className="btn-secondary py-2 px-3.5 text-xs font-bold gap-2"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy All
                            </button>
                          </div>
                          
                          <div className="space-y-4">
                            {selectedJob.interviewPrepData?.reverseQuestions?.map((q, idx) => (
                              <div key={idx} className="flex gap-3 items-start group/qta">
                                <span className="w-6 h-6 mt-2 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/25 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <textarea
                                  value={q}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const prep = selectedJob?.interviewPrepData;
                                    if (!prep?.reverseQuestions) return;
                                    const list = [...prep.reverseQuestions];
                                    list[idx] = val;
                                    setSelectedJob({ ...selectedJob, interviewPrepData: { ...prep, reverseQuestions: list } });
                                  }}
                                  rows={Math.max(2, Math.ceil(q.length / 80))}
                                  className="flex-1 input-field stepper-textarea text-sm py-2 bg-card border-card-border resize-none leading-relaxed overflow-hidden"
                                />
                                <button
                                  onClick={() => {
                                    const prep = selectedJob?.interviewPrepData;
                                    if (!prep?.reverseQuestions) return;
                                    const list = prep.reverseQuestions.filter((_, i) => i !== idx);
                                    setSelectedJob({ ...selectedJob, interviewPrepData: { ...prep, reverseQuestions: list } });
                                  }}
                                  className="p-1.5 mt-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover/qta:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                  title="Delete Question"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            
                            {/* Inline AI Tweak for Reverse Questions */}
                            <div className="flex gap-2 items-center w-full max-w-2xl pt-4 border-t border-card-border/30">
                              <div className="flex-1 p-2 bg-black/[0.03] dark:bg-white/5 border border-card-border rounded-xl flex items-center gap-2">
                                <input 
                                  type="text" 
                                  value={refineInstructions['reverse'] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRefineInstructions(prev => ({ ...prev, reverse: val }));
                                  }}
                                  placeholder="Tweak questions (e.g. 'focus on design systems', 'make them shorter')..."
                                  className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-foreground outline-none"
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRefinePrep('reverse'); } }}
                                />
                              </div>
                              <button 
                                onClick={() => handleRefinePrep('reverse')}
                                disabled={isRefining['reverse'] || !(refineInstructions['reverse'] || "").trim()}
                                className="px-4 py-2 bg-indigo-950 dark:bg-indigo-300 hover:bg-indigo-900 dark:hover:bg-indigo-200 disabled:opacity-30 text-white dark:text-slate-950 rounded-xl text-xs font-bold dark:font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                {isRefining['reverse'] ? (
                                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-slate-950/30 dark:border-t-slate-950 rounded-full animate-spin" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5 text-white dark:text-slate-950" />
                                )}
                                Refine Questions
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SALARY TAB */}
                      {activeTab === 'salary' && (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-bold text-base text-foreground">Compensation Blueprint & Negotiation</h4>
                              <p className="text-xs text-text-muted">Target salary averages and negotiation strategy scripts tailored to the role.</p>
                            </div>
                            <button 
                              onClick={() => copyToClipboard(selectedJob.interviewPrepData?.salaryNegotiation || "", "Negotiation guide copied!")}
                              className="btn-secondary py-2 px-3.5 text-xs font-bold gap-2"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy Blueprint
                            </button>
                          </div>
                          
                          <textarea
                            value={selectedJob.interviewPrepData?.salaryNegotiation || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (selectedJob && selectedJob.interviewPrepData) {
                                setSelectedJob({
                                  ...selectedJob,
                                  interviewPrepData: { ...selectedJob.interviewPrepData, salaryNegotiation: val }
                                });
                              }
                            }}
                            className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-card-border rounded-2xl p-6 stepper-textarea focus:border-indigo-500/50 outline-none font-sans resize-none overflow-hidden"
                            rows={Math.max(8, Math.ceil((selectedJob.interviewPrepData?.salaryNegotiation || "").length / 85) + (selectedJob.interviewPrepData?.salaryNegotiation || "").split('\n').length - 1)}
                            placeholder="Salary strategy talking points..."
                          />

                          {/* Inline AI Refine/Tweak Salary */}
                          <div className="flex gap-2 items-center w-full max-w-2xl">
                            <div className="flex-1 p-2 bg-black/[0.03] dark:bg-white/5 border border-card-border rounded-xl flex items-center gap-2">
                              <input 
                                type="text" 
                                value={refineInstructions['salary'] || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setRefineInstructions(prev => ({ ...prev, salary: val }));
                                }}
                                placeholder="Tweak salary talks (e.g. 'tailor for London market', 'be more aggressive')..."
                                className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-foreground outline-none"
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRefinePrep('salary'); } }}
                              />
                            </div>
                            <button 
                              onClick={() => handleRefinePrep('salary')}
                              disabled={isRefining['salary'] || !(refineInstructions['salary'] || "").trim()}
                              className="px-4 py-2 bg-indigo-950 dark:bg-indigo-300 hover:bg-indigo-900 dark:hover:bg-indigo-200 disabled:opacity-30 text-white dark:text-slate-950 rounded-xl text-xs font-bold dark:font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              {isRefining['salary'] ? (
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-slate-950/30 dark:border-t-slate-950 rounded-full animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-white dark:text-slate-950" />
                              )}
                              Refine Strategy
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      {copiedText && (
        <div className="fixed bottom-6 right-6 z-[99999] px-6 py-3 bg-emerald-600 text-white rounded-xl shadow-2xl font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-bottom-5 duration-300 border border-emerald-500/20">
          {copiedText}
        </div>
      )}
    </div>
  );
}

export default function InterviewHubPage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-text-muted flex items-center justify-center min-h-[400px]">
        <div className="space-y-4">
          <Sparkles className="w-8 h-8 text-amber-500 animate-pulse mx-auto" />
          <p className="font-bold text-sm">Loading Interview Hub...</p>
        </div>
      </div>
    }>
      <InterviewHubContent />
    </Suspense>
  );
}
