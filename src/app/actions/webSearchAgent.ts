"use server";

import { chromium } from "playwright";

// import stealth from "puppeteer-extra-plugin-stealth";

import { Job } from "@/lib/db";
import crypto from "crypto";
import { setAgentStatus } from "./agentStatus";

// chromium.use(stealth()); // Removed to fix utils.typeOf runtime error


export async function runWebDiscovery(targetTitles: string[], targetLocations: string[], radius: number = 25): Promise<Job[]> {
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  const browser = browserlessKey 
    ? await chromium.connectOverCDP(`wss://chrome.browserless.io?token=${browserlessKey}`)
    : await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  // Manual Stealth Injection: Overrides native browser properties to mask automation
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    // @ts-ignore
    window.chrome = { runtime: {} };
  });

  
  const results: Job[] = [];
  const platforms = [
    { site: 'lever.co', selector: 'lever' },
    { site: 'greenhouse.io', selector: 'greenhouse' },
    { site: 'workable.com', selector: 'workable' }
  ];

  try {
    console.log(`[Discovery] Starting optimized search for ${targetTitles.length} roles...`);
    
    // Group titles into chunks of 3 to reduce Google requests
    const titleChunks: string[][] = [];
    for (let i = 0; i < targetTitles.length; i += 3) {
      titleChunks.push(targetTitles.slice(i, i + 3));
    }

    for (const chunk of titleChunks) {
      for (const rawLocation of targetLocations) {
        let searchLocation = rawLocation;
        if (radius > 50 && !rawLocation.toLowerCase().includes('uk')) {
          searchLocation = `${rawLocation} or nearby UK`;
        }

        for (const platform of platforms) {
          const chunkQuery = chunk.map(t => t.includes(' ') ? `"${t}"` : t).join(' OR ');
          await setAgentStatus({ status: `Deep Discovery: Scanning ${platform.site} for matches...` });
        
          const query = `site:${platform.site} (${chunkQuery}) ${searchLocation} -site:linkedin.com -site:indeed.com`;
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          
          console.log(`[Discovery] Optimized Query: ${query}`);
          await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });



        // Check for CAPTCHA or 'Unusual Traffic'
        const isBlocked = await page.evaluate(() => {
          return document.body.innerText.includes('unusual traffic') || 
                 document.body.innerText.includes('not a robot') ||
                 !!document.querySelector('#captcha-form');
        });

        if (isBlocked) {
          console.error("GOOGLE BLOCK DETECTED");
          await setAgentStatus({ status: "Discovery Paused: Google detected automated traffic. Cooling down..." });
          await page.waitForTimeout(10000); // Cool down
          break; 
        }
        
        // Human-like Interaction: Scroll down to simulate reading
        await page.evaluate(() => window.scrollTo({ top: Math.random() * 500, behavior: 'smooth' }));
        await page.waitForTimeout(1500);

        // Robust result extraction using modern Google selectors
        const entries = await page.evaluate((site) => {
          // Modern Google uses various classes for result blocks
          const blocks = Array.from(document.querySelectorAll('div.g, div.MjjYud, div.v7W49e, div.tF2Cxc'));
          return blocks.map(div => {
            const link = div.querySelector('a') as HTMLAnchorElement | null;
            const h3 = div.querySelector('h3') as HTMLElement | null;
            // Extract snippet from common Google containers
            const snippet = div.querySelector('div.VwiC3b, div.yXK7Cc, span.aCOpRe, div.MU19be') as HTMLElement | null;
            
            return {
              href: link?.href || "",
              title: h3?.textContent || link?.textContent || "",
              snippet: snippet?.textContent || ""
            };
          }).filter(e => e.href.includes(site) && !e.href.includes('google.com') && e.title);
        }, platform.site);


        console.log(`[Discovery] Found ${entries.length} raw results for ${platform.site}`);

        for (const entry of entries.slice(0, 5)) { 
          // Extract company from URL
          let company = "Independent";
          let location = targetLocations[0] || "Remote"; 
          
          try {
            const url = new URL(entry.href);
            const domainParts = url.hostname.split('.');
            // Greenhouse: boards.greenhouse.io/company
            // Lever: jobs.lever.co/company
            // Workable: apply.workable.com/company
            const pathParts = url.pathname.split('/').filter(p => p);
            
            if (url.hostname.includes('lever.co')) company = pathParts[0] || "Lever";
            else if (url.hostname.includes('greenhouse.io')) company = pathParts[0] || "Greenhouse";
            else if (url.hostname.includes('workable.com')) company = pathParts[0] || "Workable";
            
            company = company.charAt(0).toUpperCase() + company.slice(1);

            // Attempt to find a more specific location in the snippet
            const snippetLower = entry.snippet.toLowerCase();
            const locationMatches = entry.snippet.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*), (?:UK|United Kingdom|England|US|USA|London)/);
            if (locationMatches) {
              location = locationMatches[0];
            } else if (snippetLower.includes('remote')) {
              location = "Remote";
            }
          } catch (e) {}

          // Prevent duplicates in current session
          if (results.some(r => r.url === entry.href)) continue;

          results.push({
            id: crypto.randomUUID(),
            title: entry.title.split(' - ')[0] || chunk[0] || "Staff Designer", 
            company: company,

            location: location,
            description: entry.snippet || `Deep web match on ${platform.site}`,
            score: 0,
            reason: "",
            status: 'Discovery',
            url: entry.href,
            source: platform.site,
            createdAt: new Date().toISOString()
          });
        }
        
        // Longer Human-like delay (3-7 seconds)
        const delay = Math.floor(Math.random() * 4000) + 3000;
        await page.waitForTimeout(delay);
      }
    }
  }
  } catch (error) {
    console.error("Web discovery failed:", error);
  } finally {
    await browser.close();
  }

  // Fallback if Google CAPTCHA block occurred
  if (results.length === 0) {
    console.log("[Discovery] Google block occurred or no results. Activating Deep Fallback search via Remotive Index...");
    await setAgentStatus({ status: "Google limit reached. Running Deep Fallback search..." });
    try {
      const searchTitle = targetTitles[0] || "Designer";
      const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(searchTitle)}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const rawList = data.jobs || [];
        
        for (const j of rawList) {
          const titleMatches = targetTitles.some(t => j.title.toLowerCase().includes(t.toLowerCase()));
          if (!titleMatches) continue;

          // Check if this job redirects to Greenhouse/Lever/Workable
          let source = "Deep Index";
          if (j.url.includes("lever.co")) source = "lever.co";
          else if (j.url.includes("greenhouse.io")) source = "greenhouse.io";
          else if (j.url.includes("workable.com")) source = "workable.com";
          
          results.push({
            id: crypto.randomUUID(),
            title: j.title,
            company: j.company_name || "Enterprise Partner",
            location: j.candidate_required_location || "Remote",
            description: j.description ? j.description.substring(0, 300) + "..." : "Deep web fallback match.",
            score: 0,
            reason: "Fetched via Deep Web Fallback index.",
            status: 'Discovery',
            url: j.url,
            source: source,
            createdAt: new Date().toISOString()
          });
          
          if (results.length >= 10) break; // Limit to 10 fallback results
        }
      }
    } catch (fallbackError) {
      console.error("Deep fallback failed:", fallbackError);
    }
  }

  console.log(`[Discovery] Completed. Found ${results.length} unique matches.`);
  return results;
}

