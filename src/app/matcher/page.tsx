"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import { 
  Sparkles, 
  Search, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Target,
  BarChart3
} from "lucide-react";
import { analyzeJobMatch } from "@/lib/gemini";

export default function MatcherPage() {
  const [jdText, setJdText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{score: number, reason: string} | null>(null);

  const handleMatch = async () => {
    if (!jdText) return;
    setIsAnalyzing(true);
    // In real app, we'd pull the real resume from the store
    const mockResume = "Lea Wenban. Senior/Staff Product Designer. 15+ years experience. Enterprise systems, $100M+ GMV impact. Experts in UX Strategy, DesignOps, AI UX. Based near Lincoln/Nottingham.";
    
    try {
      const analysis = await analyzeJobMatch(mockResume, jdText);
      setResult(analysis);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold font-outfit">AI Matcher Sandbox</h2>
        <p className="text-slate-400 mt-1">Test how your profile scores against any job description in real-time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Input */}
        <div className="space-y-6">
          <div className="glass-card space-y-4">
            <div className="flex items-center gap-2 text-indigo-400">
              <Search className="w-5 h-5" />
              <h3 className="font-bold">Target Job Description</h3>
            </div>
            <textarea 
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              className="input-field w-full h-[450px] font-mono text-[11px] resize-none leading-relaxed bg-[#0d0d0f]"
              placeholder="Paste the job description here to see your match score..."
            />
            <button 
              onClick={handleMatch}
              disabled={isAnalyzing || !jdText}
              className="w-full btn-primary justify-center disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running AI Analysis...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Calculate Match Score
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {!result && !isAnalyzing ? (
            <div className="glass-card h-full flex flex-col items-center justify-center py-20 text-center space-y-4 border-dashed">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-700">
                <Target className="w-8 h-8" />
              </div>
              <div>
                <p className="font-bold text-slate-400">Analysis Pending</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Paste a job description on the left to see how your Staff Designer profile stacks up.
                </p>
              </div>
            </div>
          ) : isAnalyzing ? (
            <div className="glass-card space-y-8 animate-pulse">
              <div className="h-32 bg-white/5 rounded-2xl" />
              <div className="space-y-4">
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-4 bg-white/5 rounded w-1/2" />
                <div className="h-20 bg-white/5 rounded" />
              </div>
            </div>
          ) : result ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Score Card */}
              <div className="glass-card bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border-indigo-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <Sparkles className="w-12 h-12 text-indigo-500/20" />
                </div>
                <div className="relative">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Compatibility Score</p>
                  <div className="flex items-end gap-3">
                    <span className={`text-6xl font-bold font-outfit ${result.score > 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {result.score}%
                    </span>
                    <span className="text-slate-500 font-medium mb-2">Match</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full mt-6 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] ${result.score > 80 ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                      style={{ width: `${result.score}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Analysis Text */}
              <div className="glass-card space-y-4">
                <div className="flex items-center gap-2 text-slate-200">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-lg">AI Analysis Summary</h3>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5 leading-relaxed text-slate-300 italic">
                  "{result.reason}"
                </div>
              </div>

              {/* Action Toggles */}
              <div className="glass-card space-y-4">
                <h4 className="font-bold">Next Steps</h4>
                <div className="grid grid-cols-2 gap-4">
                  <button className="flex items-center justify-center gap-2 p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all text-sm font-medium">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Customize Resume
                  </button>
                  <button className="flex items-center justify-center gap-2 p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all text-sm font-medium">
                    <ArrowRight className="w-4 h-4" />
                    Apply Now
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
