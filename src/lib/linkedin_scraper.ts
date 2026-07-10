// Playwright-based scrapers — all wrapped in try/catch so they fail gracefully
// on serverless environments (Netlify, Vercel) where Chromium binaries are unavailable.
// The runJobSearch function falls back to the Remotive public API automatically.

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

export async function searchLinkedInJobs(query: string, location: string, radius: number = 25) {
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
    const encodedQuery = encodeURIComponent(query);
    const encodedLocation = encodeURIComponent(location);
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedQuery}&location=${encodedLocation}&distance=${radius}&f_TPR=r2592000`;

    console.log(`[Scraper] Searching LinkedIn (Radius: ${radius}m): ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.waitForSelector('.jobs-search__results-list, .base-card', { timeout: 5000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(1000);

    const jobs = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.base-card, .job-search-card'));
      return cards.slice(0, 15).map(card => {
        const title = card.querySelector('.base-search-card__title')?.textContent?.trim() || '';
        const company = card.querySelector('.base-search-card__subtitle')?.textContent?.trim() || '';
        const location = card.querySelector('.job-search-card__location')?.textContent?.trim() || '';
        const urlElement = card.querySelector('.base-card__full-link') as HTMLAnchorElement;
        const url = urlElement ? urlElement.href.split('?')[0] : '';
        const idMatch = url.match(/-(\d+)$/) || url.match(/\/view\/(\d+)/);
        const id = idMatch ? idMatch[1] : Math.random().toString(36).substring(7);
        const listDate = card.querySelector('time')?.getAttribute('datetime') || '';
        return { id, title, company, location, url, source: 'LinkedIn', listDate };
      });
    });

    await browser.close();
    return jobs.filter((j: any) => j.title && j.company);

  } catch (error: any) {
    console.warn('[Scraper] LinkedIn scraping unavailable:', error.message);
    if (browser) { try { await browser.close(); } catch {} }
    if (error.message && (error.message.includes("Browserless") || error.message.includes("401") || error.message.includes("Unauthorized") || error.message.includes("quota"))) {
      throw error;
    }
    return [];
  }
}

export async function scrapeJobDescription(url: string): Promise<string> {
  let browser: any = null;
  try {
    const { chromium } = await import('playwright');
    browser = await getBrowserInstance(chromium);
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    console.log(`[Scraper] Fetching description from: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });

    const description = await page.evaluate(() => {
      const selectors = ['.show-more-less-html__markup', '.description__text', '.job-view-main-content', '#job-details'];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent?.trim()) return el.textContent.trim();
      }
      return '';
    });

    await browser.close();
    return description || "Failed to extract description from page.";
  } catch (error: any) {
    console.warn('[Scraper] Playwright browser scraping failed, trying HTTP fallback:', error.message);
    if (browser) { try { await browser.close(); } catch {} }
    
    try {
      console.log(`[Scraper] HTTP Fallback Fetch for description: ${url}`);
      
      // Greenhouse Direct API Scraper
      if (url.includes("boards.greenhouse.io")) {
        const match = url.match(/boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
        if (match) {
          const [, board, jobId] = match;
          const apiRes = await fetch(`https://api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`);
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.content) {
              const cleanedText = data.content.replace(/<\/?[^>]+(>|$)/g, " ").replace(/\s+/g, " ").trim();
              return cleanedText;
            }
          }
        }
      }

      // Lever Direct API Scraper
      if (url.includes("jobs.lever.co")) {
        const match = url.match(/jobs\.lever\.co\/([^/]+)\/([^/]+)/);
        if (match) {
          const [, company, jobId] = match;
          const apiRes = await fetch(`https://api.lever.co/v0/postings/${company}/${jobId}`);
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.description || data.lists) {
              const sections = [
                data.description || "",
                ...(data.lists || []).map((l: any) => `${l.text}\n${(l.content || "").replace(/<\/?[^>]+(>|$)/g, "\n")}`)
              ];
              const fullDesc = sections.join("\n\n");
              const cleanedText = fullDesc.replace(/<\/?[^>]+(>|$)/g, " ").replace(/\s+/g, " ").trim();
              return cleanedText;
            }
          }
        }
      }

      // General direct HTTP HTML-text extraction fallback
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!res.ok) {
        throw new Error(`HTTP fetch returned status ${res.status}`);
      }
      
      const html = await res.text();
      
      // Strip script, style, comments
      const cleanHtml = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

      // Extract raw visual text lines
      const textLines = cleanHtml
        .replace(/<\/?[^>]+(>|$)/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Filter out footer links/boilerplate
      const filteredLines = textLines.filter(line => {
        const lower = line.toLowerCase();
        if (lower.includes("copyright") || lower.includes("all rights reserved") || lower.includes("terms of service") || lower.includes("privacy policy")) return false;
        return true;
      });

      const finalDesc = filteredLines.join('\n');
      if (finalDesc.length > 200) {
        return finalDesc.slice(0, 15000);
      }
      
      throw new Error("Extracted text too short or empty.");
    } catch (fallbackErr: any) {
      console.warn('[Scraper] HTTP Fallback failed:', fallbackErr.message || fallbackErr);
      if (error.message && (error.message.includes("Browserless") || error.message.includes("401") || error.message.includes("Unauthorized") || error.message.includes("quota"))) {
        throw error;
      }
      return "Job description unavailable. Scraper offline & HTTP fallback failed. Please copy and paste the job description below.";
    }
  }
}

export async function scrapePublicLinkedInProfile(url: string): Promise<string> {
  let browser: any = null;
  try {
    const { chromium } = await import('playwright');
    browser = await getBrowserInstance(chromium);
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    console.log(`[Scraper] Fetching public LinkedIn profile: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForSelector('.top-card-layout, main, body', { timeout: 5000 });

    const profileText = await page.evaluate(() => {
      const selectors = [
        '.top-card-layout', 'section.experience', 'section.education',
        'section.skills', 'section.summary', '.core-section-container'
      ];
      let results: string[] = [];
      results.push(`Title: ${document.title}`);
      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach(el => {
          if (el.textContent?.trim()) {
            results.push(el.textContent.trim().replace(/\s+/g, ' '));
          }
        });
      }
      if (results.length <= 1) {
        return (document.body.innerText || "").slice(0, 8000);
      }
      return results.join("\n\n");
    });

    const currentUrl = page.url();
    const textLower = profileText.toLowerCase();

    if (
      currentUrl.includes("authwall") ||
      currentUrl.includes("login") ||
      currentUrl.includes("signup") ||
      textLower.includes("sign in to linkedin") ||
      textLower.includes("join linkedin") ||
      (textLower.includes("security") && textLower.includes("verification"))
    ) {
      throw new Error("LinkedIn authentication wall block encountered. Please manually copy-paste the profile details into the source text area or upload a resume.");
    }

    await browser.close();
    return profileText;
  } catch (error: any) {
    console.warn('[Scraper] scrapePublicLinkedInProfile unavailable (no browser runtime or auth wall):', error.message);
    if (browser) { try { await browser.close(); } catch {} }
    throw new Error(error.message?.includes("authentication wall") ? error.message : `Failed to scrape profile: ${error.message}`);
  }
}
