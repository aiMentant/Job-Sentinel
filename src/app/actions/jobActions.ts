"use server";

import { searchLinkedInJobs, scrapeJobDescription } from "@/lib/linkedin_scraper";
import { generateWithAI, analyzeJobMatch } from "@/lib/gemini";
import { Job, UserProfile, mockJobs, ReferralRoute } from "@/lib/db";
import { getJobs, saveJobs, updateJobStatus as dbUpdateStatus, deleteJob as dbDeleteJob, saveProfile, getProfile, toggleFavourite as dbToggleFavourite, updateJobField as dbUpdateJobField } from "@/lib/storage";
import JSZip from "jszip";

import { getAgentStatus, setAgentStatus } from "./agentStatus";
import { getActiveProfileId } from "./profileSwitch";

export async function fetchJobs(profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  return await getJobs(profileId);
}

export async function fetchUserProfile(profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  return await getProfile(profileId);
}

export async function addJobs(newJobs: Job[], profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  const existingJobs = await getJobs(profileId);
  
  // Merge and prevent duplicates by URL
  const existingUrls = new Set(existingJobs.map((j: any) => j.url));
  const uniqueNewJobs = newJobs.filter(j => !existingUrls.has(j.url));
  
  const updatedJobs = [...uniqueNewJobs, ...existingJobs];
  return await saveJobs(updatedJobs, profileId);
}

export async function fetchFullJobDescription(jobId: string, url: string, profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  const description = await scrapeJobDescription(url);
  await dbUpdateJobField(jobId, { description }, profileId);

  return description;
}

export async function updateJobStatus(id: string, status: Job['status'], profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  return await dbUpdateStatus(id, status, profileId);
}

export async function updateJobApplicationStage(id: string, stage: string) {
  const profileId = await getActiveProfileId();
  const updatedStatus = { 
    stage,
    lastUpdated: new Date().toISOString()
  };
  return await dbUpdateJobField(id, { applicationStatus: updatedStatus }, profileId);
}

export async function listAllProfiles() {
  const { listProfiles } = await import("@/lib/storage");
  return await listProfiles();
}

export async function listAllProfilesWithData() {
  const { listProfiles, getProfile } = await import("@/lib/storage");
  const ids = await listProfiles();
  const profiles = await Promise.all(ids.map(async (id: string) => {
    const data = await getProfile(id);
    return { 
      id, 
      fullName: data?.fullName || id, 
      targetTitle: data?.targetTitles?.[0] || "",
      profilePictureUrl: data?.profilePictureUrl || ""
    };
  }));
  return profiles;
}


export async function fetchPublicFallbackJobs(title: string, location: string): Promise<any[]> {
  try {
    console.log(`[Fallback] Scraping Remotive for fallback results matching: ${title}`);
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(title)}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    const rawList = data.jobs || [];
    
    return rawList.map((j: any) => ({
      id: String(j.id) || Math.random().toString(36).substring(7),
      title: j.title || title,
      company: j.company_name || "Enterprise Partner",
      location: j.candidate_required_location || "Remote",
      description: j.description || `Public Remote role.`,
      score: 0,
      reason: "Pending AI analysis. Click 'Analyze Match' to use Gemini.",
      status: 'Discovery',
      url: j.url,
      source: 'Remotive',
      createdAt: new Date().toISOString(),
      salaryRange: j.salary || undefined
    }));
  } catch (e) {
    console.error("Public fallback failed:", e);
    return [];
  }
}

export async function runJobSearch(
  targetTitles: string[],
  targetLocations: string[],
  radius: number,
  resumeText: string,
  targetSites?: string[],
  profileIdOverride?: string,
  matchStrictness: 'exact' | 'strong' | 'flexible' = 'exact'
) {
  const profileId = profileIdOverride || await getActiveProfileId();
  const profile = await getProfile(profileId);
  const jobStore = await getJobs(profileId);
  const allResults: Job[] = [];
  
  await setAgentStatus({ isSearching: true, status: "Initializing stealth scan...", resultsFound: 0 });

  try {
    const titles = targetTitles.length > 0 ? targetTitles : ["Product Designer"];
    const locations = targetLocations.length > 0 
      ? targetLocations 
      : (profile?.location ? [profile.location] : ["United States"]);
    const totalSteps = titles.length * locations.length;
    let currentStep = 0;
    
    for (const title of titles) {
      for (const rawLoc of locations) {
        const location = rawLoc;
        currentStep++;

        const remainingSteps = totalSteps - currentStep + 1;
        // Average platform search time is ~30 seconds per combined platform scrape step
        const minEta = Math.ceil((remainingSteps * 15) / 60);
        const maxEta = Math.ceil((remainingSteps * 30) / 60);
        const etaText = minEta === 1 ? "about 1 min" : `${minEta}-${maxEta} mins`;

        await setAgentStatus({ 
          status: `Search ${currentStep}/${totalSteps} (${etaText} left): "${title}" in ${location}...`,
          resultsFound: allResults.length 
        });
        
        // Only run direct LinkedIn scan if linkedin.com is in targetSites or no targetSites are specified
        let linkedinJobs: any[] = [];
        if (!targetSites || targetSites.length === 0 || targetSites.some(s => s.toLowerCase().includes("linkedin"))) {
          linkedinJobs = await searchLinkedInJobs(title, location, radius);
        }
        
        const multiJobs = await searchMultiPlatformJobs(title, location, targetSites);
        let rawJobs = [...linkedinJobs, ...multiJobs];
        if (!rawJobs || rawJobs.length === 0) {
          rawJobs = await fetchPublicFallbackJobs(title, location);
        }
        
        // KEYWORD GUARDRAIL: Adhere to target roles depending on matchStrictness setting
        const genericWords = ["senior", "junior", "lead", "staff", "principal", "manager", "director", "designer", "developer", "engineer", "associate", "intern", "creative", "digital", "motion", "co-op", "contractor"];
        
        for (const raw of rawJobs) {
          const titleLower = raw.title.toLowerCase();
          
          let isTargetMatch = false;
          if (targetTitles.length === 0) {
            isTargetMatch = true;
          } else {
            isTargetMatch = targetTitles.some(target => {
              const targetLower = target.toLowerCase();
              
              if (matchStrictness === 'exact') {
                // Exact match: Clean target string must match clean title string
                const cleanTarget = targetLower.replace(/^(senior|junior|lead|staff|principal|associate|creative|digital|entry-level|mid-weight|contract|freelance)\s+/g, "").trim();
                const cleanJobTitle = titleLower.replace(/^(senior|junior|lead|staff|principal|associate|creative|digital|entry-level|mid-weight|contract|freelance)\s+/g, "").trim();
                return cleanJobTitle.includes(cleanTarget);
              } else if (matchStrictness === 'strong') {
                // Strong match: requires all non-generic words in target to be present
                const targetWords = targetLower.split(/\s+/).filter(w => w.length > 2 && !genericWords.includes(w));
                if (targetWords.length > 0) {
                  return targetWords.every(word => titleLower.includes(word));
                }
                return targetLower.split(/\s+/).filter(w => w.length > 2).every(word => titleLower.includes(word));
              } else {
                // Flexible match: any non-generic target word matching
                const targetWords = targetLower.split(/\s+/).filter(w => w.length > 2);
                const nonGenericTargetWords = targetWords.filter(w => !genericWords.includes(w));
                if (nonGenericTargetWords.length > 0) {
                  return nonGenericTargetWords.some(word => titleLower.includes(word));
                } else {
                  return targetWords.some(word => titleLower.includes(word));
                }
              }
            });
          }

          if (!isTargetMatch) {
             console.log(`[Guardrail] Skipping title as it doesn't match Target Roles: ${raw.title}`);
             continue;
          }

          // LOCATION GUARDRAIL: Adhere to user's target locations
          const jobLocLower = raw.location.toLowerCase();
          const isLocationMatch = targetLocations.length === 0 || targetLocations.some(target => {
            const cleanTarget = target.toLowerCase().trim();
            if (!cleanTarget) return false;
            
            // Check direct inclusion first
            if (jobLocLower.includes(cleanTarget) || cleanTarget.includes(jobLocLower)) {
              return true;
            }
            
            const isRemoteTarget = cleanTarget.includes("remote");
            if (isRemoteTarget && (jobLocLower.includes("remote") || jobLocLower.includes("anywhere") || jobLocLower.includes("worldwide"))) {
              return true;
            }
            
            // Split by words/regions but allow shorter state abbreviations/components (length >= 2)
            const targetWords = cleanTarget.split(/[\s,;]+/).filter(w => w.length >= 2);
            return targetWords.length > 0 && targetWords.some(word => jobLocLower.includes(word));
          });

          if (!isLocationMatch) {
             console.log(`[Guardrail] Skipping location as it doesn't match Target Locations: ${raw.location}`);
             continue;
          }

          const isDuplicate = [...jobStore, ...allResults].find(
            (j: any) => j.company.toLowerCase() === raw.company.toLowerCase() && 
                        j.title.toLowerCase() === raw.title.toLowerCase()
          );
          
          if (isDuplicate) continue;

          // NEW MODEL: Don't auto-analyze. Scrape first, analyze on demand.
          const job: Job = {
            ...raw,
            description: "Details fetched during search.",
            score: 0,
            reason: "Pending AI analysis. Click 'Analyze Match' to use Gemini.",
            status: 'Discovery',
            createdAt: new Date().toISOString()
          };
          
          allResults.push(job);
          await setAgentStatus({ resultsFound: allResults.length });
        }
      }
    }
    
    const updatedJobs = [...allResults, ...jobStore];
    await saveJobs(updatedJobs, profileId);
    await setAgentStatus({ isSearching: false, status: `Complete. Found ${allResults.length} new matches.` });
    return allResults;
  } catch (error) {
    await setAgentStatus({ isSearching: false, status: "Search failed. Check logs." });
    throw error;
  }
}

export async function deleteJob(id: string, profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  return await dbDeleteJob(id, profileId);
}

export async function bulkDeleteJobs(ids: string[], profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  const jobs = await getJobs(profileId);
  const updated = jobs.filter((j: any) => !ids.includes(j.id));
  await saveJobs(updated, profileId);
  return { success: true };
}

export async function saveUserProfile(profile: any, targetProfileId?: string) {
  try {
    const profileId = targetProfileId || (await getActiveProfileId());
    await saveProfile(profile, profileId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to save user profile." };
  }
}

export async function deleteProfile(profileId: string) {
  if (profileId === 'default') {
    throw new Error("Cannot delete the default profile.");
  }

  const { isSupabaseEnabled } = await import("@/lib/storage");
  const { supabase } = await import("@/lib/supabaseClient");

  if (isSupabaseEnabled() && supabase) {
    // Delete from profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId);
    if (profileError) {
      throw new Error(`Failed to delete profile from Supabase: ${profileError.message}`);
    }

    // Delete associated jobs record
    const { error: jobsError } = await supabase
      .from('jobs')
      .delete()
      .eq('profile_id', profileId);
    if (jobsError) {
      console.warn("Failed to delete associated jobs record from Supabase:", jobsError.message);
    }
  }

  // Fallback / local file cleanup
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const BASE_DATA_PATH = path.join(process.cwd(), 'data/profiles');
    const dir = path.join(BASE_DATA_PATH, profileId);
    await fs.rm(dir, { recursive: true, force: true });
  } catch (fsErr) {
    console.warn("Failed to clean up local files during profile delete:", fsErr);
  }
  
  // If we deleted the active profile, switch back to default
  const { setActiveProfileId } = await import("./profileSwitch");
  await setActiveProfileId('default');
  
  return { success: true };
}


// Safe patch: reads existing profile first, merges only provided fields.
// Use this instead of saveUserProfile when you only have partial state.
export async function patchUserProfile(fields: Record<string, any>) {
  try {
    const profileId = await getActiveProfileId();
    const existing = (await getProfile(profileId)) || {};
    await saveProfile({ ...existing, ...fields }, profileId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to patch user profile." };
  }
}

export async function toggleJobFavourite(id: string, profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  return await dbToggleFavourite(id, profileId);
}

export async function updateJob(id: string, fields: Partial<Job>, profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  return await dbUpdateJobField(id, fields, profileId);
}

// Update any arbitrary fields on a job (e.g. tailoredResumeText, coverLetterText)
export async function saveApplicationDraft(id: string, fields: {
  tailoredResumeText?: string;
  coverLetterText?: string;
  applicationNotes?: string;
  formFieldAnswers?: Record<string, string>;
  recruiterHookLinkedin?: string;
  recruiterHookEmail?: string;
}) {
  const profileId = await getActiveProfileId();
  return await dbUpdateJobField(id, { ...fields, applicationStatus: { stage: 'draft', lastUpdated: new Date().toISOString() } }, profileId);
}

export async function markApplicationReady(id: string) {
  const profileId = await getActiveProfileId();
  return await dbUpdateJobField(id, { applicationStatus: { stage: 'ready', lastUpdated: new Date().toISOString() } }, profileId);
}

export async function generateCoverLetter(id: string) {
  const profileId = await getActiveProfileId();
  const jobs = await getJobs(profileId);
  const job = jobs.find((j: any) => j.id === id);
  if (!job) return "Job not found.";

  const profile = await getProfile(profileId);
  const context = profile ? `
Name: ${profile.fullName}
Summary: ${profile.summary}
Skills: ${(profile.skills || []).join(", ")}
Experience:
${(profile.experience || []).map((e: any) => `${e.role} at ${e.company}: ${(e.achievements || []).join(". ")}`).join("\n")}
Education: ${(profile.education || []).map((e: any) => `${e.degree} from ${e.institution}`).join(", ")}
  `.trim() : "";

  const prompt = `
Generate a highly tailored, professional cover letter for the role of ${job.title} at ${job.company}.

My Profile Details:
${context}

CRITICAL ANTI-HALLUCINATION GUARDRAILS:
- Rely ONLY on the provided Profile Details as the absolute source of truth.
- Do NOT invent, fabricate, or exaggerate any achievements, credentials, job roles, projects, technologies, KPIs, metrics, or experiences.
- Do NOT extrapolate experiences beyond what is explicitly mentioned.
- If a skill/requirement is missing, focus on adjacent transferable skills found in the profile rather than inventing it.
- Keep the cover letter under 300 words.
- Sound professional, human, and direct.
`;
  
  try {
    return await generateWithAI(prompt);
  } catch (error) {
    return "Failed to generate cover letter.";
  }
}

export async function parseResumeText(text: string): Promise<Partial<UserProfile>> {
  const prompt = `
    Extract resume data from the text below. 
    IMPORTANT: You must return ONLY a JSON object. No preamble, no markdown blocks.
    
    CRITICAL ROLE FIT INSTRUCTIONS:
    - Analyze the scale and themes of the candidate's achievements (e.g. budgets managed, enterprise scope, stakeholder seniority, leadership breadth) rather than just past titles.
    - For the "targetTitles" field, deduce a comprehensive array of 5 to 8 high-leverage target job titles representing the peak seniority and strategic scope of their capabilities.
    - Avoid titles that would "under-position" the candidate (e.g., if they lead multi-million pound portfolios, exclude "Project Manager" or "PMO Manager" in favor of "Programme Director" or "Head of PMO").
    
    CRITICAL:
    - For the "positioningSummary" field, write a high-impact, 1-sentence professional positioning statement (elevator pitch) that summarizes their core expertise and peak value proposition.
    - For the "booleanSearchString" field, generate a clean, copy-pasteable LinkedIn/Indeed Boolean search string representing these target job titles (e.g. '("Programme Director" OR "Head of PMO") AND (IT OR Digital)').

    CRITICAL ANTI-HALLUCINATION GUARDRAILS:
    - Rely ONLY on the provided TEXT. Do not invent, fabricate, or embellish candidate history.
    - Do NOT invent or add any KPIs, metrics, projects, companies, technologies, or credentials not explicitly mentioned in the TEXT.
    - Keep all extracted info 100% faithful to the source facts.

    TEXT:
    ${text}
    
    JSON SCHEMA:
    {
      "fullName": "Full Name",
      "email": "Email",
      "phone": "Phone",
      "location": "City, Country",
      "summary": "Brief professional summary",
      "experience": [
        { "company": "Company", "role": "Title", "startDate": "Year/Month", "endDate": "Year/Month", "achievements": ["Bullet 1", "Bullet 2"] }
      ],
      "education": [
        { "institution": "University", "degree": "BA/MA" }
      ],
      "skills": ["Skill 1", "Skill 2"],
      "targetTitles": ["Suggested Job Title 1", "Suggested Job Title 2"],
      "targetLocations": ["Extracted City/Postcode 1"],
      "booleanSearchString": "Boolean search string query",
      "positioningSummary": "1-sentence professional elevator pitch"
    }
  `;

  try {
    const data = await generateWithAI(prompt, { jsonMode: true });
    
    return {
      fullName: data.fullName || data.name || "",
      email: data.email || "",
      phone: data.phone || "",
      location: data.location || "",
      summary: data.summary || "",
      experience: data.experience || data.workHistory || [],
      education: data.education || [],
      skills: data.skills || [],
      targetTitles: data.targetTitles || [],
      targetLocations: data.targetLocations || [],
      booleanSearchString: data.booleanSearchString || "",
      positioningSummary: data.positioningSummary || ""
    };
  } catch (error: any) {
    try {
      await require('fs/promises').writeFile('data/debug_error.txt', error.stack || error.message);
    } catch (fsErr) {
      console.warn("Failed to write debug_error.txt in read-only environment.");
    }
    console.error("Failed to parse resume:", error);
    throw error;
  }
}
export async function analyzeSingleJob(jobId: string, profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  const profile = await getProfile(profileId);
  const jobs = await getJobs(profileId);
  const job = jobs.find((j: any) => j.id === jobId);

  if (!job || !profile) throw new Error("Job or profile not found");

  const { analyzeJobMatch } = await import("@/lib/gemini");
  
  // Synthesize resume if raw text is missing
  const resumeContext = profile.resumeText || `
    Name: ${profile.fullName}
    Summary: ${profile.summary}
    Skills: ${(profile.skills || []).join(", ")}
    Experience: ${(profile.experience || []).map((e: any) => `${e.role} at ${e.company}: ${e.description}`).join("\n")}
  `;

  const analysis = await analyzeJobMatch(resumeContext, `Role: ${job.title} at ${job.company}. Location: ${job.location}. Description: ${job.description}`);
  
  const isGhost = (analysis.reason || "").toLowerCase().includes("vague") || (analysis.reason || "").toLowerCase().includes("talent pool") || (analysis.reason || "").toLowerCase().includes("ghost");
  
  const updatedFields = {
    score: analysis.score,
    reason: isGhost ? `🚨 FLAG: ${analysis.reason}` : analysis.reason,
    status: isGhost ? 'rejected' : job.status
  };

  await dbUpdateJobField(jobId, updatedFields, profileId);
  return updatedFields;
}

export async function testApiKey(key: string, model: string): Promise<{ success: boolean; message: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Explain AI in 5 words." }] }]
      })
    });
    if (response.ok) {
      return { success: true, message: "API Key is valid and active!" };
    }
    const data = await response.json();
    return { success: false, message: data.error?.message || `API Error: ${response.status}` };
  } catch (e: any) {
    return { success: false, message: e.message || "Failed to connect to Gemini API." };
  }
}

export async function runLinkedInProfileScrape(url: string): Promise<string> {
  const { scrapePublicLinkedInProfile } = await import("@/lib/linkedin_scraper");
  const rawText = await scrapePublicLinkedInProfile(url);
  if (rawText.startsWith("Failed")) {
    throw new Error(rawText);
  }
  return rawText;
}

export async function parseUploadedFile(formData: FormData): Promise<string> {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded.");
  const filename = file.name.toLowerCase();
  if (filename.endsWith(".txt")) {
    return await file.text();
  } else if (filename.endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (typeof (global as any).DOMMatrix === 'undefined') {
      (global as any).DOMMatrix = class DOMMatrix {
        constructor() {}
      };
    }
    const pdfModule = require("pdf-parse");
    if (typeof pdfModule.PDFParse === 'function') {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const parsed = await parser.getText();
      return parsed.text;
    } else {
      const pdf = typeof pdfModule === 'function' ? pdfModule : pdfModule.default;
      const parsed = await pdf(buffer);
      return parsed.text;
    }
  } else if (filename.endsWith(".docx")) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("string");
    return docXml ? docXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  }
  throw new Error("Unsupported file format.");
}

export async function getDbStatus() {
  try {
    const { isSupabaseEnabled } = await import("@/lib/storage");
    const { supabase } = await import("@/lib/supabaseClient");
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
    
    return {
      connected: isSupabaseEnabled(),
      hasUrl: !!url,
      hasKey: !!key,
      clientInitialized: !!supabase,
      urlPreview: url ? `${url.slice(0, 8)}...${url.slice(-8)}` : "empty",
      keyLength: key ? key.length : 0,
      startsWithHttp: url.startsWith("http"),
      error: null
    };
  } catch (err: any) {
    return {
      connected: false,
      hasUrl: false,
      hasKey: false,
      clientInitialized: false,
      urlPreview: "error",
      keyLength: 0,
      startsWithHttp: false,
      error: err.message || String(err)
    };
  }
}

export async function safeParseUploadedFile(formData: FormData): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const text = await parseUploadedFile(formData);
    return { success: true, text };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to parse file." };
  }
}

export async function safeParseResumeText(text: string): Promise<{ success: boolean; data?: Partial<UserProfile>; error?: string }> {
  try {
    const data = await parseResumeText(text);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to parse resume text." };
  }
}

export async function safeLinkedInProfileScrape(url: string): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const text = await runLinkedInProfileScrape(url);
    return { success: true, text };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to scrape LinkedIn profile." };
  }
}

function calculateJaccardSimilarity(str1: string, str2: string): number {
  const getTokens = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const t1 = getTokens(str1);
  const t2 = getTokens(str2);
  if (t1.length === 0 || t2.length === 0) return 0;
  const s1 = new Set(t1);
  const s2 = new Set(t2);
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  return intersection.size / union.size;
}

function heuristicMatchScore(jobTitle: string, targetTitles: string[]): number {
  let maxScore = 0;
  for (const target of targetTitles) {
    if (jobTitle.toLowerCase().trim() === target.toLowerCase().trim()) {
      return 100;
    }
    if (jobTitle.toLowerCase().includes(target.toLowerCase()) || target.toLowerCase().includes(jobTitle.toLowerCase())) {
      maxScore = Math.max(maxScore, 90);
    }
    const sim = calculateJaccardSimilarity(jobTitle, target);
    const score = Math.round(sim * 100);
    maxScore = Math.max(maxScore, score);
  }
  return maxScore;
}

export async function searchMultiPlatformJobs(query: string, location: string, platformsOverride?: string[], targetTitlesOverride?: string[]): Promise<Job[]> {
  const { chromium } = await import('playwright');
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  const browser = browserlessKey 
    ? await chromium.connectOverCDP(`wss://chrome.browserless.io?token=${browserlessKey}`)
    : await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    (window as any).chrome = { runtime: {} };
  });

  const page = await context.newPage();
  
  const domains = platformsOverride && platformsOverride.length > 0
    ? platformsOverride
    : ["indeed.com", "glassdoor.com", "ziprecruiter.com", "usajobs.gov", "snagajob.com", "linkedin.com"];

  const platforms = domains.map(domain => {
    const cleanDomain = domain.trim().toLowerCase();
    const name = cleanDomain.split('.')[0];
    const friendlyName = name.charAt(0).toUpperCase() + name.slice(1);
    return { domain: cleanDomain, name: friendlyName };
  });
  
  const siteQuery = platforms.map(p => `site:${p.domain}`).join(' OR ');
  const googleQuery = `(${query}) "${location}" (${siteQuery})`;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;
  
  console.log(`[MultiPlatform] Querying Google: ${googleQuery}`);
  
  let entries: { url: string; title: string; snippet: string }[] = [];
  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 12000 });
    await page.waitForTimeout(1000);
    
    const currentUrl = page.url();
    if (currentUrl.includes("sorry/index") || currentUrl.includes("consent.google.com")) {
      console.warn("[MultiPlatform] Google CAPTCHA or Cookie Redirect detected. Falling back to DuckDuckGo HTML Search...");
      throw new Error("Google blocked request");
    }

    entries = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('div.g, div.MjjYud, div.v7W49e, div.tF2Cxc'));
      return blocks.map(div => {
        const link = div.querySelector('a') as HTMLAnchorElement | null;
        const h3 = div.querySelector('h3') as HTMLElement | null;
        const snippet = div.querySelector('div.VwiC3b, div.yXK7Cc, span.aCOpRe') as HTMLElement | null;
        return {
          url: link?.href || "",
          title: h3?.textContent || link?.textContent || "",
          snippet: snippet?.textContent || ""
        };
      }).filter(e => e.url && e.title);
    });
  } catch (error) {
    console.warn("[MultiPlatform] Google search failed or blocked. Trying DuckDuckGo failover...");
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(googleQuery)}`;
      await page.goto(ddgUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
      entries = await page.evaluate(() => {
        const blocks = Array.from(document.querySelectorAll('.web-result'));
        return blocks.map(div => {
          const link = div.querySelector('.result__url') as HTMLAnchorElement | null;
          const h3 = div.querySelector('.result__title') as HTMLElement | null;
          const snippet = div.querySelector('.result__snippet') as HTMLElement | null;
          return {
            url: link?.href || "",
            title: h3?.textContent || "",
            snippet: snippet?.textContent || ""
          };
        }).filter(e => e.url && e.title);
      });
      console.log(`[MultiPlatform] DuckDuckGo fallback found ${entries.length} results.`);
    } catch (ddgError) {
      console.error("[MultiPlatform] DuckDuckGo fallback failed too:", ddgError);
    }
  } finally {
    await browser.close();
  }
  
  const results: Job[] = [];
  const targetRoles = targetTitlesOverride || [];

  for (const entry of entries) {
    if (entry.url.includes('google.com') || entry.url.includes('duckduckgo.com')) continue;
    const matchedPlatform = platforms.find(p => entry.url.includes(p.domain));
    const source = matchedPlatform ? matchedPlatform.name : "Search Index";
    
    let company = "Enterprise Partner";
    const titleClean = entry.title.split(' - ')[0] || entry.title;
    
    const parts = entry.title.split(' - ');
    if (parts.length > 1) {
      company = parts[1].trim();
    }
    
    const matchScore = targetRoles.length > 0 ? heuristicMatchScore(titleClean, targetRoles) : 75;
    
    results.push({
      id: Math.random().toString(36).substring(7),
      title: titleClean,
      company: company,
      location: location,
      description: entry.snippet || `Job listing on ${source}`,
      score: matchScore,
      reason: `Match strength: ${matchScore}% computed via target role relevance matching.`,
      status: 'Discovery',
      url: entry.url,
      source: source,
      createdAt: new Date().toISOString()
    });
  }
  
  return results;
}

export async function scanCompanyJobs(companyName: string, targetTitles: string[], targetLocations: string[], careerUrl?: string): Promise<Job[]> {
  if (careerUrl) {
    try {
      const lowerUrl = careerUrl.toLowerCase();
      
      // Greenhouse Direct API Scan
      if (lowerUrl.includes("greenhouse.io")) {
        console.log(`[ATS-Direct] Scanning Greenhouse board for ${companyName}`);
        let companyToken = "";
        try {
          const match = careerUrl.match(/boards\.greenhouse\.io\/([^/?#]+)/);
          if (match && match[1]) {
            companyToken = match[1];
          } else {
            const urlObj = new URL(careerUrl.startsWith("http") ? careerUrl : `https://${careerUrl}`);
            const parts = urlObj.pathname.split("/").filter(Boolean);
            companyToken = parts[parts.length - 1] || "";
          }
        } catch (e) {}

        if (companyToken && companyToken !== "embed" && companyToken !== "job_board") {
          const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${companyToken}/jobs`);
          if (res.ok) {
            const data = await res.json();
            const jobsList = data.jobs || [];
            console.log(`[ATS-Direct] Greenhouse returned ${jobsList.length} total jobs.`);
            
            const matches: Job[] = [];
            for (const j of jobsList) {
              const score = targetTitles.length > 0 ? heuristicMatchScore(j.title, targetTitles) : 75;
              if (score > 40) {
                matches.push({
                  id: String(j.id),
                  title: j.title,
                  company: companyName,
                  location: j.location?.name || targetLocations[0] || "Remote",
                  description: `Open role at ${companyName}. Department: ${j.departments?.[0]?.name || 'N/A'}.`,
                  score: score,
                  reason: `Direct ATS match (${score}% confidence) found on Greenhouse.`,
                  status: 'Discovery',
                  url: j.absolute_url,
                  source: 'Greenhouse',
                  createdAt: new Date().toISOString()
                });
              }
            }
            if (matches.length > 0) return matches;
          }
        }
      }

      // Lever Direct API Scan
      if (lowerUrl.includes("lever.co")) {
        console.log(`[ATS-Direct] Scanning Lever board for ${companyName}`);
        let companyToken = "";
        try {
          const match = careerUrl.match(/jobs\.lever\.co\/([^/?#]+)/);
          if (match && match[1]) {
            companyToken = match[1];
          } else {
            const urlObj = new URL(careerUrl.startsWith("http") ? careerUrl : `https://${careerUrl}`);
            const parts = urlObj.pathname.split("/").filter(Boolean);
            companyToken = parts[0] || "";
          }
        } catch (e) {}

        if (companyToken) {
          const res = await fetch(`https://api.lever.co/v0/postings/${companyToken}?mode=json`);
          if (res.ok) {
            const jobsList = await res.json();
            console.log(`[ATS-Direct] Lever returned ${jobsList.length} total jobs.`);
            
            const matches: Job[] = [];
            for (const j of jobsList) {
              const score = targetTitles.length > 0 ? heuristicMatchScore(j.title, targetTitles) : 75;
              if (score > 40) {
                matches.push({
                  id: String(j.id),
                  title: j.title,
                  company: companyName,
                  location: j.categories?.location || targetLocations[0] || "Remote",
                  description: j.description || `Open role at ${companyName}.`,
                  score: score,
                  reason: `Direct ATS match (${score}% confidence) found on Lever.`,
                  status: 'Discovery',
                  url: j.hostedUrl,
                  source: 'Lever',
                  createdAt: new Date().toISOString()
                });
              }
            }
            if (matches.length > 0) return matches;
          }
        }
      }
    } catch (atsError) {
      console.warn("[ATS-Direct] Direct API scrape failed. Falling back to multi-platform search.", atsError);
    }
  }

  const defaultDomains = ["linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "usajobs.gov", "snagajob.com"];
  const careerDomains = ["greenhouse.io", "lever.co", "myworkdayjobs.com"];
  const domains = [...defaultDomains, ...careerDomains];
  
  if (careerUrl) {
    try {
      const cleanUrl = careerUrl.startsWith("http") ? careerUrl : `https://${careerUrl}`;
      const hostname = new URL(cleanUrl).hostname.replace("www.", "");
      if (hostname && !domains.includes(hostname)) {
        domains.push(hostname);
      }
    } catch (e) {
      // ignore
    }
  }

  const rolesText = targetTitles.length > 0 ? targetTitles : ["Product Designer", "Developer", "Engineer"];
  const locationText = targetLocations.length > 0 ? targetLocations[0] : "United States";

  const query = `"${companyName}" (${rolesText.map(t => `"${t}"`).join(' OR ')})`;
  const results = await searchMultiPlatformJobs(query, locationText, domains, targetTitles);
  
  const filtered = results.filter(j => {
    const jobComp = j.company.toLowerCase();
    const targetComp = companyName.toLowerCase();
    return jobComp.includes(targetComp) || targetComp.includes(jobComp) || getJaccardSimilarity(jobComp, targetComp) > 0.4;
  });
  
  return filtered;
}

function getJaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

export async function findReferralRoutes(companyName: string, profile: UserProfile): Promise<ReferralRoute[]> {
  const formerCompanies = profile.experience?.map(e => e.company).filter(Boolean) || [];
  const schools = profile.education?.map(e => e.institution).filter(Boolean) || [];
  
  if (formerCompanies.length === 0 && schools.length === 0) {
    return [];
  }
  
  const searchTerms: string[] = [];
  formerCompanies.forEach(c => searchTerms.push(`"${c}"`));
  schools.forEach(s => searchTerms.push(`"${s}"`));
  
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  if (!browserlessKey) {
    console.warn("No BROWSERLESS_API_KEY configured. Skipping referral route lookup.");
    return [];
  }
  
  const { chromium } = await import('playwright');
  let browser;
  try {
    browser = await chromium.connectOverCDP(`wss://chrome.browserless.io?token=${browserlessKey}`);
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    // Inject stealth
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });
    
    // Construct Google query
    const chunkQuery = searchTerms.join(' OR ');
    const query = `site:linkedin.com/in/ "${companyName}" (${chunkQuery})`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
    
    // Scroll and wait
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(1000);
    
    const results = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('div.g, div.MjjYud, div.v7W49e, div.tF2Cxc'));
      return blocks.map(div => {
        const link = div.querySelector('a') as HTMLAnchorElement | null;
        const h3 = div.querySelector('h3') as HTMLElement | null;
        const snippet = div.querySelector('div.VwiC3b, div.yXK7Cc, span.aCOpRe') as HTMLElement | null;
        return {
          href: link?.href || "",
          title: h3?.textContent || "",
          snippet: snippet?.textContent || ""
        };
      }).filter(e => e.href.includes('linkedin.com/in/') && e.title);
    });
    
    if (results.length === 0) return [];
    
    // Let's use Gemini to parse these organic Google search snippets into ReferralRoute objects
    const prompt = `
      You are an expert networking assistant.
      We searched LinkedIn on Google for colleagues/alumni at "${companyName}" who went to or worked at: ${searchTerms.join(', ')}.
      
      Here are the search result snippets:
      ${JSON.stringify(results.slice(0, 5))}
      
      Extract a list of matching professionals.
      CRITICAL:
      - Connection Type must be "Ex-Colleague" if they share a former company, or "Alumni" if they share a school.
      - Return ONLY a JSON array matching the schema:
      [
        { "name": "Name", "role": "Job Title", "connectionType": "Alumni" | "Ex-Colleague", "profileUrl": "LinkedIn URL" }
      ]
    `;
    
    const parsedRoutes = await generateWithAI(prompt, { jsonMode: true });
    return (parsedRoutes || []).map((r: any) => ({
      name: r.name || "LinkedIn Professional",
      role: r.role || "Professional",
      connectionType: r.connectionType === 'Alumni' ? 'Alumni' : 'Ex-Colleague',
      profileUrl: r.profileUrl || ""
    }));
  } catch (err) {
    console.error("Error finding referral routes:", err);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}


