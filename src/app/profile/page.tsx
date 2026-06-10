"use client";

import React, { useState, useEffect } from "react";
import { 
  Save, 
  FileText, 
  Settings,
  MapPin, 
  Plus, 
  Trash2, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Building2,
  GraduationCap
} from "lucide-react";
import { parseResumeText, saveUserProfile, fetchUserProfile, listAllProfilesWithData, deleteProfile } from "@/app/actions/jobActions";

import { getActiveProfileId, setActiveProfileId } from "@/app/actions/profileSwitch";
import { findRoleFit, upgradeBullets } from "@/app/actions/careerTools";
import { UserProfile, WorkExperience, Education, QuickAnswer, SalaryExpectations } from "@/lib/db";

export default function ProfilePage() {
  const [resumeText, setResumeText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [expandedSection, setExpandedSection] = useState<string | null>("experience");
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [profiles, setProfiles] = useState<{id: string, fullName: string, targetTitle?: string}[]>([]);

  const [activeId, setActiveId] = useState("default");
  // Career Tools state
  const [isRewriting, setIsRewriting] = useState(false);
  const [isFindingRoles, setIsFindingRoles] = useState(false);
  const [upgradingBulletIdx, setUpgradingBulletIdx] = useState<number | null>(null);
  const [aiResultModal, setAiResultModal] = useState<{ title: string; content: string } | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);



  useEffect(() => {
    async function loadData() {
      const pId = await getActiveProfileId();
      setActiveId(pId);
      
      const all = await listAllProfilesWithData();
      setProfiles(all);

      const savedProfile = await fetchUserProfile();
      if (savedProfile) {
        setProfile(savedProfile);
        if (savedProfile.resumeText) setResumeText(savedProfile.resumeText);
      } else {
        setProfile({});
        setResumeText("");
      }
    }
    loadData();
  }, [activeId]);

  const handleSwitchProfile = async (id: string) => {
    await setActiveProfileId(id);
    setActiveId(id);
  };

  const handleCreateProfile = async () => {
    const name = prompt("Enter a name for the new profile:");
    if (name) {
      const id = name.toLowerCase().replace(/\s+/g, '-');
      await handleSwitchProfile(id);
      const all = await listAllProfilesWithData();
      setProfiles(all);
    }
  };
  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;
    try {
      await deleteProfile(profileToDelete);
      setProfileToDelete(null);
      const pId = await getActiveProfileId();
      setActiveId(pId);
      const all = await listAllProfilesWithData();
      setProfiles(all);
      setStatus("Identity successfully removed.");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus("Saving profile to local database...");
    const profileToSave = { ...profile, resumeText };
    await saveUserProfile(profileToSave);
    setStatus("Profile securely saved.");
    setIsSaving(false);
  };

  const handleParse = async () => {
    if (!(profile as any).geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      setStatus("Parse failed: API Key missing.");
      return;
    }
    if (!resumeText) return;
    setIsParsing(true);
    try {
      const data = await parseResumeText(resumeText);
      if (Object.keys(data).length === 0 || (!data.fullName && !data.experience?.length)) {
        setStatus("AI found no structured data. Try a different format.");
      } else {
        setProfile(data);
        setStatus("Parse successful. Review and edit on the right.");
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to parse resume. Check your API key connection.");
      setStatus(error.message || "Failed to parse resume.");
    } finally {
      setIsParsing(false);
    }
  };

  const updateExperience = (index: number, field: keyof WorkExperience, value: any) => {
    const newExp = [...(profile.experience || [])];
    newExp[index] = { ...newExp[index], [field]: value };
    setProfile({ ...profile, experience: newExp });
  };

  const updateEducation = (index: number, field: keyof Education, value: any) => {
    const newEdu = [...(profile.education || [])];
    newEdu[index] = { ...newEdu[index], [field]: value };
    setProfile({ ...profile, education: newEdu });
  };

  const removeArrayItem = (field: 'skills' | 'targetTitles' | 'targetLocations', index: number) => {
    const arr = [...(profile[field] || [])];
    arr.splice(index, 1);
    setProfile({ ...profile, [field]: arr });
  };

  const addArrayItem = (field: 'skills' | 'targetTitles' | 'targetLocations', value: string) => {
    if (!value.trim()) return;
    const arr = [...(profile[field] || [])];
    arr.push(value.trim());
    setProfile({ ...profile, [field]: arr });
  };

  // Tool 1 removed from profile — AI Rewrite lives in the Applications workflow only

  // Tool 3: Find overlooked roles based on skills
  const handleFindRoleFit = async () => {
    if (!(profile as any).geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      return;
    }
    setIsFindingRoles(true);
    try {
      const roles = await findRoleFit();
      const content = roles.map((r, i) => `${i + 1}. **${r.title}** (Demand: ${r.demandScore}/100)\n   ${r.reasoning}`).join("\n\n");
      setAiResultModal({ title: "Roles You Might Be Overlooking", content });
      // Offer to bulk-add to targetTitles
      const topTitles = roles.slice(0, 5).map(r => r.title);
      if (confirm(`Add top 5 suggested titles to your Target Roles?\n\n${topTitles.join("\n")}`)) {
        setProfile(prev => ({ ...prev, targetTitles: [...new Set([...(prev.targetTitles || []), ...topTitles])] }));
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to suggest roles.");
    } finally {
      setIsFindingRoles(false);
    }
  };

  // Tool 4: Upgrade bullet points for a specific role
  const handleUpgradeBullets = async (expIndex: number) => {
    if (!(profile as any).geminiApiKey) {
      alert("Gemini API Key missing! Please navigate to Agent Settings to add your key.");
      return;
    }
    setUpgradingBulletIdx(expIndex);
    try {
      const bullets = profile.experience?.[expIndex]?.achievements || [];
      const upgraded = await upgradeBullets(bullets);
      const newExp = [...(profile.experience || [])];
      newExp[expIndex] = { ...newExp[expIndex], achievements: upgraded };
      setProfile({ ...profile, experience: newExp });
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to upgrade achievements.");
    } finally {
      setUpgradingBulletIdx(null);
    }
  };

  return (
    <>
    <div className="p-8 max-w-6xl mx-auto space-y-8">

      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <h2 className="text-3xl font-bold font-outfit">Identity Hub</h2>
             <select 
               value={activeId}
               onChange={(e) => handleSwitchProfile(e.target.value)}
               className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs font-bold text-indigo-400 focus:ring-0 cursor-pointer"
             >
               {profiles.map(p => (
                 <option key={p.id} value={p.id}>
                   {p.fullName.toUpperCase()} {p.targetTitle ? `— ${p.targetTitle.toUpperCase()}` : ""}
                 </option>
               ))}

             </select>
             <button 
               onClick={handleCreateProfile}
               className="p-1 rounded bg-white/5 text-slate-500 hover:text-white transition-all"
               title="New Profile"
             >
               <Plus className="w-4 h-4" />
              </button>
              {activeId !== "default" && (
                <button 
                  onClick={() => setProfileToDelete(activeId)}
                  className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/10 ml-1"
                  title="Delete Identity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
          </div>
          <p className="text-slate-400">Switch between resumes or create a new profile for a different user.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              const savedProfile = await fetchUserProfile();
              if (savedProfile) {
                setProfile(savedProfile);
                setResumeText(savedProfile.resumeText || "");
              }
              setStatus("Changes discarded.");
              setTimeout(() => setStatus(null), 3000);
            }} 
            className="btn-secondary"
          >
            Discard
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Raw Ingest */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <FileText className="w-5 h-5" />
                <h3 className="font-bold">Source of Truth Resume</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase font-bold tracking-widest text-slate-600 bg-white/5 px-2 py-0.5 rounded">Protected</span>
                <button 
                  onClick={handleParse}
                  disabled={isParsing || !resumeText}
                  className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {isParsing ? "Analyzing..." : "AI Parse →"}
                </button>
              </div>
            </div>
            <textarea 
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="input-field w-full h-[600px] font-mono text-[11px] resize-none leading-relaxed bg-[#0d0d0f]"
              placeholder="# Paste your ATS-friendly resume here..."
            />
            {status && (
              <p className={`text-[10px] font-bold uppercase tracking-wider ${status.includes("successful") ? "text-emerald-400" : "text-red-400"}`}>
                {status}
              </p>
            )}
          </div>
        </div>

        {/* Right: Structured Review */}
        <div className="lg:col-span-7 space-y-6">
          {Object.keys(profile).length === 0 && !isParsing ? (
            <div className="glass-card py-32 text-center space-y-4 border-dashed">
              <Sparkles className="w-12 h-12 text-slate-700 mx-auto" />
              <div>
                <p className="font-bold text-slate-400">No Structured Data Yet</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Paste your resume on the left and click "AI Parse" to generate your automation profile.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Header Info */}
              <div className="glass-card grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Full Name</label>
                  <input 
                    type="text" 
                    value={profile.fullName || ""} 
                    onChange={(e) => setProfile({...profile, fullName: e.target.value})}
                    className="bg-transparent border-none text-xl font-bold w-full p-0 focus:ring-0" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Email Address</label>
                  <input 
                    type="text" 
                    value={profile.email || ""} 
                    onChange={(e) => setProfile({...profile, email: e.target.value})}
                    className="bg-transparent border-none text-slate-300 w-full p-0 focus:ring-0" 
                  />
                </div>
              </div>

              {/* Collapsible Sections */}
              <div className="space-y-4">
                {/* Work Experience */}
                <div className="glass-card !p-0 overflow-hidden">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === "experience" ? null : "experience")}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-indigo-400" />
                      <h3 className="font-bold">Work History</h3>
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px] font-bold">
                        {profile.experience?.length || 0} Roles
                      </span>
                    </div>
                    {expandedSection === "experience" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {expandedSection === "experience" && (
                    <div className="p-6 pt-0 space-y-6 border-t border-white/5 bg-white/[0.01]">
                      {profile.experience?.map((exp, i) => (
                        <div key={i} className="space-y-4 pt-6 first:pt-0 border-t first:border-none border-white/5">
                          <div className="grid grid-cols-2 gap-4">
                            <input 
                              className="input-field text-sm font-bold" 
                              value={exp.company} 
                              onChange={(e) => updateExperience(i, "company", e.target.value)}
                              placeholder="Company Name"
                            />
                            <input 
                              className="input-field text-sm" 
                              value={exp.role} 
                              onChange={(e) => updateExperience(i, "role", e.target.value)}
                              placeholder="Job Title"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <input 
                              className="input-field text-xs" 
                              value={exp.startDate || ""} 
                              onChange={(e) => updateExperience(i, "startDate", e.target.value)}
                              placeholder="Start Date" 
                            />
                            <input 
                              className="input-field text-xs" 
                              value={exp.endDate || ""} 
                              onChange={(e) => updateExperience(i, "endDate", e.target.value)}
                              placeholder="End Date" 
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] text-slate-500 uppercase font-bold">Key Achievements</label>
                              <button
                                onClick={() => handleUpgradeBullets(i)}
                                disabled={upgradingBulletIdx === i}
                                className="text-[10px] uppercase font-bold px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                              >
                                {upgradingBulletIdx === i ? "Upgrading..." : "✦ Upgrade Bullets"}
                              </button>
                            </div>
                            <div className="space-y-2">
                              {exp.achievements.map((ach, j) => (
                                <div key={j} className="flex gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 mt-2 shrink-0" />
                                  <textarea 
                                    className="bg-transparent border-none text-xs text-slate-400 w-full p-0 focus:ring-0 resize-none" 
                                    value={ach}
                                    onChange={(e) => {
                                      const newExp = [...(profile.experience || [])];
                                      const newAch = [...newExp[i].achievements];
                                      newAch[j] = e.target.value;
                                      newExp[i] = { ...newExp[i], achievements: newAch };
                                      setProfile({ ...profile, experience: newExp });
                                    }}
                                    rows={2}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Education */}
                <div className="glass-card !p-0 overflow-hidden">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === "education" ? null : "education")}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GraduationCap className="w-5 h-5 text-purple-400" />
                      <h3 className="font-bold">Education</h3>
                    </div>
                    {expandedSection === "education" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {expandedSection === "education" && (
                    <div className="p-6 pt-0 space-y-4 border-t border-white/5">
                      {profile.education?.map((edu, i) => (
                        <div key={i} className="grid grid-cols-2 gap-4 py-4">
                          <input 
                            className="input-field text-sm font-bold" 
                            value={edu.institution || ""} 
                            onChange={(e) => updateEducation(i, "institution", e.target.value)}
                            placeholder="Institution"
                          />
                          <input 
                            className="input-field text-sm" 
                            value={edu.degree || ""} 
                            onChange={(e) => updateEducation(i, "degree", e.target.value)}
                            placeholder="Degree / Field"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Extracted Search Parameters */}
                <div className="glass-card space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        Target Job Titles
                      </h3>
                      <button
                        onClick={handleFindRoleFit}
                        disabled={isFindingRoles}
                        className="text-[10px] uppercase font-bold px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20 hover:bg-indigo-500/20 transition-all disabled:opacity-50"
                        title="AI suggests roles you may be overlooking"
                      >
                        {isFindingRoles ? "Analyzing..." : "✦ Suggest Roles"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {profile.targetTitles?.map((title, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-300 flex items-center gap-2">
                          {title}
                          <button onClick={() => removeArrayItem('targetTitles', i)} className="hover:text-white">&times;</button>
                        </span>
                      ))}
                    </div>
                    <input 
                      type="text" 
                      placeholder="Add job title and press Enter..." 
                      className="input-field text-sm w-full"
                      onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('targetTitles', e.currentTarget.value); e.currentTarget.value = ''; } }}
                    />
                  </div>

                  <div>
                    <h3 className="font-bold flex items-center gap-2 mb-3">
                      <MapPin className="w-5 h-5 text-emerald-400" />
                      Search Locations (Cities/Postcodes)
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {profile.targetLocations?.map((loc, i) => (
                        <span key={i} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-300 flex items-center gap-2">
                          {loc}
                          <button onClick={() => removeArrayItem('targetLocations', i)} className="hover:text-white">&times;</button>
                        </span>
                      ))}
                    </div>
                    <input 
                      type="text" 
                      placeholder="Add city or postcode and press Enter..." 
                      className="input-field text-sm w-full"
                      onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('targetLocations', e.currentTarget.value); e.currentTarget.value = ''; } }}
                    />
                  </div>

                  <div>
                    <h3 className="font-bold flex items-center gap-2 mb-3">
                      <FileText className="w-5 h-5 text-slate-400" />
                      Core Skills
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {profile.skills?.map((skill, i) => (
                        <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-slate-300 flex items-center gap-2">
                          {skill}
                          <button onClick={() => removeArrayItem('skills', i)} className="hover:text-white">&times;</button>
                        </span>
                      ))}
                    </div>
                    <input 
                      type="text" 
                      placeholder="Add skill and press Enter..." 
                      className="input-field text-sm w-full"
                      onKeyDown={(e) => { if (e.key === 'Enter') { addArrayItem('skills', e.currentTarget.value); e.currentTarget.value = ''; } }}
                    />
                  </div>
                </div>

                {/* Salary Expectations */}
                <div className="glass-card space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <span className="text-emerald-400">£</span>
                    Salary Expectations
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Minimum", key: "minimumAcceptable" },
                      { label: "Target", key: "targetSalary" },
                      { label: "Max Ask", key: "maximumAsk" },
                    ].map(({ label, key }) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">{label}</label>
                        <input
                          type="number"
                          className="input-field text-sm w-full"
                          placeholder="75000"
                          value={(profile.salaryExpectations as any)?.[key] || ""}
                          onChange={(e) => setProfile({
                            ...profile,
                            salaryExpectations: {
                              currency: 'GBP',
                              minimumAcceptable: 0,
                              targetSalary: 0,
                              maximumAsk: 0,
                              negotiable: true,
                              ...(profile.salaryExpectations || {}),
                              [key]: Number(e.target.value)
                            }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="input-field text-sm flex-1"
                      value={profile.salaryExpectations?.currency || 'GBP'}
                      onChange={(e) => setProfile({ ...profile, salaryExpectations: { ...profile.salaryExpectations as any, currency: e.target.value as any } })}
                    >
                      <option value="GBP">GBP £</option>
                      <option value="USD">USD $</option>
                      <option value="EUR">EUR €</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.salaryExpectations?.negotiable ?? true}
                        onChange={(e) => setProfile({ ...profile, salaryExpectations: { ...profile.salaryExpectations as any, negotiable: e.target.checked } })}
                        className="w-3 h-3"
                      />
                      Negotiable
                    </label>
                  </div>
                </div>

                {/* Application Defaults */}
                <div className="glass-card space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Settings className="w-5 h-5 text-slate-400" />
                    Application Defaults
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Work Authorisation</label>
                      <input
                        className="input-field text-sm w-full"
                        placeholder="e.g. UK Citizen, Need sponsorship"
                        value={profile.workAuthorisation || ""}
                        onChange={(e) => setProfile({ ...profile, workAuthorisation: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Notice Period</label>
                      <input
                        className="input-field text-sm w-full"
                        placeholder="e.g. 1 month, Immediate"
                        value={profile.noticePeriod || ""}
                        onChange={(e) => setProfile({ ...profile, noticePeriod: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Daily Application Cap</label>
                      <input
                        type="number"
                        className="input-field text-sm w-full"
                        placeholder="15"
                        value={profile.applicationDailyLimit || 15}
                        onChange={(e) => setProfile({ ...profile, applicationDailyLimit: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Supervised Rounds Before Auto</label>
                      <input
                        type="number"
                        className="input-field text-sm w-full"
                        placeholder="5"
                        value={profile.supervisedModeCount || 5}
                        onChange={(e) => setProfile({ ...profile, supervisedModeCount: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* AI Result Modal */}
    {aiResultModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
        <div className="glass-card w-full max-w-2xl max-h-[80vh] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-indigo-400">{aiResultModal.title}</h3>
            <button onClick={() => setAiResultModal(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <textarea
            className="flex-1 bg-[#0d0d0f] rounded-xl p-4 text-sm text-slate-300 font-mono resize-none min-h-[400px] border border-white/5 focus:ring-0"
            value={aiResultModal.content}
            readOnly
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { navigator.clipboard.writeText(aiResultModal.content); }}
              className="btn-secondary py-2 px-4 text-xs"
            >
              Copy to Clipboard
            </button>
            {aiResultModal.title === "AI-Rewritten Resume" && (
              <button
                onClick={() => { setResumeText(aiResultModal.content); setAiResultModal(null); }}
                className="btn-primary py-2 px-4 text-xs"
              >
                Replace Resume Text
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    {/* Delete Confirmation Modal */}
    {profileToDelete && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="glass-card w-full max-w-md p-8 space-y-6 border-red-500/30">
          <div className="flex items-center gap-4 text-red-400">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Delete Identity?</h3>
              <p className="text-xs text-slate-500">This action is permanent and cannot be undone.</p>
            </div>
          </div>
          
          <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl space-y-2">
             <p className="text-sm text-slate-300 font-medium">You are about to delete:</p>
             <p className="text-lg font-black text-white">{profiles.find(p => p.id === profileToDelete)?.fullName || profileToDelete.toUpperCase()}</p>
             <p className="text-[10px] text-red-400/80 font-bold uppercase tracking-widest">All associated jobs, resumes, and search history will be purged.</p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setProfileToDelete(null)}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-sm transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleDeleteProfile}
              className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-red-600/20"
            >
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    )}
    </>

  );
}
