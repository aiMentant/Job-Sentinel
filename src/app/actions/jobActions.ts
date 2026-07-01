"use server";

import { searchLinkedInJobs, scrapeJobDescription } from "@/lib/linkedin_scraper";
import { generateWithAI, analyzeJobMatch } from "@/lib/gemini";
import { Job, UserProfile, mockJobs, ReferralRoute } from "@/lib/db";
import { getJobs, saveJobs, updateJobStatus as dbUpdateStatus, deleteJob as dbDeleteJob, saveProfile, getProfile, toggleFavourite as dbToggleFavourite, updateJobField as dbUpdateJobField } from "@/lib/storage";

import { getAgentStatus, setAgentStatus } from "./agentStatus";
import { getActiveProfileId } from "./profileSwitch";
import { logActivity } from "./adminActions";

export async function fetchJobs(profileIdOverride?: string) {
  try {
    const profileId = profileIdOverride || await getActiveProfileId();
    return await getJobs(profileId);
  } catch (e) {
    console.error("fetchJobs server error:", e);
    return [];
  }
}

export async function fetchUserProfile(profileIdOverride?: string) {
  try {
    const profileId = profileIdOverride || await getActiveProfileId();
    return await getProfile(profileId);
  } catch (e: any) {
    console.error("fetchUserProfile server error:", e);
    return {
      fullName: "Fallback Operator",
      targetTitles: [],
      targetLocations: [],
      skills: [],
      experience: [],
      education: []
    };
  }
}

export async function addJobs(newJobs: Job[], profileIdOverride?: string) {
  try {
    const profileId = profileIdOverride || await getActiveProfileId();
    const existingJobs = await getJobs(profileId);
    
    // Merge and prevent duplicates by URL
    const existingUrls = new Set(existingJobs.map((j: any) => j.url));
    const uniqueNewJobs = newJobs.filter(j => !existingUrls.has(j.url));
    
    const updatedJobs = [...uniqueNewJobs, ...existingJobs];
    return await saveJobs(updatedJobs, profileId);
  } catch (e) {
    console.error("addJobs server error:", e);
    return false;
  }
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
  const { cookies } = await import("next/headers");
  const { listProfiles, getProfile } = await import("@/lib/storage");

  // Read auth cookies to determine who is signed in
  let authEmail = "";
  let authRole = "";
  let activeProfileId = "default";
  try {
    const cookieStore = await cookies();
    authEmail = cookieStore.get("auth_email")?.value || "";
    authRole = cookieStore.get("auth_role")?.value || "";
    activeProfileId = cookieStore.get("active_profile_id")?.value || "default";
  } catch (_) { /* server context may not have cookies during build */ }

  const isAdmin = authRole === "admin" || authEmail === "lwenban@gmail.com";

  const ids = await listProfiles();
  const profiles = await Promise.all(ids.map(async (id: string) => {
    const data = await getProfile(id);
    return { 
      id, 
      fullName: data?.fullName || id, 
      targetTitle: data?.targetTitles?.[0] || "",
      profilePictureUrl: data?.profilePictureUrl || "",
      creatorEmail: data?.creatorEmail || ""
    };
  }));

  // Admins see all profiles
  if (isAdmin) return profiles;

  // Regular users only see profiles tied to their own profile_id or created by them
  return profiles.filter(p =>
    p.id === activeProfileId ||
    (authEmail && p.creatorEmail === authEmail)
  );
}


export async function fetchPublicFallbackJobs(query: string, location: string, targetTitlesOverride?: string[], alternativeTitlesOverride?: string[]): Promise<Job[]> {
  const allFallbackJobs: Job[] = [];

  // 1. Remotive Scraper (Tech / Remote jobs)
  try {
    console.log(`[Fallback] Scraping Remotive for fallback results matching: ${query}`);
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      const data = await response.json();
      const rawList = data.jobs || [];
      
      const targetLocLower = location.toLowerCase();
      const isTargetUS = targetLocLower.includes("fl") || targetLocLower.includes("florida") || targetLocLower.includes("usa") || targetLocLower.includes("united states") || targetLocLower.includes("us") || targetLocLower.includes("communities");
      const isTargetUK = targetLocLower.includes("uk") || targetLocLower.includes("united kingdom") || targetLocLower.includes("london") || targetLocLower.includes("england") || targetLocLower.includes("nottingham") || targetLocLower.includes("lincoln");

      const filteredList = rawList.filter((j: any) => {
        const reqLoc = (j.candidate_required_location || "").toLowerCase().trim();
        if (!reqLoc) return true;
        if (reqLoc.includes("worldwide") || reqLoc.includes("anywhere")) return true;
        
        const isJobUS = reqLoc.includes("us") || reqLoc.includes("united states") || reqLoc.includes("america") || reqLoc.includes("usa") || reqLoc.includes("fl") || reqLoc.includes("florida");
        const isJobUK = reqLoc.includes("uk") || reqLoc.includes("united kingdom") || reqLoc.includes("london") || reqLoc.includes("europe") || reqLoc.includes("gb") || reqLoc.includes("england");
        
        if (isTargetUS && isJobUK && !isJobUS) return false;
        if (isTargetUK && isJobUS && !isJobUK) return false;
        
        return true;
      });

      const mappedRemotive = filteredList.map((j: any) => ({
        id: `remotive-${j.id}` || Math.random().toString(36).substring(7),
        title: j.title || query,
        company: j.company_name || "Enterprise Partner",
        location: j.candidate_required_location || "Remote",
        description: j.description || `Public Remote role.`,
        score: 0,
        reason: "Pending AI analysis. Click 'Analyze Match' to use Gemini.",
        status: 'Discovery' as const,
        url: j.url,
        source: 'Remotive',
        createdAt: new Date().toISOString(),
        salaryRange: j.salary || undefined
      }));
      allFallbackJobs.push(...mappedRemotive);
    }
  } catch (e) {
    console.error("Public Remotive fallback failed:", e);
  }

  // 2. The Muse API (Key-less US location jobs)
  try {
    console.log(`[Fallback] Fetching key-less US jobs from The Muse for location: ${location}`);
    const museUrl = `https://www.themuse.com/api/public/jobs?location=${encodeURIComponent(location)}&page=1&descending=true`;
    const museRes = await fetch(museUrl, { signal: AbortSignal.timeout(6000) });
    let results: any[] = [];
    if (museRes.ok) {
      const museData = await museRes.json();
      results = museData.results || [];
    }

    // State abbreviation/name expansion fallback if direct search yield nothing
    if (results.length === 0) {
      const parts = location.split(",");
      const statePart = parts[parts.length - 1]?.trim();
      if (statePart && statePart.length === 2) {
        const stateNames: Record<string, string> = {
          "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
          "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
          "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
          "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
          "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
          "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
          "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
          "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
          "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
          "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming"
        };
        const fullState = stateNames[statePart.toUpperCase()] || statePart;
        console.log(`[Fallback] Retrying The Muse with expanded state location: ${fullState}`);
        const museUrl2 = `https://www.themuse.com/api/public/jobs?location=${encodeURIComponent(fullState)}&page=1&descending=true`;
        const museRes2 = await fetch(museUrl2, { signal: AbortSignal.timeout(6000) });
        if (museRes2.ok) {
          const museData2 = await museRes2.json();
          results = museData2.results || [];
        }
      }
    }

    if (results.length > 0) {
      const mappedMuse = results.map((j: any) => {
        const jobLoc = j.locations?.map((l: any) => l.name).join(", ") || location;
        return {
          id: `themuse-${j.id}`,
          title: j.name || query,
          company: j.company?.name || "Enterprise Partner",
          location: jobLoc,
          description: j.contents || "Public job listing on The Muse.",
          score: 0,
          reason: "Pending AI analysis. Click 'Analyze Match' to use Gemini.",
          status: 'Discovery' as const,
          url: j.refs?.landing_page,
          source: 'The Muse',
          createdAt: new Date().toISOString()
        };
      });
      allFallbackJobs.push(...mappedMuse);
    }
  } catch (e) {
    console.error("Public The Muse fallback failed:", e);
  }

  return allFallbackJobs;
}

async function fetchAdzunaJobs(title: string, location: string, radius: number): Promise<Job[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    console.log("[Adzuna] Missing ADZUNA_APP_ID or ADZUNA_APP_KEY. Skipping.");
    return [];
  }

  try {
    const isUK = /uk|united kingdom|gb|england|wales|scotland|ireland|nottingham|lincoln/i.test(location);
    const country = isUK ? "gb" : "us";
    const radiusKm = Math.ceil(radius * 1.60934);
    
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=15&what=${encodeURIComponent(title)}&where=${encodeURIComponent(location)}&distance=${radiusKm}`;
    console.log(`[Adzuna] Querying: ${url}`);
    
    const res = await fetch(url, { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`[Adzuna] API responded with status ${res.status}`);
      return [];
    }
    const data = await res.json();
    const results = data.results || [];
    
    return results.map((j: any) => {
      const titleClean = (j.title || "").replace(/<\/?[^>]+(>|$)/g, "").trim();
      const descClean = (j.description || "").replace(/<\/?[^>]+(>|$)/g, "").trim();
      return {
        id: `adzuna-${j.id}`,
        title: titleClean || title,
        company: j.company?.display_name || "Enterprise Partner",
        location: j.location?.display_name || location,
        description: descClean || "Job listing on Adzuna.",
        score: 0,
        reason: "Pending AI analysis. Click 'Analyze Match' to use Gemini.",
        status: 'Discovery',
        url: j.redirect_url,
        source: 'Adzuna',
        createdAt: j.created || new Date().toISOString()
      };
    });
  } catch (err) {
    console.error("[Adzuna] Fetch failed:", err);
    return [];
  }
}

async function fetchJSearchJobs(title: string, location: string): Promise<Job[]> {
  const apiKey = process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY;
  if (!apiKey) {
    console.log("[JSearch] Missing RAPIDAPI_KEY or JSEARCH_API_KEY. Skipping.");
    return [];
  }

  try {
    const query = `${title} in ${location}`;
    const url = `https://jsearch.p.rapidapi.com/search-v2?query=${encodeURIComponent(query)}&num_pages=1&page=1`;
    console.log(`[JSearch] Querying JSearch for: ${query}`);
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": "jsearch.p.rapidapi.com",
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      console.warn(`[JSearch] API responded with status ${res.status}`);
      return [];
    }
    const data = await res.json();
    const results = data.data?.jobs || (Array.isArray(data.data) ? data.data : []);
    
    return results.map((j: any) => ({
      id: `jsearch-${j.job_id}`,
      title: j.job_title || title,
      company: j.employer_name || "Enterprise Partner",
      location: `${j.job_city || ''} ${j.job_state || ''} ${j.job_country || ''}`.trim() || location,
      description: j.job_description || "Job listing on JSearch.",
      score: 0,
      reason: "Pending AI analysis. Click 'Analyze Match' to use Gemini.",
      status: 'Discovery',
      url: j.job_apply_link || j.job_google_link,
      source: 'JSearch',
      createdAt: j.job_posted_at_datetime_utc || new Date().toISOString()
    }));
  } catch (err) {
    console.error("[JSearch] Fetch failed:", err);
    return [];
  }
}

async function fetchUSAJobs(title: string, location: string, radius: number): Promise<Job[]> {
  const apiKey = process.env.USAJOBS_API_KEY;
  const userEmail = process.env.USAJOBS_USER_EMAIL;
  if (!apiKey || !userEmail) {
    console.log("[USAJobs] Missing USAJOBS_API_KEY or USAJOBS_USER_EMAIL. Skipping.");
    return [];
  }

  try {
    const url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(title)}&LocationName=${encodeURIComponent(location)}&Radius=${radius}`;
    console.log(`[USAJobs] Querying: ${url}`);
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": userEmail,
        "Authorization-Key": apiKey,
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      console.warn(`[USAJobs] API responded with status ${res.status}`);
      return [];
    }
    const data = await res.json();
    const items = data.SearchResult?.SearchResultItems || [];
    
    return items.map((item: any) => {
      const desc = item.MatchedObjectDescriptor;
      const jobLoc = desc.PositionLocation?.[0]?.LocationName || location;
      return {
        id: `usajobs-${desc.PositionID}`,
        title: desc.PositionTitle || title,
        company: desc.OrganizationName || "U.S. Government",
        location: jobLoc,
        description: desc.QualificationSummary || desc.UserArea?.Details?.JobSummary || "Federal job listing.",
        score: 0,
        reason: "Pending AI analysis. Click 'Analyze Match' to use Gemini.",
        status: 'Discovery',
        url: desc.PositionURI,
        source: 'USAJobs',
        createdAt: new Date().toISOString()
      };
    });
  } catch (err) {
    console.error("[USAJobs] Fetch failed:", err);
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
  matchStrictness: 'exact' | 'strong' | 'flexible' = 'exact',
  alternativeTitles: string[] = []
) {
  const profileId = profileIdOverride || await getActiveProfileId();
  const profile = await getProfile(profileId);
  const email = profile?.email || "unknown";
  
  await logActivity(email, "Job Search Started", { 
    profile_id: profileId, 
    titles: targetTitles, 
    locations: targetLocations 
  });

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
        
        // Try free aggregated API stack first (JSearch, Adzuna, USAJobs)
        const [adzunaJobs, jsearchJobs, usajobsJobs] = await Promise.all([
          fetchAdzunaJobs(title, location, radius),
          fetchJSearchJobs(title, location),
          fetchUSAJobs(title, location, radius)
        ]);

        let rawJobs = [...adzunaJobs, ...jsearchJobs, ...usajobsJobs];

        if (rawJobs.length === 0) {
          console.log(`[Search] No API results found or credentials missing. Falling back to local browser scraper...`);
          let linkedinJobs: any[] = [];
          if (!targetSites || targetSites.length === 0 || targetSites.some(s => s.toLowerCase().includes("linkedin"))) {
            linkedinJobs = await searchLinkedInJobs(title, location, radius);
          }
          
          const multiJobs = await searchMultiPlatformJobs(title, location, targetSites, targetTitles, alternativeTitles);
          rawJobs = [...linkedinJobs, ...multiJobs];
        }

        if (rawJobs.length === 0) {
          rawJobs = await fetchPublicFallbackJobs(title, location, targetTitles, alternativeTitles);
        }
        
        // KEYWORD GUARDRAIL: Adhere to target roles depending on matchStrictness setting
        // NOTE: genericWords intentionally excludes logistics/ops domain terms like "logistics",
        // "warehouse", "inventory", "supply" so they remain as meaningful discriminators.
        const genericWords = ["senior", "junior", "lead", "staff", "principal", "associate", "intern", "creative", "digital", "motion", "co-op", "contractor"];
        const prefixStrip = /^(senior|junior|lead|staff|principal|associate|creative|digital|entry-level|mid-weight|contract|freelance|certified)\s+/gi;

        const newJobsFound: Job[] = [];
        for (const raw of rawJobs) {
          const titleLower = raw.title.toLowerCase();

          let isTargetMatch = false;
          const allAcceptedTitles = [...targetTitles, ...(alternativeTitles || [])];
          if (allAcceptedTitles.length === 0) {
            isTargetMatch = true;
          } else {
            isTargetMatch = allAcceptedTitles.some(target => {
              const targetLower = target.toLowerCase();

              if (matchStrictness === 'exact') {
                // Exact mode: all MEANINGFUL words in the target must appear in the job title
                // (order-independent). This handles compound titles like "Logistics Operations Manager"
                // matching a scraped "Operations Manager – Logistics & Supply Chain".
                const cleanTarget = targetLower.replace(prefixStrip, "").trim();
                const cleanJobTitle = titleLower.replace(prefixStrip, "").trim();

                // First: try direct substring (catches perfect matches fast)
                if (cleanJobTitle.includes(cleanTarget)) return true;

                // Second: every significant word in target must appear somewhere in title
                const significantWords = cleanTarget
                  .split(/[\s&,/\-]+/)
                  .map(w => w.trim())
                  .filter(w => w.length > 3 && !genericWords.includes(w));

                if (significantWords.length === 0) {
                  // Fall back to any word match if all words were stripped
                  return cleanTarget.split(/\s+/).some(w => cleanJobTitle.includes(w));
                }

                // All significant words must appear (any order)
                return significantWords.every(word => cleanJobTitle.includes(word));

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

          // LOCATION GUARDRAIL: Check job location against user's target locations.
          // The scraper already searched the target location, so we trust the source
          // and apply a lenient check — any meaningful word overlap is a pass.
          // This prevents over-filtering for multi-word logistics roles where job boards
          // return e.g. "Nottingham, East Midlands" for a search for "Nottingham, UK".
          const jobLocLower = (raw.location || "").toLowerCase().trim();
          const isLocationMatch = targetLocations.length === 0 || (
            // Pass-through: if job location is empty or generic ("United Kingdom", "United States", "Nationwide"), allow it
            !jobLocLower ||
            jobLocLower.includes("united kingdom") ||
            jobLocLower.includes("united states") ||
            jobLocLower.includes("nationwide") ||
            jobLocLower.includes("national") ||
            targetLocations.some(target => {
              const cleanTarget = target.toLowerCase().trim();
              if (!cleanTarget) return false;

              // Direct inclusion check (both directions)
              if (jobLocLower.includes(cleanTarget) || cleanTarget.includes(jobLocLower)) return true;

              // Remote/anywhere pass-through
              const isRemoteTarget = cleanTarget.includes("remote");
              if (isRemoteTarget && (jobLocLower.includes("remote") || jobLocLower.includes("anywhere") || jobLocLower.includes("worldwide"))) return true;

              // Word-level match — only for words longer than 3 chars to avoid
              // false matches on 2-char tokens like "fl", "uk", "in", "or"
              const targetWords = cleanTarget.split(/[\s,;]+/).filter(w => w.length > 3);
              return targetWords.length > 0 && targetWords.some(word => jobLocLower.includes(word));
            })
          );

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
          newJobsFound.push(job);
          await setAgentStatus({ resultsFound: allResults.length });
        }
        if (newJobsFound.length > 0) {
          // Tag jobs with the matched title query
          const jobsWithMeta = newJobsFound.map(j => ({ ...j, matchedRole: title }));
          await addJobs(jobsWithMeta, profileId);
        }
      }
    }
    
    await setAgentStatus({ isSearching: false, status: `Complete. Found ${allResults.length} new matches.` });
    await logActivity(email, "Job Search Completed", { 
      profile_id: profileId, 
      new_matches: allResults.length 
    });
    return allResults;
  } catch (error: any) {
    await setAgentStatus({ isSearching: false, status: "Search failed. Check logs." });
    await logActivity(email, "Job Search Failed", { 
      profile_id: profileId, 
      error: error.message || String(error) 
    });
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

export async function bulkMoveToPipeline(ids: string[], profileIdOverride?: string) {
  try {
    const profileId = profileIdOverride || await getActiveProfileId();
    const jobs = await getJobs(profileId);
    const updated = jobs.map((j: any) => ids.includes(j.id) ? { ...j, isFavourite: true } : j);
    await saveJobs(updated, profileId);
    return { success: true };
  } catch (e: any) {
    console.error("bulkMoveToPipeline failed:", e);
    return { success: false, error: e.message || String(e) };
  }
}

export async function saveUserProfile(profile: any, targetProfileId?: string) {
  try {
    const profileId = targetProfileId || (await getActiveProfileId());

    // Inject creatorEmail from auth cookie if not already set on the profile
    if (!profile.creatorEmail) {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        const authEmail = cookieStore.get("auth_email")?.value || "";
        if (authEmail) profile = { ...profile, creatorEmail: authEmail };
      } catch (_) { /* ignore during build */ }
    }

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
export async function patchUserProfile(fields: Record<string, any>, profileIdOverride?: string) {
  try {
    const profileId = profileIdOverride || await getActiveProfileId();
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

export async function parseResumeText(text: string, profileIdOverride?: string): Promise<Partial<UserProfile>> {
  const prompt = `
    Extract resume data from the text below. 
    IMPORTANT: You must return ONLY a JSON object. No preamble, no markdown blocks.
    
    CRITICAL ROLE FIT INSTRUCTIONS:
    - Analyze the scale and themes of the candidate's achievements (e.g. budgets managed, enterprise scope, stakeholder seniority, leadership breadth) rather than just past titles.
    - For the "targetTitles" field, deduce a strict array of 3 to 5 Primary, aspirational, high-leverage target job titles representing the peak seniority and strategic scope of their capabilities. Do NOT include lower-level legacy titles here.
    - For the "alternativeTitles" field, extract 5 to 10 Legacy/Semantic or alternative job titles. These are roles they have previously held, horizontal moves, or industry-specific variations that encompass the same responsibilities but are not the absolute peak aspirational titles.
    
    CRITICAL:
    - For the "positioningSummary" field, write a high-impact, 1-sentence professional positioning statement (elevator pitch) that summarizes their core expertise and peak value proposition.
    - For the "booleanSearchString" field, generate a clean, copy-pasteable LinkedIn/Indeed Boolean search string representing these primary target job titles (e.g. '("Programme Director" OR "Head of PMO") AND (IT OR Digital)').
 
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
      "targetTitles": ["Primary Target Role 1", "Primary Target Role 2"],
      "alternativeTitles": ["Legacy Title 1", "Semantic Variation 1"],
      "targetLocations": ["Extracted City/Postcode 1"],
      "booleanSearchString": "Boolean search string query",
      "positioningSummary": "1-sentence professional elevator pitch"
    }
  `;
 
  try {
    const data = await generateWithAI(prompt, { jsonMode: true, profileIdOverride });
    
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
      alternativeTitles: data.alternativeTitles || [],
      targetLocations: data.targetLocations || [],
      booleanSearchString: data.booleanSearchString || "",
      positioningSummary: data.positioningSummary || ""
    };
  } catch (error: any) {
    try {
      const fs = await import('fs/promises');
      await fs.writeFile('data/debug_error.txt', error.stack || error.message);
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

  // Dynamically fetch full job description if it is missing or is placeholder
  let description = job.description || "";
  if (!description || 
      description === "Details fetched during search." || 
      description.startsWith("Job listing on") || 
      description.length < 150) {
    try {
      const scraped = await scrapeJobDescription(job.url);
      if (scraped && scraped.length > 150) {
        description = scraped;
        await dbUpdateJobField(jobId, { description }, profileId);
        job.description = description;
      }
    } catch (scrapeError) {
      console.error("[analyzeSingleJob] Scrape failed, using existing description:", scrapeError);
    }
  }

  const { analyzeJobMatch } = await import("@/lib/gemini");
  
  // Synthesize resume if raw text is missing
  const resumeContext = profile.resumeText || `
    Name: ${profile.fullName}
    Summary: ${profile.summary}
    Skills: ${(profile.skills || []).join(", ")}
    Experience: ${(profile.experience || []).map((e: any) => `${e.role} at ${e.company}: ${e.description}`).join("\n")}
  `;

  const analysis = await analyzeJobMatch(resumeContext, `Role: ${job.title} at ${job.company}. Location: ${job.location}. Description: ${description}`);
  
  const isGhost = (analysis.reason || "").toLowerCase().includes("vague") || (analysis.reason || "").toLowerCase().includes("talent pool") || (analysis.reason || "").toLowerCase().includes("ghost");
  
  const updatedFields = {
    score: analysis.score,
    reason: isGhost ? `🚨 FLAG: ${analysis.reason}` : analysis.reason,
    status: isGhost ? 'rejected' : job.status,
    description
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
    throw new Error(
      "PDF uploads are not supported. Please convert your resume to DOCX or TXT format and try again."
    );
  } else if (filename.endsWith(".docx")) {
    const buffer = await file.arrayBuffer();
    const zip = await (await import("jszip")).default.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("string");
    return docXml ? docXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  }
  throw new Error("Unsupported file format. Please upload a DOCX or TXT file.");
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

export async function safeParseResumeText(text: string, profileIdOverride?: string): Promise<{ success: boolean; data?: Partial<UserProfile>; error?: string }> {
  try {
    const data = await parseResumeText(text, profileIdOverride);
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

function heuristicMatchScore(jobTitle: string, targetTitles: string[], alternativeTitles: string[] = []): number {
  let maxScore = 0;
  
  // Score against primary titles (full weight)
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
  
  // Score against alternative titles (capped at 85)
  for (const alt of alternativeTitles) {
    if (jobTitle.toLowerCase().trim() === alt.toLowerCase().trim()) {
      maxScore = Math.max(maxScore, 85);
      continue;
    }
    if (jobTitle.toLowerCase().includes(alt.toLowerCase()) || alt.toLowerCase().includes(jobTitle.toLowerCase())) {
      maxScore = Math.max(maxScore, 80);
    }
    const sim = calculateJaccardSimilarity(jobTitle, alt);
    const score = Math.round(sim * 85); // Penalty factor for alternative titles
    maxScore = Math.max(maxScore, score);
  }
  
  return maxScore;
}

async function getBrowserInstance(chromium: any) {
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  if (browserlessKey && browserlessKey !== "") {
    try {
      console.log("Connecting to Cloud Chromium via Browserless...");
      return await chromium.connectOverCDP(`wss://chrome.browserless.io?token=${browserlessKey}`);
    } catch (wsErr: any) {
      console.warn("Browserless connection failed, falling back to local launch:", wsErr.message || wsErr);
      if (process.env.NETLIFY === "true") {
        throw new Error(`Browserless connection failed in production: ${wsErr.message || wsErr}`);
      }
    }
  }
  if (process.env.NETLIFY === "true") {
    throw new Error("Browserless API Key is missing in production Netlify environment. Browser-based scraping is disabled.");
  }
  console.log("Launching Local Headless Chromium...");
  return await chromium.launch({ headless: true });
}

export async function searchMultiPlatformJobs(query: string, location: string, platformsOverride?: string[], targetTitlesOverride?: string[], alternativeTitlesOverride?: string[]): Promise<Job[]> {
  let browser: any = null;
  try {
    const { chromium } = await import('playwright');
    browser = await getBrowserInstance(chromium);
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
      return { domain: cleanDomain, name: name.charAt(0).toUpperCase() + name.slice(1) };
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
        throw new Error("Google blocked request");
      }

      entries = await page.evaluate(() => {
        const blocks = Array.from(document.querySelectorAll('div.g, div.MjjYud, div.v7W49e, div.tF2Cxc'));
        return blocks.map(div => {
          const link = div.querySelector('a') as HTMLAnchorElement | null;
          const h3 = div.querySelector('h3') as HTMLElement | null;
          const snippet = div.querySelector('div.VwiC3b, div.yXK7Cc, span.aCOpRe') as HTMLElement | null;
          return { url: link?.href || "", title: h3?.textContent || link?.textContent || "", snippet: snippet?.textContent || "" };
        }).filter(e => e.url && e.title);
      });
    } catch (googleError) {
      console.warn("[MultiPlatform] Google search failed or blocked. Trying DuckDuckGo failover...");
      try {
        const siteQuery2 = platforms.map(p => `site:${p.domain}`).join(' OR ');
        const googleQuery2 = `(${query}) "${location}" (${siteQuery2})`;
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(googleQuery2)}`;
        await page.goto(ddgUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
        entries = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.web-result')).map(div => ({
            url: (div.querySelector('.result__url') as HTMLAnchorElement)?.href || "",
            title: (div.querySelector('.result__title') as HTMLElement)?.textContent || "",
            snippet: (div.querySelector('.result__snippet') as HTMLElement)?.textContent || ""
          })).filter(e => e.url && e.title);
        });
        console.log(`[MultiPlatform] DuckDuckGo fallback found ${entries.length} results.`);
      } catch (ddgError) {
        console.error("[MultiPlatform] DuckDuckGo fallback failed too:", ddgError);
      }
    }

    await browser.close();

    const targetRoles = targetTitlesOverride || [];
    return entries
      .filter(e => !e.url.includes('google.com') && !e.url.includes('duckduckgo.com'))
      .map(entry => {
        const matchedPlatform = platforms.find(p => entry.url.includes(p.domain));
        const source = matchedPlatform ? matchedPlatform.name : "Search Index";
        const parts = entry.title.split(' - ');
        const titleClean = parts[0] || entry.title;
        const company = parts.length > 1 ? parts[1].trim() : "Enterprise Partner";
        const matchScore = targetRoles.length > 0 ? heuristicMatchScore(titleClean, targetRoles, alternativeTitlesOverride || []) : 75;
        return {
          id: Math.random().toString(36).substring(7),
          title: titleClean,
          company,
          location,
          description: entry.snippet || `Job listing on ${source}`,
          score: matchScore,
          reason: `Match strength: ${matchScore}% computed via target role relevance matching.`,
          status: 'Discovery' as const,
          url: entry.url,
          source,
          createdAt: new Date().toISOString()
        };
      });

  } catch (error: any) {
    console.warn('[MultiPlatform] Browser-based search unavailable (no browser runtime):', error.message);
    if (browser) { try { await browser.close(); } catch {} }
    return [];
  }
}




export async function scanCompanyJobs(companyName: string, targetTitles: string[], targetLocations: string[], careerUrl?: string, alternativeTitles: string[] = []): Promise<Job[]> {
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
              const score = targetTitles.length > 0 ? heuristicMatchScore(j.title, targetTitles, alternativeTitles) : 75;
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
              const score = targetTitles.length > 0 ? heuristicMatchScore(j.title, targetTitles, alternativeTitles) : 75;
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
  
  const { chromium } = await import('playwright');
  let browser;
  try {
    browser = await getBrowserInstance(chromium);
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

export async function rankTargetRoles(profileIdOverride?: string): Promise<{ roles: Array<{ title: string; score: number; reason: string }>; primaryActiveArchetype: string }> {
  try {
    const profileId = profileIdOverride || await getActiveProfileId();
    const profile = await getProfile(profileId);
    if (!profile) throw new Error("Profile not found");

    const targetTitles = profile.targetTitles || [];
    if (targetTitles.length === 0) {
      return { roles: [], primaryActiveArchetype: "" };
    }

    const skills = profile.skills || [];
    const experience = profile.experience || [];
    const summary = profile.resumeText || "";
    const targetPay = profile.salaryExpectations 
      ? `${profile.salaryExpectations.currency} ${profile.salaryExpectations.minimumAcceptable} - ${profile.salaryExpectations.targetSalary}`
      : "Not specified";

    const prompt = `
      You are an expert AI HR assistant and Job Market Analyst.
      
      CANDIDATE PROFILE:
      - SUMMARY/RESUME: ${summary.substring(0, 4000)}
      - SKILLS: ${skills.join(", ")}
      - EXPERIENCE: ${JSON.stringify(experience).substring(0, 2000)}
      - TARGET PAY RANGE: ${targetPay}
      
      TARGET ROLES TO EVALUATE:
      ${targetTitles.map((t: string) => `- ${t}`).join("\n")}
      
      TASK:
      For each target role, evaluate:
      1. EXPERIENCE MATCH (40% weight): Profile fit to role requirements.
      2. MARKET DEMAND (40% weight): General hiring volume and open postings in the market.
      3. COMPENSATION RANGE ALIGNMENT (20% weight): Target pay vs. typical market pay.
      
      Assign a composite score (0-100) and identify the single absolute "Primary Active Archetype" (highest overall score).
      
      RETURN JSON FORMAT EXACTLY:
      {
        "roles": [
          {
            "title": "Target Role Title",
            "score": 85,
            "reason": "Explain match/gaps based on candidate's skills, experience, market demand, and compensation."
          }
        ],
        "primaryActiveArchetype": "Target Role Title"
      }
    `;

    const response = await generateWithAI(prompt, { jsonMode: true, profileIdOverride: profileId });
    return response as { roles: Array<{ title: string; score: number; reason: string }>; primaryActiveArchetype: string };
  } catch (error) {
    console.error("rankTargetRoles server error:", error);
    return { roles: [], primaryActiveArchetype: "" };
  }
}

export async function checkApiKeysStatus() {
  return {
    jsearch: !!(process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY),
    adzuna: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    usajobs: !!(process.env.USAJOBS_API_KEY && process.env.USAJOBS_USER_EMAIL),
    browserless: !!process.env.BROWSERLESS_API_KEY
  };
}


