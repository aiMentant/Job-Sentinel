"use server";

import { searchLinkedInJobs, scrapeJobDescription } from "@/lib/linkedin_scraper";
import { generateWithAI, analyzeJobMatch } from "@/lib/gemini";
import { Job, UserProfile, mockJobs } from "@/lib/db";
import { getJobs, saveJobs, updateJobStatus as dbUpdateStatus, deleteJob as dbDeleteJob, saveProfile, getProfile, toggleFavourite as dbToggleFavourite, updateJobField as dbUpdateJobField } from "@/lib/storage";
import JSZip from "jszip";

import { getAgentStatus, setAgentStatus } from "./agentStatus";
import { getActiveProfileId } from "./profileSwitch";

export async function fetchJobs() {
  const profileId = await getActiveProfileId();
  return await getJobs(profileId);
}

export async function fetchUserProfile() {
  const profileId = await getActiveProfileId();
  return await getProfile(profileId);
}

export async function addJobs(newJobs: Job[]) {
  const profileId = await getActiveProfileId();
  const existingJobs = await getJobs(profileId);
  
  // Merge and prevent duplicates by URL
  const existingUrls = new Set(existingJobs.map((j: any) => j.url));
  const uniqueNewJobs = newJobs.filter(j => !existingUrls.has(j.url));
  
  const updatedJobs = [...uniqueNewJobs, ...existingJobs];
  return await saveJobs(updatedJobs, profileId);
}

export async function fetchFullJobDescription(jobId: string, url: string) {
  const profileId = await getActiveProfileId();
  const description = await scrapeJobDescription(url);
  await dbUpdateJobField(jobId, { description }, profileId);

  return description;
}

export async function updateJobStatus(id: string, status: Job['status']) {
  const profileId = await getActiveProfileId();
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
      targetTitle: data?.targetTitles?.[0] || "" 
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

export async function runJobSearch(targetTitles: string[], targetLocations: string[], radius: number, resumeText: string) {
  const profileId = await getActiveProfileId();
  const jobStore = await getJobs(profileId);
  const allResults: Job[] = [];
  
  await setAgentStatus({ isSearching: true, status: "Initializing stealth scan...", resultsFound: 0 });

  try {
    const titles = targetTitles.length > 0 ? targetTitles : ["Product Designer"];
    const locations = targetLocations.length > 0 ? targetLocations : ["United Kingdom"];
    const totalSteps = titles.length * locations.length;
    let currentStep = 0;
    
    for (const title of titles) {
      for (const rawLoc of locations) {
        currentStep++;
        const location = rawLoc.toLowerCase().includes("kingdom") || rawLoc.toLowerCase().includes("uk") || rawLoc.toLowerCase().includes("us") 
          ? rawLoc 
          : `${rawLoc}, United Kingdom`;

        await setAgentStatus({ 
          status: `Search ${currentStep}/${totalSteps}: "${title}" in ${location}...`,
          resultsFound: allResults.length 
        });
        let rawJobs = await searchLinkedInJobs(title, location, radius);
        if (!rawJobs || rawJobs.length === 0) {
          rawJobs = await fetchPublicFallbackJobs(title, location);
        }
        
        // KEYWORD GUARDRAIL: Strictly adhere to user's Target Roles
        for (const raw of rawJobs) {
          const titleLower = raw.title.toLowerCase();
          
          // Flexible keyword matching: must match at least one significant word (length > 3) of target titles
          const isTargetMatch = targetTitles.length === 0 || targetTitles.some(target => {
            const targetWords = target.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            return targetWords.length === 0 || targetWords.some(word => titleLower.includes(word));
          });

          if (!isTargetMatch) {
             console.log(`[Guardrail] Skipping title as it doesn't match Target Roles: ${raw.title}`);
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

export async function deleteJob(id: string) {
  const profileId = await getActiveProfileId();
  return await dbDeleteJob(id, profileId);
}

export async function bulkDeleteJobs(ids: string[]) {
  const profileId = await getActiveProfileId();
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
  const { listProfiles } = await import("@/lib/storage");
  const fs = await import("fs/promises");
  const path = await import("path");
  
  const BASE_DATA_PATH = path.join(process.cwd(), 'data/profiles');
  const dir = path.join(BASE_DATA_PATH, profileId);
  
  if (profileId === 'default') {
    throw new Error("Cannot delete the default profile.");
  }
  
  await fs.rm(dir, { recursive: true, force: true });
  
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

export async function toggleJobFavourite(id: string) {
  const profileId = await getActiveProfileId();
  return await dbToggleFavourite(id, profileId);
}

export async function updateJob(id: string, fields: Partial<Job>) {
  const profileId = await getActiveProfileId();
  return await dbUpdateJobField(id, fields, profileId);
}

// Update any arbitrary fields on a job (e.g. tailoredResumeText, coverLetterText)
export async function saveApplicationDraft(id: string, fields: {
  tailoredResumeText?: string;
  coverLetterText?: string;
  applicationNotes?: string;
  formFieldAnswers?: Record<string, string>;
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
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "PASTE_YOUR_KEY_HERE") {
    throw new Error("Missing Gemini API Key. Please add it to your .env.local file.");
  }
  const prompt = `
    Extract resume data from the text below. 
    IMPORTANT: You must return ONLY a JSON object. No preamble, no markdown blocks.
    
    CRITICAL: For the "targetTitles" field, you must actively deduce and generate a comprehensive array of 5 to 8 applicable job titles (e.g., "Senior Product Designer", "UX Architect", "Lead UI/UX Designer") that perfectly match the candidate's skills and seniority level.

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
      "targetLocations": ["Extracted City/Postcode 1"]
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
      targetLocations: data.targetLocations || []
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
export async function analyzeSingleJob(jobId: string) {
  const profileId = await getActiveProfileId();
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
    const pdf = require("pdf-parse");
    const parsed = await pdf(buffer);
    return parsed.text;
  } else if (filename.endsWith(".docx")) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("string");
    return docXml ? docXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  }
  throw new Error("Unsupported file format.");
}

