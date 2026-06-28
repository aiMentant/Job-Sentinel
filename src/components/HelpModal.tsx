"use client";

import React, { useState } from "react";
import { 
  X, 
  User, 
  Key, 
  Search, 
  Briefcase, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  HelpCircle
} from "lucide-react";

type HelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId: string;
};

export default function HelpModal({ isOpen, onClose, activeProfileId }: HelpModalProps) {
  const [currentStep, setCurrentStep] = useState(1);

  if (!isOpen) return null;

  const totalSteps = 4;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`job_sentinel_setup_shown_${activeProfileId}`, "true");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 p-[2px] bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 flex">
      <div className="glass-card w-full h-full relative z-10 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden bg-card border-card-border p-6 shadow-2xl rounded-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-card-border/60 shrink-0">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-black font-outfit text-foreground uppercase tracking-wider">Setup & User Guide</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-foreground/5 text-text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-foreground/10 h-1.5 rounded-full overflow-hidden my-4 shrink-0 flex">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div 
              key={idx}
              className={`h-full flex-1 transition-all duration-300 ${
                idx + 1 <= currentStep ? "bg-indigo-500" : "bg-transparent"
              } ${idx > 0 ? "border-l border-card" : ""}`}
            />
          ))}
        </div>

        {/* Step Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 text-sm leading-relaxed space-y-4 py-2">
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Step 1: Profile & Target Configurations</h3>
                  <p className="text-xs text-text-muted">Configure roles and locations for optimal local matching</p>
                </div>
              </div>

              <div className="p-4 bg-foreground/[0.02] border border-card-border rounded-xl space-y-3">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wide">Guidelines:</h4>
                <ul className="space-y-2.5 text-xs text-text-muted">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>ATS Resume (TXT/DOCX only)</strong>: Go to <strong>Profile & Identity</strong> and upload your resume. The AI uses this text to analyze matching fit. (PDFs are not supported).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Target Locations</strong>: Enter precise locations like <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground font-semibold">Edgewater, FL</code> or <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground font-semibold">London, UK</code>. Avoid generic placeholders.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Remote Flagging</strong>: If you are looking for local on-site/hands-on roles, <strong>do not</strong> include the word <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground font-semibold">Remote</code> or <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground font-semibold">Worldwide</code> in your Target Locations. This ensures the guardrail excludes foreign listings.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Step 2: Stealth LinkedIn Cookie Setup</h3>
                  <p className="text-xs text-text-muted">Pass authentication walls to enable automated background scans</p>
                </div>
              </div>

              <div className="p-4 bg-amber-500/[0.03] border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  <strong>Why this is needed:</strong> Standard servers get blocked by LinkedIn login screens. Saving a session cookie allows the agent to search stealthily on your behalf.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wide">How to find your cookie:</h4>
                <ol className="space-y-3 text-xs text-text-muted list-decimal pl-4">
                  <li>
                    Open a new tab in your browser and go to <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="text-indigo-500 underline font-semibold">linkedin.com</a> (make sure you are signed in).
                  </li>
                  <li>
                    Right-click anywhere on the page and select <strong>Inspect</strong> (or press <kbd className="bg-foreground/5 px-1 rounded">F12</kbd>) to open Developer Tools.
                  </li>
                  <li>
                    Navigate to the <strong>Application</strong> tab (Chrome/Edge) or <strong>Storage</strong> tab (Safari).
                  </li>
                  <li>
                    In the left menu under <strong>Cookies</strong>, click on <code className="text-foreground">https://www.linkedin.com</code>.
                  </li>
                  <li>
                    Find the cookie named <strong><code className="text-indigo-500 font-bold">li_at</code></strong> and double-click its <strong>Value</strong> to copy it.
                  </li>
                  <li>
                    Go to <strong>Profile & Identity</strong> in this app, paste it into the <strong>LinkedIn Cookie</strong> field, and click Save.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Step 3: Stealth Search & AI Rating</h3>
                  <p className="text-xs text-text-muted">Find matching roles and analyze them in bulk</p>
                </div>
              </div>

              <div className="p-4 bg-foreground/[0.02] border border-card-border rounded-xl space-y-3.5 text-xs text-text-muted">
                <div>
                  <h5 className="font-bold text-foreground mb-1">Standard vs. Deep Web Mode:</h5>
                  <p><strong>Standard Mode</strong> searches major aggregators (LinkedIn, Indeed, ZipRecruiter) directly. <strong>Deep Web Mode</strong> scans Google using filters to identify hidden listings hosted directly on employer career pages.</p>
                </div>
                <div className="border-t border-card-border/60 pt-3">
                  <h5 className="font-bold text-foreground mb-1">AI Match Vetting:</h5>
                  <p>Newly crawled jobs start as pending. Click the unhidden green <strong>"AI Analyze All"</strong> button in the top right to analyze all visible listings with Gemini AI in sequence. This scores match relevance and flags Ghost/Harvest postings.</p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Step 4: Pipeline Tracking & AI Tailoring</h3>
                  <p className="text-xs text-text-muted">Manage applications and optimize your resume/cover letters</p>
                </div>
              </div>

              <div className="p-4 bg-foreground/[0.02] border border-card-border rounded-xl space-y-3 text-xs text-text-muted">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                  <p><strong>Move to Pipeline</strong>: Star a job in Search to move it to the <strong>Application Tracker</strong> board.</p>
                </div>
                <div className="flex items-start gap-2 border-t border-card-border/60 pt-3">
                  <span className="w-4 h-4 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                  <p><strong>AI Customization</strong>: Click on any job card in the tracker to auto-generate personalized cover letters, recruiter messages, and resume suggestions tailored to that specific job description with AI bypass rules enabled.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex justify-between items-center pt-4 border-t border-card-border/60 mt-4 shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-text-muted hover:text-foreground font-semibold uppercase tracking-wider cursor-pointer"
          >
            Don't show again
          </button>
          
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="btn-secondary py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="btn-primary py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleDismiss}
                className="btn-primary py-1.5 px-4 rounded-lg text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 cursor-pointer"
              >
                Complete Setup
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
