const { chromium } = require("playwright");

async function runQASuite() {
  console.log("\n========================================================");
  console.log("             JOB SENTINEL - QA TEST RUNNER              ");
  console.log("========================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const baseUrl = "http://localhost:3000";
  const results = [];

  const logTest = (name, status, details = "") => {
    results.push({ name, status, details });
    const icon = status === "PASS" ? "🟢" : "🔴";
    console.log(`${icon} [${status}] ${name} ${details ? `- ${details}` : ""}`);
  };

  try {
    // 1. Navigation Test
    console.log("1. Testing main navigation...");
    try {
      await page.goto(baseUrl, { timeout: 10000 });
      logTest("App Root Page Loading", "PASS");
    } catch (e) {
      logTest("App Root Page Loading", "FAIL", e.message);
    }

    // 2. Settings Configuration Check
    console.log("\n2. Auditing Agent Settings Page...");
    try {
      await page.goto(`${baseUrl}/settings`, { timeout: 10000 });
      const title = await page.textContent("h2");
      if (title.includes("Agent Settings")) {
        logTest("Settings Page Loading", "PASS");
      } else {
        logTest("Settings Page Loading", "FAIL", "Header title mismatch");
      }

      // Check key element fields
      const inputVal = await page.inputValue("input[type='password'], input[type='text']");
      logTest("API Key Input Exists", "PASS", inputVal ? "Key present" : "Input is blank");
    } catch (e) {
      logTest("Settings Page Loading", "FAIL", e.message);
    }

    // 3. Profile & Identity Hub (Resume Parsing Check)
    console.log("\n3. Testing Identity Hub & Parser Flow...");
    try {
      await page.goto(`${baseUrl}/profile`, { timeout: 10000 });
      const hasTextarea = await page.locator("textarea[placeholder*='resume']").isVisible();
      logTest("Textarea for resume exists", hasTextarea ? "PASS" : "FAIL");

      // Verify Scraper and Upload buttons exist
      const hasScrape = await page.locator("button:has-text('Scrape')").isVisible();
      const hasUpload = await page.locator("span:has-text('Upload')").isVisible();
      logTest("LinkedIn Scraper Interface Exists", hasScrape ? "PASS" : "FAIL");
      logTest("ATS Resume File Uploader Exists", hasUpload ? "PASS" : "FAIL");
    } catch (e) {
      logTest("Profile Page Loading & UI Checks", "FAIL", e.message);
    }

    // 4. Job Search Matching Engine
    console.log("\n4. Testing Job Matcher Navigation...");
    try {
      await page.goto(`${baseUrl}/search`, { timeout: 10000 });
      const buttons = await page.locator("button").allInnerTexts();
      const hasSearch = buttons.some(b => b.toLowerCase().includes("search") || b.toLowerCase().includes("scan"));
      logTest("Search Engine Button Present", hasSearch ? "PASS" : "FAIL");
    } catch (e) {
      logTest("Search Page Loading", "FAIL", e.message);
    }

    // 5. Job Applications Tracker
    console.log("\n5. Testing Tracker Table...");
    try {
      await page.goto(`${baseUrl}/tracker`, { timeout: 10000 });
      const tableExists = await page.locator("table").isVisible().catch(() => false);
      logTest("Applications Grid Board Present", tableExists ? "PASS" : "FAIL");
    } catch (e) {
      logTest("Tracker Page Loading", "FAIL", e.message);
    }

  } catch (globalError) {
    console.error("Critical Suite Failure:", globalError);
  } finally {
    await browser.close();
    console.log("\n========================================================");
    console.log("                    SUMMARY REPORT                      ");
    console.log("========================================================");
    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;
    console.log(`Passed: ${passed} | Failed: ${failed}`);
    console.log("========================================================\n");
    process.exit(failed > 0 ? 1 : 0);
  }
}

runQASuite();
