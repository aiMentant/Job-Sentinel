"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Key, 
  Mail, 
  Shield, 
  Database, 
  Globe, 
  Bell, 
  Trash2, 
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Lock,
  Unlock
} from "lucide-react";
import { fetchUserProfile, patchUserProfile, testApiKey } from "@/app/actions/jobActions";
import { useProfile } from "@/components/ProfileContext";

export default function SettingsPage() {
  const { activeProfileId } = useProfile();
  const [apiKey, setApiKey] = useState("");
  const [preferredModel, setPreferredModel] = useState("gemini-2.0-flash");
  const [stealthMode, setStealthMode] = useState(true);
  const [linkedinCookie, setLinkedinCookie] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showCookie, setShowCookie] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: "" });
  
  // Validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ success: boolean | null; message: string }>({ success: null, message: "" });

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const profile = await fetchUserProfile();
        if (profile) {
          setApiKey(profile.geminiApiKey || "");
          setPreferredModel(profile.preferredModel || "gemini-2.0-flash");
          setStealthMode(profile.linkedinStealth ?? true);
          setLinkedinCookie(profile.linkedinCookie || "");
        } else {
          setApiKey("");
          setPreferredModel("gemini-2.0-flash");
          setStealthMode(true);
          setLinkedinCookie("");
        }
      } catch (error: any) {
        console.error("Failed to load settings profile:", error);
        setSaveStatus({ type: 'error', message: `Database error: ${error.message || error}` });
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, [activeProfileId]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveStatus({ type: null, message: "" });
    try {
      const res = await patchUserProfile({
        geminiApiKey: apiKey,
        preferredModel: preferredModel,
        linkedinStealth: stealthMode,
        linkedinCookie: linkedinCookie
      }, activeProfileId);
      if (res.success) {
        setSaveStatus({ type: 'success', message: "Configuration securely saved." });
        setTimeout(() => setSaveStatus({ type: null, message: "" }), 4000);
      } else {
        setSaveStatus({ type: 'error', message: res.error || "Failed to save configuration." });
      }
    } catch (e: any) {
      setSaveStatus({ type: 'error', message: e.message || "Failed to save configuration." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidateKey = async () => {
    if (!apiKey) {
      setValidationResult({ success: false, message: "Please input an API key first." });
      return;
    }
    setIsValidating(true);
    setValidationResult({ success: null, message: "" });
    
    const result = await testApiKey(apiKey, preferredModel);
    setValidationResult({
      success: result.success,
      message: result.message
    });
    setIsValidating(false);
  };

  if (isLoading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className="text-text-muted font-medium animate-pulse">Loading identity settings...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold font-outfit text-foreground">Agent Settings</h2>
          <p className="text-text-muted mt-1">Configure your custom AI models, API authentication, and execution modes.</p>
        </div>
        
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="btn-primary py-2 px-6 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save Configuration
            </>
          )}
        </button>
      </div>

      {saveStatus.type && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border animate-in slide-in-from-top-2 duration-300 ${
          saveStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {saveStatus.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <p className="text-sm font-medium">{saveStatus.message}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* API Configurations */}
        <section className="glass-card space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400">
              <Key className="w-5 h-5" />
              <h3 className="font-bold text-lg text-foreground">AI Engine & Platform Credentials</h3>
            </div>
            <span className="text-[9px] uppercase font-bold tracking-widest text-text-muted bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
              Secure Local Storage
            </span>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Google Gemini API Key</label>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"
                  >
                    Get Free Key <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                
                <div className="relative">
                  <input 
                    type={showKey ? "text" : "password"} 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="input-field w-full text-sm pr-10 font-mono tracking-wide" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-4 top-3 text-text-muted hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Active Model Tier</label>
                <select 
                  value={preferredModel}
                  onChange={(e) => setPreferredModel(e.target.value)}
                  className="input-field w-full text-sm appearance-none bg-slate-900 border-white/5"
                >
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fastest / Recommended)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Standard)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (High Precision)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 pt-2">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-text-muted uppercase font-bold tracking-widest">LinkedIn Session Cookie (li_at)</label>
                    <span className="text-[8px] font-bold px-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">Session Token Bypass</span>
                  </div>
                  <span className="text-[9px] text-text-muted">Ex: AQEDAT... (inspect cookies on linkedin.com to copy)</span>
                </div>
                
                <div className="relative">
                  <input 
                    type={showCookie ? "text" : "password"} 
                    value={linkedinCookie} 
                    onChange={(e) => setLinkedinCookie(e.target.value)}
                    placeholder="Paste your 'li_at' cookie here..."
                    className="input-field w-full text-sm pr-10 font-mono tracking-wide" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookie(!showCookie)}
                    className="absolute right-4 top-3 text-text-muted hover:text-foreground transition-colors"
                  >
                    {showCookie ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Inline validation checker */}
            <div className="pt-2 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white/[0.01] p-4 rounded-xl border border-white/5">
              <div>
                <p className="text-xs font-bold text-foreground">Validate AI Integration</p>
                <p className="text-[10px] text-text-muted mt-0.5">Test if the customized API key can connect to Google AI Studio.</p>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                {validationResult.success !== null && (
                  <span className={`text-xs font-medium flex items-center gap-1.5 ${
                    validationResult.success ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {validationResult.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {validationResult.message}
                  </span>
                )}
                
                <button
                  type="button"
                  onClick={handleValidateKey}
                  disabled={isValidating}
                  className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-text-muted text-xs font-bold rounded-lg border border-white/10 transition-all flex items-center gap-2"
                >
                  {isValidating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Test Connection
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">LinkedIn Stealth Authentication</p>
                    <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Stealth Mode
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5">Automate job searches and descriptions using our anti-bot stealth parameters.</p>
                </div>
                
                <button
                  type="button"
                  onClick={() => setStealthMode(!stealthMode)}
                  className={`w-10 h-5 rounded-full relative transition-all duration-300 cursor-pointer ${
                    stealthMode ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${
                    stealthMode ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Email Monitoring */}
        <section className="glass-card space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <Mail className="w-5 h-5" />
              <h3 className="font-bold text-lg text-foreground">Email Inbox Monitoring</h3>
            </div>
            <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
              Addon
            </span>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-text-muted leading-relaxed">
              Connect a dedicated job search email address to allow the agent to automatically scan recruiter replies, index interview requests, and coordinate application status updates.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-sm font-bold text-text-muted">
                <Globe className="w-4 h-4 text-text-muted" />
                Connect Google Workspace / Gmail
              </button>
              <button className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-sm font-bold text-text-muted">
                <Mail className="w-4 h-4 text-text-muted" />
                Configure Custom IMAP Server
              </button>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="glass-card space-y-6">
           <div className="flex items-center gap-2 text-purple-400">
            <Database className="w-5 h-5" />
            <h3 className="font-bold text-lg text-foreground">Identity Database & Data Portability</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all text-left space-y-1">
              <p className="text-sm font-bold text-foreground">Export Application History</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">CSV or Structured JSON Format</p>
            </button>
            <button className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all text-left space-y-1">
              <p className="text-sm font-bold text-foreground">Local Database Backup</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Download SQLite package (.sqlite)</p>
            </button>
          </div>

          <div className="pt-4 border-t border-white/5">
            <button className="text-xs font-bold text-red-500/70 hover:text-red-500 flex items-center gap-2 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Reset Sentinel & Permanently Purge All Data
            </button>
          </div>
        </section>
      </div>

      <div className="text-center pt-4">
        <p className="text-[9px] text-text-muted font-black tracking-widest uppercase flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3 text-text-muted" />
          Job Sentinel v1.0.0 &bull; Powered by Gemini 2.0 &bull; Built for Lea Wenban
        </p>
      </div>
    </div>
  );
}
