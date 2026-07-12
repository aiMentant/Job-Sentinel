"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  User, 
  Key, 
  Search, 
  Briefcase, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  HelpCircle,
  BookOpen,
  Settings,
  Sparkles,
  ChevronRight,
  LayoutDashboard,
  KanbanSquare,
  Calendar
} from "lucide-react";

type HelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId: string;
  type: "setup" | "search";
};

export default function HelpModal({ isOpen, onClose, activeProfileId, type }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<"setup" | "tour" | "playbook">("setup");
  const [setupStep, setSetupStep] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (type === "search") {
        setActiveTab("tour");
      } else {
        setActiveTab("setup");
      }
      setSetupStep(1);
    }
  }, [type, isOpen]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (type === "setup" && typeof window !== "undefined") {
      localStorage.setItem(`job_sentinel_setup_shown_${activeProfileId}`, "true");
    }
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0c]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="glass-card w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden bg-card border-card-border p-6 shadow-2xl rounded-2xl relative z-10 animate-in zoom-in-95 duration-200">
        
        {/* Visual Banner Header */}
        <div className="relative w-full h-36 shrink-0 overflow-hidden rounded-xl mb-2 border border-card-border/60">
          <img 
            src="/guide_header_banner.jpg" 
            alt="Workspace Banner" 
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/35 to-transparent" />
          
          <div className="absolute bottom-4 left-4 right-4 md:right-auto bg-[#0d0e12]/90 backdrop-blur-md border border-card-border px-4 py-3 rounded-xl shadow-xl max-w-sm">
            <div className="flex items-center gap-1.5 mb-1.5 select-none">
              <div className="p-1 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-indigo-400">
                <HelpCircle className="w-3.5 h-3.5" />
              </div>
              <span className="text-[8px] font-black font-outfit text-indigo-400 uppercase tracking-widest">User Documentation</span>
            </div>
            <h2 className="text-sm font-extrabold font-outfit text-white uppercase tracking-wider leading-none select-none">Console Guide & Playbook</h2>
            <p className="text-[9px] text-text-muted mt-1.5 font-medium leading-none">Mastering modern setup, tour workflows, and strategy guides</p>
          </div>

          <button 
            onClick={onClose} 
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/60 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sticky Anchored Top Tabs */}
        <div className="flex border-b border-card-border/40 shrink-0 bg-background/20 mt-2">
          <button
            onClick={() => setActiveTab("setup")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center justify-center gap-2 ${
              activeTab === "setup" ? "text-indigo-500 font-extrabold" : "text-text-muted hover:text-foreground"
            }`}
          >
            <Settings className="w-4 h-4" />
            1. Setup Guide
            {activeTab === "setup" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab("tour")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center justify-center gap-2 ${
              activeTab === "tour" ? "text-indigo-500 font-extrabold" : "text-text-muted hover:text-foreground"
            }`}
          >
            <Search className="w-4 h-4" />
            2. Interface Tour
            {activeTab === "tour" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab("playbook")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center justify-center gap-2 ${
              activeTab === "playbook" ? "text-indigo-500 font-extrabold" : "text-text-muted hover:text-foreground"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            3. Job Playbook
            {activeTab === "playbook" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />}
          </button>
        </div>

        {/* Scrollable Content Pane */}
        <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-4 text-xs text-text-muted leading-relaxed">
          
          {/* TAB 1: SETUP GUIDE */}
          {activeTab === "setup" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                    {setupStep === 1 ? <User className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">
                      {setupStep === 1 ? "Step 1: Profiles & Target Settings" : "Step 2: Connecting LinkedIn"}
                    </h3>
                    <p className="text-[10px] text-text-muted">
                      {setupStep === 1 ? "Configure roles and locations for optimal local matching" : "Securely link your account to scan for jobs without interruption"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button 
                    disabled={setupStep === 1}
                    onClick={() => setSetupStep(1)}
                    className="p-1 rounded bg-foreground/5 hover:bg-foreground/10 disabled:opacity-40"
                    aria-label="Previous step"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    disabled={setupStep === 2}
                    onClick={() => setSetupStep(2)}
                    className="p-1 rounded bg-foreground/5 hover:bg-foreground/10 disabled:opacity-40"
                    aria-label="Next step"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {setupStep === 1 && (
                <div className="space-y-3">
                  <div className="p-4 bg-foreground/[0.02] border border-card-border rounded-xl space-y-3">
                    <h4 className="font-bold text-foreground text-[16px] uppercase tracking-wider">A Few Tips to Get Started:</h4>
                    <ul className="space-y-3 pl-1 text-[16px] md:text-[17px] text-text-muted">
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>Upload Your Resume</strong>: Head over to 
                          <a href="/profile" className="text-indigo-500 font-semibold hover:underline inline-flex items-center gap-0.5 ml-1">
                            Profile & Identity <ChevronRight className="w-3 h-3" />
                          </a>
                          to paste or upload your resume. Our AI scanner uses this text to find roles that match your unique skills. *(Quick tip: PDFs aren't supported just yet, so copy/paste raw text or upload a .txt or .docx file).*
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>Be Specific with Locations</strong>: List real cities or postal codes (like <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground font-semibold">Edgewater, FL</code> or <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground font-semibold">Orlando, FL</code>). Avoiding general regions helps us lock in on exactly where you want to work.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>Focusing on Local Jobs?</strong>: If you want to keep your search focused on local, hands-on work, leave out words like "Remote" or "Worldwide" from your locations list. This ensures we filter out far-away listings and focus strictly on your local area.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {setupStep === 2 && (
                <div className="space-y-3">
                  <div className="p-4 bg-amber-500/[0.03] border border-amber-500/20 rounded-xl">
                    <p className="text-amber-600 dark:text-amber-400 font-medium text-[16px] md:text-[17px]">
                      <strong>Why this helps</strong>: LinkedIn has strict checks that block automated searches. Adding your session cookie helps Job Sentinel run searches behind the scenes just like you would, avoiding roadblocks and keeping your daily scan active.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground text-[16px] uppercase tracking-wider">Step-by-Step Instructions:</h4>
                    <ol className="space-y-2.5 list-decimal pl-4 text-[16px] md:text-[17px] text-text-muted">
                      <li>Open a new browser tab, log in to <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="text-indigo-500 underline font-semibold">linkedin.com</a>, and stay on the page.</li>
                      <li>Right-click anywhere on the page and choose <strong>Inspect</strong> (or press <kbd className="bg-foreground/5 px-1 rounded">F12</kbd> on Windows / <kbd className="bg-foreground/5 px-1 rounded">Cmd + Option + I</kbd> on Mac).</li>
                      <li>Click the <strong>Application</strong> tab (Chrome/Edge/Brave) or the <strong>Storage</strong> tab (Safari/Firefox) at the top of the developer panel that opens up.</li>
                      <li>In the menu on the left, expand the <strong>Cookies</strong> section and click on <code className="text-foreground font-semibold">https://www.linkedin.com</code>.</li>
                      <li>Find the row named <strong><code className="text-indigo-500 font-bold">li_at</code></strong> (you can use the search bar to find it quickly). Double-click the value in the <strong>Value</strong> column and copy that entire text string.</li>
                      <li>Go to your 
                        <a href="/settings" className="text-indigo-500 font-semibold hover:underline inline-flex items-center gap-0.5 ml-1">
                          Settings <ChevronRight className="w-3 h-3" />
                        </a>, paste the value into the <strong>LinkedIn Cookie</strong> field, and click <strong>Save</strong>.
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INTERFACE TOUR */}
          {activeTab === "tour" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-[18px]">Interface Walkthrough</h3>
                  <p className="text-[14px] text-text-muted">A quick guide to finding your way around the Job Sentinel console</p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {/* 🏠 Dashboard */}
                <div className="space-y-4">
                  {/* Mock CSS Preview */}
                  <div className="bg-black/10 dark:bg-white/[0.02] border border-card-border/60 rounded-xl p-3 flex items-center justify-between text-[10px] w-full shadow-inner">
                    <div className="space-y-0.5">
                      <span className="text-[8px] uppercase tracking-wider text-text-muted block font-bold">Discovery Agent</span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-foreground font-semibold">Sync Completed</span>
                      </div>
                    </div>
                    {/* Tiny Progress Ring Mockup */}
                    <div className="relative w-8 h-8 flex items-center justify-center font-bold text-[9px] text-emerald-400">
                      <svg className="absolute w-full h-full transform -rotate-90">
                        <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500/10" fill="none"/>
                        <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500" strokeDasharray="81.68" strokeDashoffset="12.25" fill="none" strokeLinecap="round"/>
                      </svg>
                      85%
                    </div>
                  </div>
                  <div className="space-y-2 px-1">
                    <h4 className="font-bold text-foreground text-[16px] uppercase tracking-wider flex items-center gap-1.5">
                      <LayoutDashboard className="w-3.5 h-3.5 text-indigo-500" /> Dashboard
                    </h4>
                    <ul className="space-y-1.5 text-[16px] md:text-[17px] text-text-muted list-none pl-0">
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>Scraper Status</strong>: Monitor background automations and live sync runs.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>Top Matches</strong>: Review high-scoring matched roles the second you log in.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>Quick Ingest</strong>: Drop in a new resume version to update details instantly.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border-t border-card-border/30 w-full" />

                {/* 🔍 Job Search */}
                <div className="space-y-4">
                  {/* Mock CSS Preview */}
                  <div className="bg-black/10 dark:bg-white/[0.02] border border-card-border/60 rounded-xl p-3 flex items-center justify-between text-[10px] w-full shadow-inner">
                    <div className="space-y-0.5">
                      <span className="text-foreground font-semibold block truncate max-w-[180px]">Staff UX Researcher</span>
                      <span className="text-text-muted text-[8px] block">Universal Studios • Orlando, FL</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded text-[8px] flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-emerald-400" /> 92% Match
                      </span>
                      <span className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2 py-0.5 rounded text-[8px] cursor-pointer">Analyze</span>
                    </div>
                  </div>
                  <div className="space-y-2 px-1">
                    <h4 className="font-bold text-foreground text-[16px] uppercase tracking-wider flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-indigo-500" /> Job Search
                    </h4>
                    <ul className="space-y-1.5 text-[16px] md:text-[17px] text-text-muted list-none pl-0">
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>Standard Search</strong>: Query popular boards (LinkedIn, Indeed) in one list.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>Deep Web Search</strong>: Scan company career portals and ATS paths directly.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>AI Match Analysis</strong>: Score job posts against resume skills in real-time.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border-t border-card-border/30 w-full" />

                {/* 📋 Application Tracker */}
                <div className="space-y-4">
                  {/* Mock CSS Preview */}
                  <div className="bg-black/10 dark:bg-white/[0.02] border border-card-border/60 rounded-xl p-2.5 flex justify-between gap-2.5 text-[7px] font-bold tracking-wider text-text-muted select-none w-full shadow-inner">
                    <div className="flex-1 p-1.5 bg-foreground/[0.02] border border-dashed border-card-border rounded-md space-y-1 text-center">
                      <span className="uppercase text-[6px]">Triage</span>
                      <div className="h-4 bg-foreground/5 border border-card-border rounded flex items-center justify-center px-1.5 text-[5px] text-foreground font-semibold">Experian</div>
                    </div>
                    <div className="flex-1 p-1.5 bg-indigo-500/5 border border-indigo-500/20 rounded-md space-y-1 text-center">
                      <span className="uppercase text-[6px] text-indigo-400">Drafting</span>
                      <div className="h-4 bg-indigo-600 border border-indigo-500 text-white rounded flex items-center justify-between px-1.5 text-[5px] shadow-sm">
                        <span>Boots UK</span>
                        <span className="text-[4px] bg-white/20 px-1 rounded">Tailored</span>
                      </div>
                    </div>
                    <div className="flex-1 p-1.5 bg-foreground/[0.02] border border-dashed border-card-border rounded-md space-y-1 text-center">
                      <span className="uppercase text-[6px]">Applied</span>
                      <div className="h-4 bg-foreground/5 border border-card-border rounded" />
                    </div>
                  </div>
                  <div className="space-y-2 px-1">
                    <h4 className="font-bold text-foreground text-[16px] uppercase tracking-wider flex items-center gap-1.5">
                      <KanbanSquare className="w-3.5 h-3.5 text-indigo-500" /> Application Tracker
                    </h4>
                    <ul className="space-y-1.5 text-[16px] md:text-[17px] text-text-muted list-none pl-0">
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>Track Your Jobs</strong>: Star matching roles to map them directly to your board.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>Tailor Materials</strong>: Generate structured resume alignment bullets instantly.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>Anti-Detection</strong>: Scrub generated drafts of AI footprints and templates.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border-t border-card-border/30 w-full" />

                {/* 🗓️ Interview Hub */}
                <div className="space-y-4">
                  {/* Mock CSS Preview */}
                  <div className="bg-black/10 dark:bg-white/[0.02] border border-card-border/60 rounded-xl p-3 flex items-center gap-3 text-[9px] w-full shadow-inner">
                    <div className="w-8 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-center font-bold">
                      <span className="text-indigo-400 text-[6px] uppercase tracking-wider block leading-none">Jul</span>
                      <span className="text-[16px] md:text-[17px] text-indigo-400 block leading-tight">14</span>
                    </div>
                    <div className="flex-1 space-y-0.5 truncate">
                      <span className="text-foreground font-semibold block leading-tight truncate">Technical Round</span>
                      <span className="text-[8px] text-text-muted block leading-none">Boots UK • 10:00 AM</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping shrink-0" />
                  </div>
                  <div className="space-y-2 px-1">
                    <h4 className="font-bold text-foreground text-[16px] uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Interview Hub
                    </h4>
                    <ul className="space-y-1.5 text-[16px] md:text-[17px] text-text-muted list-none pl-0">
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>Stay Organized</strong>: Catalog follow-up sequences and live calls.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5 font-bold shrink-0">•</span>
                        <span><strong>Prep Mode</strong>: Draft custom elevator pitches and reverse questions.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JOB PLAYBOOK */}
          {activeTab === "playbook" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base md:text-lg">The Hiring Director's Playbook</h3>
                  <p className="text-xs md:text-sm text-text-muted">A candid, chapter-by-chapter guide to navigating the modern job market</p>
                </div>
              </div>

              <div className="space-y-5 max-h-[46vh] overflow-y-auto pr-2 text-text-muted text-[16px] md:text-[17px] leading-relaxed">
                
                {/* 1. The Illusion of the Pipeline */}
                <div className="space-y-2 px-1">
                  <h4 className="font-bold text-foreground text-[16px] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Chapter I: The Illusion of the Pipeline
                  </h4>
                  <p>
                    Let's address the elephant in the recruiting room: not every job post you see is a real ticket to an interview. Over my years directing HR teams, I've watched companies leave <em>"Ghost Jobs"</em> active for months, not to hire, but to project growth to board members or collect resumes for a rainy day. 
                  </p>
                  <p>
                    Worse, we cast what I call <em>"hybrid nets."</em> We post a single position across five different cities to capture local commuters, even if the team is based hundreds of miles away. Don't waste your energy shouting into these empty rooms. 
                  </p>
                  <p className="text-indigo-400 font-medium italic">
                    💡 The Director's Note: Focus your precious energy on fresh listings posted within the last 3 to 7 days. Use Job Sentinel's "Auto-Catchup" scope to find active postings, and check the proximity of Hybrid roles to make sure the commute is realistic before you invest your heart into the application.
                  </p>
                </div>

                <div className="border-t border-card-border/30 w-full" />

                {/* 2. The Secret Language of Bots */}
                <div className="space-y-2 px-1">
                  <h4 className="font-bold text-foreground text-[16px] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Chapter II: The Secret Language of Bots
                  </h4>
                  <p>
                    Everyone worries about the Applicant Tracking System (ATS)—the legendary bot blocking the door. But here is the secret: the bot is just an automated librarian. It reads your resume looking for a clear, logical thread that connects your target titles, skills, and accomplishments back to our job description.
                  </p>
                  <p>
                    Yet, so many candidates try to trick the librarian by stuffing their resumes with a soup of disconnected buzzwords. Yes, the bot might pass it, but when it lands on my desk, it feels cold, lifeless, and mechanical. I discard those immediately. You need to speak the bot's language without losing your human voice.
                  </p>
                  <p className="text-indigo-400 font-medium italic">
                    💡 The Director's Note: When tailoring your resume in the Compare Editor, keep your cadence natural and storytelling. Use the STAR framework (Situation, Task, Action, Result) to weave those critical keywords into real human stories of impact, rather than just listing them in a block.
                  </p>
                </div>

                <div className="border-t border-card-border/30 w-full" />

                {/* 3. The Story Behind the Resume */}
                <div className="space-y-2 px-1">
                  <h4 className="font-bold text-foreground text-[16px] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Chapter III: The Story Behind the Resume
                  </h4>
                  <p>
                    Whenever a resume catches my eye, my next step is always the same: I open their LinkedIn profile. In a perfect world, they tell the same story. But all too often, I see a jarring disconnect. The job titles don't align, the dates are completely different, or their skills list looks like it hasn't been updated since 2018. 
                  </p>
                  <p>
                    Instantly, a red flag goes up. Is this candidate exaggerating their experience? Your online presence is the evidence that supports your resume. If your headline reads like a generic placeholder (like <em>"Designer"</em> rather than <em>"Product Designer | Specializing in UX/UI"</em>), you become invisible to recruiters sourcing talent.
                  </p>
                  <p className="text-indigo-400 font-medium italic">
                    💡 The Director's Note: Make sure your LinkedIn profile matches your tailored resume's core message. Pay extra attention to your top 5 skills—they should align directly with the target roles you've highlighted in your Job Sentinel profile.
                  </p>
                </div>

                <div className="border-t border-card-border/30 w-full" />

                {/* 4. Leapfrogging the Queue */}
                <div className="space-y-2 px-1">
                  <h4 className="font-bold text-foreground text-[16px] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Chapter IV: Leapfrogging the Queue
                  </h4>
                  <p>
                    Let's be honest: submitting your resume through a portal is like dropping a letter into a black hole. But if Job Sentinel shows you have an 85% or higher match score, you aren't just another applicant. You are the exact solution to my team's headache.
                  </p>
                  <p>
                    Don't wait for the portal to find you. Take the lead. Find the recruiter or hiring manager on LinkedIn and send a concise, professional, 300-character message. Tell them you've applied, reference the job, and point out the exact overlap in your skills. It breaks you out of the pile and forces a human to look at your application.
                  </p>
                  <p className="text-indigo-400 font-medium italic">
                    💡 The Director's Note: In the Submission Log, use the "Generate Materials" tool to get a highly targeted, pre-written LinkedIn message hook. Customize it, send it, and watch how quickly you can bypass a stack of hundreds of other applicants.
                  </p>
                </div>

                <div className="border-t border-card-border/30 w-full" />

                {/* 5. The Director's Red Flags */}
                <div className="space-y-2 px-1 pb-2">
                  <h4 className="font-bold text-rose-500 text-[16px] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Chapter V: The Director’s Red Flags
                  </h4>
                  <p>
                    To round out our playbook, let's look at the absolute dealbreakers that make recruiters press "Reject" without a second thought:
                  </p>
                  <ul className="space-y-2.5 list-disc pl-4 text-text-muted mt-1">
                    <li>
                      <strong>The "Spray & Pray" Habit</strong>: Sending 100 generic resumes hoping something sticks. We can spot a copy-paste job in three seconds. Five highly tailored applications will always yield better results than a hundred lazy ones.
                    </li>
                    <li>
                      <strong>Raw AI Prints</strong>: Resumes and cover letters littered with robotic filler words like <em>"delve," "moreover," "testament,"</em> or <em>"furthermore."</em> It shows me you let a machine do the thinking and didn't even bother to read it over.
                    </li>
                    <li>
                      <strong>The Silent Treatment</strong>: Assuming the job application portal is a vending machine—you pull the lever and wait for the prize. Without active follow-up, you're just a name on a spreadsheet.
                    </li>
                    <li>
                      <strong>The Ghost Profile</strong>: A polished resume backed by a LinkedIn profile with no picture, no description, and zero connections. It feels artificial, like a bot-generated identity.
                    </li>
                  </ul>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer Controls */}
        <div className="flex justify-between items-center pt-4 border-t border-card-border/60 mt-4 shrink-0">
          <div>
            {type === "setup" && (
              <button
                onClick={handleDismiss}
                className="text-[10px] text-text-muted hover:text-foreground font-semibold uppercase tracking-wider cursor-pointer"
              >
                Don't show again
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {activeTab === "tour" && (
              <button
                onClick={() => setActiveTab("setup")}
                className="btn-secondary py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Setup
              </button>
            )}
            {activeTab === "playbook" && (
              <button
                onClick={() => setActiveTab("tour")}
                className="btn-secondary py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Tour
              </button>
            )}

            {activeTab === "setup" && (
              <button
                onClick={() => setActiveTab("tour")}
                className="btn-primary py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                Next to Tour <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {activeTab === "tour" && (
              <button
                onClick={() => setActiveTab("playbook")}
                className="btn-primary py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                Next to Playbook <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {activeTab === "playbook" && (
              <button
                onClick={handleDismiss}
                className="btn-primary py-1.5 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 cursor-pointer"
              >
                {type === "setup" ? "Complete Setup" : "Dismiss Guide"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
