"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
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
  DollarSign
} from "lucide-react";
import { fetchJobs, updateJob } from "@/app/actions/jobActions";
import { generateInterviewPrepMaterial } from "@/app/actions/careerTools";
import { Job } from "@/lib/db";
import { useProfile } from "@/components/ProfileContext";

export default function InterviewHubPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'pitch' | 'behavioral' | 'technical' | 'reverse' | 'salary'>('pitch');
  const [openBehavioralIndex, setOpenBehavioralIndex] = useState<number | null>(0);
  const [openTechnicalIndex, setOpenTechnicalIndex] = useState<number | null>(0);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const { activeProfileId } = useProfile();

  useEffect(() => {
    loadJobs();
  }, [activeProfileId]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const allJobs = await fetchJobs();
      // Filter to jobs in interview stages
      const interviewStages = [
        'Recruiter Screen', 
        'Technical Round', 
        'Portfolio Presentation', 
        '2nd Interview', 
        'Final Round'
      ];
      const filtered = allJobs.filter((j: any) => interviewStages.includes(j.status));
      setJobs(filtered);
      if (filtered.length > 0) {
        setSelectedJob(filtered[0]);
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

  const copyToClipboard = (text: string, label: string = "Copied to clipboard!") => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto h-[calc(100vh-80px)] flex flex-col">
      
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold font-outfit text-foreground">Interview Hub</h2>
        <p className="text-text-muted mt-1">Access AI-generated command centers for your active interview processes.</p>
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
                    setActiveTab('pitch');
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
                        { id: 'pitch', label: 'Personalized Pitch', icon: Users },
                        { id: 'behavioral', label: 'STAR Behavioral', icon: Award },
                        { id: 'technical', label: 'Technical Q&A', icon: BookOpen },
                        { id: 'reverse', label: 'Reverse Questions', icon: Send },
                        { id: 'salary', label: 'Compensation Plan', icon: DollarSign }
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
                          <div className="p-8 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-card-border text-sm leading-relaxed text-slate-800 dark:text-slate-300 italic whitespace-pre-wrap">
                            "{selectedJob.interviewPrepData.pitch}"
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
                          
                          <div className="space-y-4">
                            {selectedJob.interviewPrepData.behavioralQuestions?.map((item, idx) => {
                              const isOpen = openBehavioralIndex === idx;
                              return (
                                <div key={idx} className="border border-card-border rounded-2xl overflow-hidden bg-black/[0.01] dark:bg-white/[0.01]">
                                  <button
                                    onClick={() => setOpenBehavioralIndex(isOpen ? null : idx)}
                                    className="w-full text-left p-5 flex justify-between items-center hover:bg-foreground/[0.02] transition-colors"
                                  >
                                    <span className="font-bold text-xs text-foreground flex items-center gap-3">
                                      <span className="text-amber-500">{idx + 1}.</span> {item.q}
                                    </span>
                                    {isOpen ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                                  </button>
                                  {isOpen && (
                                    <div className="p-6 border-t border-card-border bg-card text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap relative">
                                      <button 
                                        onClick={() => copyToClipboard(`Q: ${item.q}\n\nAnswer Guide:\n${item.a}`, "Copied Question & Answer guide!")}
                                        className="absolute right-4 top-4 text-text-muted hover:text-foreground"
                                        title="Copy Guide"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      {item.a}
                                    </div>
                                  )}
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

                          <div className="space-y-4">
                            {selectedJob.interviewPrepData.technicalQuestions?.map((item, idx) => {
                              const isOpen = openTechnicalIndex === idx;
                              return (
                                <div key={idx} className="border border-card-border rounded-2xl overflow-hidden bg-black/[0.01] dark:bg-white/[0.01]">
                                  <button
                                    onClick={() => setOpenTechnicalIndex(isOpen ? null : idx)}
                                    className="w-full text-left p-5 flex justify-between items-center hover:bg-foreground/[0.02] transition-colors"
                                  >
                                    <span className="font-bold text-xs text-foreground flex items-center gap-3">
                                      <span className="text-amber-500">{idx + 1}.</span> {item.q}
                                    </span>
                                    {isOpen ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                                  </button>
                                  {isOpen && (
                                    <div className="p-6 border-t border-card-border bg-card text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap relative">
                                      <button 
                                        onClick={() => copyToClipboard(`Q: ${item.q}\n\nAnswer Guide:\n${item.a}`, "Copied Question & Answer guide!")}
                                        className="absolute right-4 top-4 text-text-muted hover:text-foreground"
                                        title="Copy Guide"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      {item.a}
                                    </div>
                                  )}
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
                          
                          <div className="grid grid-cols-1 gap-4">
                            {selectedJob.interviewPrepData.reverseQuestions?.map((q, idx) => (
                              <div key={idx} className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-card-border flex gap-4 items-start">
                                <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/25 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <p className="text-xs text-foreground font-semibold leading-relaxed pt-0.5">{q}</p>
                              </div>
                            ))}
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
                          
                          <div className="p-8 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-card-border text-xs leading-relaxed text-slate-800 dark:text-slate-300 whitespace-pre-wrap font-medium">
                            {selectedJob.interviewPrepData.salaryNegotiation}
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
