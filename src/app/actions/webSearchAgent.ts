"use server";

import { Job } from "@/lib/db";
import crypto from "crypto";
import { setAgentStatus } from "./agentStatus";
import { fetchJSearchJobs } from "@/app/actions/jobActions";
import { heuristicMatchScore, isTitleMatch } from "@/lib/jobUtils";

/**
 * Checks if a job URL or publisher indicates a direct-apply / ATS landing page
 * rather than a generic aggregate job board.
 */
function isDeepWebMatch(url: string, publisher: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  const lowerPub = (publisher || "").toLowerCase();

  // Direct ATS matches
  const directAtsKeywords = [
    "greenhouse.io",
    "lever.co",
    "workable.com",
    "bamboohr.com",
    "recruitee.com",
    "smartrecruiters.com",
    "myworkdayjobs.com",
    "applytojob.com",
    "ashbyhq.com",
    "rippling.com"
  ];

  if (directAtsKeywords.some(keyword => lowerUrl.includes(keyword) || lowerPub.includes(keyword.split('.')[0]))) {
    return true;
  }

  // Major aggregators we want to FILTER OUT
  const aggregators = [
    "indeed.com",
    "ziprecruiter.com",
    "linkedin.com",
    "glassdoor.com",
    "monster.com",
    "careerbuilder.com",
    "simplyhired.com",
    "snagajob.com",
    "jooble.org",
    "lensa.com",
    "jobrapido",
    "talent.com",
    "salary.com",
    "geebo.com"
  ];

  if (aggregators.some(agg => lowerUrl.includes(agg) || lowerPub.includes(agg.split('.')[0]))) {
    return false;
  }

  // If it's not a known aggregator and points to a generic company domain (like BostonWhaler.com/careers or UniversalOrlando.com)
  // it is a highly valuable direct-employer listing!
  return true;
}

export async function runWebDiscovery(
  targetTitles: string[],
  targetLocations: string[],
  radius: number = 25,
  dreamCompanies: Array<{ name: string; careerUrl?: string }> = [],
  alternativeTitles: string[] = [],
  strictness: 'exact' | 'strong' | 'flexible' = 'exact'
): Promise<Job[]> {
  const results: Job[] = [];
  const seenUrls = new Set<string>();

  console.log(`[Deep Search] Starting direct ATS scan for ${targetTitles.length} roles...`);
  await setAgentStatus({ status: "Deep Scan: Scanning Direct ATS boards...", resultsFound: 0 });

  // 1. Scan Greenhouse & Lever boards of the user's Dream Companies directly (No browser needed)
  if (dreamCompanies && dreamCompanies.length > 0) {
    for (const company of dreamCompanies) {
      if (!company.careerUrl) continue;
      const lowerUrl = company.careerUrl.toLowerCase();
      
      try {
        // Greenhouse direct board API scan
        if (lowerUrl.includes("greenhouse.io")) {
          let companyToken = "";
          const match = company.careerUrl.match(/boards\.greenhouse\.io\/([^/?#]+)/);
          if (match && match[1]) {
            companyToken = match[1];
          } else {
            const urlObj = new URL(company.careerUrl.startsWith("http") ? company.careerUrl : `https://${company.careerUrl}`);
            const parts = urlObj.pathname.split("/").filter(Boolean);
            companyToken = parts[parts.length - 1] || "";
          }

          if (companyToken && companyToken !== "embed" && companyToken !== "job_board") {
            console.log(`[Deep Search] Scanning Greenhouse directly: ${company.name} (${companyToken})`);
            const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${companyToken}/jobs`, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
              const data = await res.json();
              const jobsList = data.jobs || [];
              for (const j of jobsList) {
                const isMatch = isTitleMatch(j.title, targetTitles, alternativeTitles, strictness);
                const score = targetTitles.length > 0 ? heuristicMatchScore(j.title, targetTitles, alternativeTitles) : 75;
                if (isMatch && !seenUrls.has(j.absolute_url)) {
                  seenUrls.add(j.absolute_url);
                  results.push({
                    id: `ats-${j.id}`,
                    title: j.title,
                    company: company.name,
                    location: j.location?.name || targetLocations[0] || "Local Presence",
                    description: `Direct ATS role at ${company.name}. Department: ${j.departments?.[0]?.name || 'N/A'}.`,
                    score: score,
                    reason: `Direct Greenhouse ATS scan (Match fit: ${score}%)`,
                    status: 'Discovery',
                    url: j.absolute_url,
                    source: 'Greenhouse',
                    createdAt: new Date().toISOString()
                  });
                }
              }
            }
          }
        }

        // Lever direct board API scan
        if (lowerUrl.includes("lever.co")) {
          let companyToken = "";
          const match = company.careerUrl.match(/jobs\.lever\.co\/([^/?#]+)/);
          if (match && match[1]) {
            companyToken = match[1];
          } else {
            const urlObj = new URL(company.careerUrl.startsWith("http") ? company.careerUrl : `https://${company.careerUrl}`);
            const parts = urlObj.pathname.split("/").filter(Boolean);
            companyToken = parts[0] || "";
          }

          if (companyToken) {
            console.log(`[Deep Search] Scanning Lever directly: ${company.name} (${companyToken})`);
            const res = await fetch(`https://api.lever.co/v0/postings/${companyToken}?mode=json`, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
              const jobsList = await res.json();
              for (const j of jobsList) {
                const isMatch = isTitleMatch(j.title, targetTitles, alternativeTitles, strictness);
                const score = targetTitles.length > 0 ? heuristicMatchScore(j.title, targetTitles, alternativeTitles) : 75;
                if (isMatch && !seenUrls.has(j.hostedUrl)) {
                  seenUrls.add(j.hostedUrl);
                  results.push({
                    id: `ats-${j.id}`,
                    title: j.title,
                    company: company.name,
                    location: j.categories?.location || targetLocations[0] || "Local Presence",
                    description: j.description || `Direct ATS role at ${company.name}.`,
                    score: score,
                    reason: `Direct Lever ATS scan (Match fit: ${score}%)`,
                    status: 'Discovery',
                    url: j.hostedUrl,
                    source: 'Lever',
                    createdAt: new Date().toISOString()
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[Deep Search] Failed to scan direct board for ${company.name}:`, err);
      }
    }
  }

  await setAgentStatus({ resultsFound: results.length });

  // 2. Query JSearch with target titles & locations, and filter for direct employer/ATS URLs
  console.log("[Deep Search] Searching web indexes for direct apply listings...");
  const startTime = Date.now();
  for (const title of targetTitles) {
    if (Date.now() - startTime > 20000) {
      console.warn("[Deep Search] Approaching 22s function timeout. Breaking search loop early.");
      break;
    }
    for (const location of targetLocations) {
      await setAgentStatus({ status: `Deep Search: Crawling direct listings for "${title}"...` });
      try {
        const jsearchJobs = await fetchJSearchJobs(title, location);
        for (const j of jsearchJobs) {
          if (seenUrls.has(j.url)) continue;

          // Filter strictly for Deep Web (direct apply / ATS)
          if (isDeepWebMatch(j.url, j.source)) {
            const isMatch = isTitleMatch(j.title, targetTitles, alternativeTitles, strictness);
            if (!isMatch) continue;

            seenUrls.add(j.url);
            
            // Score the job title
            const score = heuristicMatchScore(j.title, targetTitles, alternativeTitles);
            
            results.push({
              ...j,
              score: score,
              reason: `Direct Apply / ATS source discovered: ${j.source}`,
              status: 'Discovery'
            });
          }
        }
      } catch (err) {
        console.error(`[Deep Search] Failed search for "${title}" in "${location}":`, err);
      }
    }
  }

  // 3. Fallback: if results are low (< 5), broaden to return direct employer links regardless of publisher
  if (results.length < 5) {
    console.log("[Deep Search] Broadening search to capture additional local listings...");
    for (const title of targetTitles) {
      for (const location of targetLocations) {
        try {
          const jsearchJobs = await fetchJSearchJobs(title, location);
          for (const j of jsearchJobs) {
            if (seenUrls.has(j.url)) continue;
            
            // Broad matching: accept any listing that isn't on a giant aggregator
            const isAggregator = ["indeed.com", "linkedin.com", "ziprecruiter.com"].some(agg => j.url.toLowerCase().includes(agg));
            if (!isAggregator) {
              const isMatch = isTitleMatch(j.title, targetTitles, alternativeTitles, strictness);
              if (!isMatch) continue;

              seenUrls.add(j.url);
              const score = heuristicMatchScore(j.title, targetTitles, alternativeTitles);
              results.push({
                ...j,
                score: score,
                reason: `Direct employer listing found via local index.`,
                status: 'Discovery'
              });
            }
          }
        } catch (e) {}
      }
    }
  }

  console.log(`[Deep Search] Completed. Discovered ${results.length} total direct-apply roles.`);
  await setAgentStatus({ status: `Deep Search complete. Found ${results.length} direct openings.` });
  return results;
}

