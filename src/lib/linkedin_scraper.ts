// import stealth from 'puppeteer-extra-plugin-stealth';


// chromium.use(stealth()); // Removed to fix utils.typeOf runtime error in Next.js environment


export async function searchLinkedInJobs(query: string, location: string, radius: number = 25) {
  const { chromium } = await import('playwright');
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  const browser = browserlessKey 
    ? await chromium.connectOverCDP(`wss://chrome.browserless.io?token=${browserlessKey}`)
    : await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  
  // Manual Stealth Injection: Overrides native browser properties to mask automation
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    (window as any).chrome = { runtime: {} };
  });
  
  const page = await context.newPage();

  // URL Encode and inject the radius/distance parameter
  const encodedQuery = encodeURIComponent(query);
  const encodedLocation = encodeURIComponent(location);
  const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedQuery}&location=${encodedLocation}&distance=${radius}&f_TPR=r2592000`; 
  // f_TPR=r2592000 means "Past Month". We could narrow it to past week.

  console.log(`[Scraper] Searching LinkedIn (Radius: ${radius}m): ${searchUrl}`);
  
  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 15000 });
    
    // Wait for the job cards container
    await page.waitForSelector('.jobs-search__results-list, .base-card', { timeout: 10000 });
    
    // Scroll a bit to lazy-load images and data
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
        
        // Extract a reliable ID from the URL (e.g. view/12345678)
        const idMatch = url.match(/-(\d+)$/) || url.match(/\/view\/(\d+)/);
        const id = idMatch ? idMatch[1] : Math.random().toString(36).substring(7);
        
        // Look for signs it's closed or an old post
        const listDate = card.querySelector('time')?.getAttribute('datetime') || '';
        
        return { 
          id, 
          title, 
          company, 
          location, 
          url, 
          source: 'LinkedIn',
          listDate
        };
      });
    });

    await browser.close();
    
    // Filter out jobs that failed to parse a title or company
    return jobs.filter(j => j.title && j.company);

  } catch (error: any) {
    console.error('[Scraper] LinkedIn scraping failed:', error.message);
    await browser.close();
    return [];
  }
}

export async function scrapeJobDescription(url: string): Promise<string> {
  const { chromium } = await import('playwright');
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  const browser = browserlessKey 
    ? await chromium.connectOverCDP(`wss://chrome.browserless.io?token=${browserlessKey}`)
    : await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  try {
    console.log(`[Scraper] Fetching description from: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    
    // LinkedIn Public Job Page selectors
    const description = await page.evaluate(() => {
      const selectors = [
        '.show-more-less-html__markup',
        '.description__text',
        '.job-view-main-content',
        '#job-details'
      ];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent?.trim()) return el.textContent.trim();
      }
      return '';
    });
    
    await browser.close();
    return description || "Failed to extract description from page.";
  } catch (error) {
    console.error('[Scraper] Failed to scrape description:', error);
    await browser.close();
    return "Error fetching description.";
  }
}

export async function scrapePublicLinkedInProfile(url: string): Promise<string> {
  const { chromium } = await import('playwright');
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  const browser = browserlessKey 
    ? await chromium.connectOverCDP(`wss://chrome.browserless.io?token=${browserlessKey}`)
    : await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  try {
    console.log(`[Scraper] Fetching public LinkedIn profile: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    
    // Wait for main top card or profile content
    await page.waitForSelector('.top-card-layout, main, body', { timeout: 10000 });
    
    // Extract main texts
    const profileText = await page.evaluate(() => {
      const selectors = [
        '.top-card-layout',
        'section.experience',
        'section.education',
        'section.skills',
        'section.summary',
        '.core-section-container'
      ];
      let results: string[] = [];
      
      const title = document.title;
      results.push(`Title: ${title}`);
      
      for (const selector of selectors) {
        const els = document.querySelectorAll(selector);
        els.forEach(el => {
          if (el.textContent?.trim()) {
            results.push(el.textContent.trim().replace(/\s+/g, ' '));
          }
        });
      }
      
      if (results.length <= 1) {
        const bodyText = document.body.innerText || "";
        return bodyText.slice(0, 8000);
      }
      
      return results.join("\n\n");
    });

    const currentUrl = page.url();
    const textLower = profileText.toLowerCase();

    if (
      currentUrl.includes("authwall") || 
      currentUrl.includes("login") || 
      currentUrl.includes("signup") || 
      textLower.includes("authwall") || 
      textLower.includes("sign in to linkedin") || 
      textLower.includes("join linkedin") || 
      textLower.includes("agree & join") ||
      (textLower.includes("security") && textLower.includes("verification"))
    ) {
      throw new Error("LinkedIn authentication wall block encountered. Please manually copy-paste the profile details into the source text area or upload a resume.");
    }
    
    await browser.close();
    return profileText;
  } catch (error: any) {
    console.error('[Scraper] Profile scrape failed:', error.message);
    await browser.close();
    throw new Error(error.message.includes("authentication wall") ? error.message : `Failed to scrape profile: ${error.message}`);
  }
}
