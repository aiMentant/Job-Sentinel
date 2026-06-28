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
  HelpCircle
} from "lucide-react";

type HelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId: string;
  type: "setup" | "search";
};

export default function HelpModal({ isOpen, onClose, activeProfileId, type }: HelpModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen) return null;

  const totalSteps = 2;

  const handleDismiss = () => {
    if (type === "setup" && typeof window !== "undefined") {
      localStorage.setItem(`job_sentinel_setup_shown_${activeProfileId}`, "true");
    }
    onClose();
  };

  const handleNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const titleText = type === "setup" ? "Account Setup Guide" : "Job Search & AI Guide";

  const modalContent = (
    <div className="fixed inset-0 z-[9999] p-5 bg-[#0a0a0c]/80 backdrop-blur-sm animate-in fade-in duration-200 flex">
      <div className="glass-card w-full h-full relative z-10 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden bg-card border-card-border p-6 shadow-2xl rounded-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-card-border/60 shrink-0">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-black font-outfit text-foreground uppercase tracking-wider">{titleText}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-foreground/5 text-text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step progress within active tab */}
        <div className="w-full bg-foreground/10 h-1 rounded-full overflow-hidden my-4 shrink-0 flex">
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
          
          {/* TYPE 1: ACCOUNT SETUP */}
          {type === "setup" && (
            <>
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">Step 1 of 2: Profile & Target Configurations</h3>
                      <p className="text-xs text-text-muted">Configure roles and locations for optimal local matching</p>
                    </div>
                  </div>

                  <div className="p-4 bg-foreground/[0.02] border border-card-border rounded-xl space-y-3">
                    <h4 className="font-bold text-foreground text-xs uppercase tracking-wide">Onboarding Guidelines:</h4>
                    <ul className="space-y-3 text-xs text-text-muted">
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>ATS Resume Upload</strong>: Go to <strong>Profile & Identity</strong> and paste or upload your resume text. The AI discovery engine scans this text to evaluate your alignment score. Note that PDFs are not parsed—please use raw text, TXT, or DOCX formats.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>Target Locations</strong>: Specify precise values like <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground font-semibold">Edgewater, FL</code> or <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground font-semibold">Orlando, FL</code>. Do not use generic placeholders.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>Location Guardrail</strong>: If you are searching strictly for on-site/hands-on local roles, <strong>do not</strong> add the word <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground font-semibold">Remote</code> or <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground font-semibold">Worldwide</code> to your Target Locations list. Leaving these out ensures the location boundary filter discards foreign listings.</span>
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
                      <h3 className="font-bold text-foreground text-sm">Step 2 of 2: Stealth LinkedIn Cookie Setup</h3>
                      <p className="text-xs text-text-muted">Avoid crawler blocks by adding your session token</p>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-500/[0.03] border border-amber-500/20 rounded-xl">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <strong>Why this is mandatory:</strong> Standard scrapers get blocked by security check walls when searching without authentication. Saving your session cookie lets the automated scan run stealthily on your behalf.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-xs uppercase tracking-wide">Step-by-Step Instructions:</h4>
                    <ol className="space-y-3.5 text-xs text-text-muted list-decimal pl-4">
                      <li>
                        Open a new browser tab, go to <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="text-indigo-500 underline font-semibold">linkedin.com</a>, and make sure you are logged in.
                      </li>
                      <li>
                        Right-click anywhere on the page and select <strong>Inspect</strong> (or hit <kbd className="bg-foreground/5 px-1 rounded">F12</kbd>).
                      </li>
                      <li>
                        Select the <strong>Application</strong> tab (Chrome/Edge) or <strong>Storage</strong> tab (Safari) at the top of the inspector panel.
                      </li>
                      <li>
                        Under the <strong>Cookies</strong> drop-down menu on the left side, click on <code className="text-foreground">https://www.linkedin.com</code>.
                      </li>
                      <li>
                        Find the row named <strong><code className="text-indigo-500 font-bold">li_at</code></strong>. Double-click the cell in the <strong>Value</strong> column and copy the full text string.
                      </li>
                      <li>
                        Navigate to <strong>Profile & Identity</strong> in this dashboard, paste the value into the <strong>LinkedIn Cookie</strong> field, and click **Save**.
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TYPE 2: SEARCH & VETTING GUIDE */}
          {type === "search" && (
            <>
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                      <Search className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">Step 1 of 2: Core Search & Tracker Pages</h3>
                      <p className="text-xs text-text-muted">Discover roles and manage your active application pipeline</p>
                    </div>
                  </div>

                  <div className="p-4 bg-foreground/[0.02] border border-card-border rounded-xl space-y-4 text-xs text-text-muted">
                    <div>
                      <h5 className="font-black text-foreground text-xs uppercase tracking-wider mb-1">🏠 Dashboard</h5>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><strong>Scraper Status</strong>: View countdowns for background sweeps and active crawls.</li>
                        <li><strong>Top Matches</strong>: Review high-scoring matches immediately on login.</li>
                        <li><strong>Quick Ingest</strong>: Drop in a new resume text file to update your background references instantly.</li>
                      </ul>
                    </div>

                    <div className="border-t border-card-border/60 pt-3">
                      <h5 className="font-black text-foreground text-xs uppercase tracking-wider mb-1">🔍 Job Search</h5>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><strong>Standard Search</strong>: Scan job aggregators like LinkedIn/Indeed directly.</li>
                        <li><strong>Deep Web Search</strong>: Query Google syntax to scrape careers pages directly from employer sites.</li>
                        <li><strong>AI Match Analysis</strong>: Click the green **AI Analyze All** button to vet descriptions against your resume, calculate fit scores (0-100%), and flag Ghost or Harvesting listings.</li>
                      </ul>
                    </div>

                    <div className="border-t border-card-border/60 pt-3">
                      <h5 className="font-black text-foreground text-xs uppercase tracking-wider mb-1">📋 Application Tracker</h5>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><strong>Move to Board</strong>: Click the Star icon on any job in Search to move it to the Kanban columns.</li>
                        <li><strong>Tailor Materials</strong>: Click any card on the board to auto-generate personalized cover letters and recruiter outreach messages in one click.</li>
                        <li><strong>Anti-Detection</strong>: All generated text is dynamically vetted to strip out typical AI buzzwords.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">Step 2 of 2: Management & Settings Pages</h3>
                      <p className="text-xs text-text-muted">Track scheduled calls, configure parameters, and review logs</p>
                    </div>
                  </div>

                  <div className="p-4 bg-foreground/[0.02] border border-card-border rounded-xl space-y-4 text-xs text-text-muted">
                    <div>
                      <h5 className="font-black text-foreground text-xs uppercase tracking-wider mb-1">🗓 Interview Hub</h5>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><strong>Schedule Tracking</strong>: Track meeting dates, rounds (screen, technical, panel), and follow-ups.</li>
                        <li><strong>Preparation</strong>: Record mock notes and contact details for each recruiter.</li>
                      </ul>
                    </div>

                    <div className="border-t border-card-border/60 pt-3">
                      <h5 className="font-black text-foreground text-xs uppercase tracking-wider mb-1">✅ Profile & Identity</h5>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><strong>Role Parameters</strong>: Add target titles, location abbreviations (e.g. `Edgewater, FL`), and radius limits.</li>
                        <li><strong>Cookies & API Keys</strong>: Input your LinkedIn session cookie and add custom Gemini keys.</li>
                      </ul>
                    </div>

                    <div className="border-t border-card-border/60 pt-3">
                      <h5 className="font-black text-foreground text-xs uppercase tracking-wider mb-1">📄 Submission Log</h5>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><strong>Historical Log</strong>: Review a full list of all submitted applications, companies, and date stamps.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer Controls */}
        <div className="flex justify-between items-center pt-4 border-t border-card-border/60 mt-4 shrink-0">
          <div>
            {type === "setup" && (
              <button
                onClick={handleDismiss}
                className="text-xs text-text-muted hover:text-foreground font-semibold uppercase tracking-wider cursor-pointer"
              >
                Don't show again
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="btn-secondary py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                className="btn-primary py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleDismiss}
                className="btn-primary py-1.5 px-4 rounded-lg text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 cursor-pointer"
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
