"use server";

import { chromium } from "playwright";
import { Job } from "@/lib/db";
import { fetchUserProfile, fetchJobs } from "./jobActions";
import { setAgentStatus, getAgentStatus } from "./agentStatus";
import { getJobs, saveJobs } from "@/lib/storage";
import { getActiveProfileId } from "./profileSwitch";

import path from "path";
import fs from "fs/promises";

export async function runBulkSubmissions(jobs: Job[]) {
  const profile = await fetchUserProfile();
  if (!profile) throw new Error("No profile found for submission.");

  await setAgentStatus({ 
    isSubmitting: true, 
    status: `Starting ${jobs.length} missions...`,
    progress: 5 
  });

  let browser;
  try {
    const browserlessKey = process.env.BROWSERLESS_API_KEY;
    if (browserlessKey && browserlessKey !== "") {
      console.log("Connecting to Cloud Chromium via Browserless...");
      browser = await chromium.connectOverCDP(`wss://chrome.browserless.io?token=${browserlessKey}`);
    } else {
      console.log("Launching Local Chromium...");
      browser = await chromium.launch({ 
        headless: false,
        slowMo: 100,
        timeout: 30000 // 30s launch timeout
      }); 
    }
  } catch (launchError: any) {
    console.error("Browser launch failed:", launchError);
    await setAgentStatus({ isSubmitting: false, status: `Launch Error: ${launchError.message}` });
    return;
  }

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const progress = Math.round(((i + 1) / jobs.length) * 100);
      
      try {
        await setAgentStatus({ 
          status: `[Mission ${i+1}/${jobs.length}] Navigating to ${job.company}...`,
          currentJobTitle: job.title,
          progress: Math.max(5, progress - 10) 
        });

        await page.goto(job.url, { waitUntil: 'networkidle', timeout: 60000 });
        
        const isSupportedPlatform = job.url.includes('lever.co') || job.url.includes('greenhouse.io') || job.url.includes('workable.com');
        
        // Handle LinkedIn specifically
        if (page.url().includes('linkedin.com')) {
          await waitForHuman(page, "LinkedIn login/application detected. Please handle Easy Apply or login, then click 'Resume'.");
        } else if (!isSupportedPlatform) {
          // Custom portal - assist the human
          await waitForHuman(page, `Custom platform detected for ${job.company}. Please fill the form, upload your tailored resume, submit the application, and then click 'Resume' here.`);
        } else {
          // Lever/Greenhouse specific: If we are on the description page, click 'Apply'
          const applyButtons = ['Apply for this job', 'Apply Now', 'Apply to this job'];
          for (const text of applyButtons) {
            const btn = page.getByRole('button', { name: text }).or(page.getByRole('link', { name: text })).or(page.getByText(text)).first();
            if (await btn.isVisible()) {
              await setAgentStatus({ status: "Clicking 'Apply' button...", progress: 30 });
              await btn.click();
              await page.waitForLoadState('networkidle');
              break;
            }
          }
          
          // Detect login wall
          const loginIndicators = ['Continue with Google', 'Sign in to apply', 'Log in', 'Apply with LinkedIn', 'Sign in'];
          let needsHuman = false;
          for (const text of loginIndicators) {
            const found = await page.getByText(text, { exact: false }).isVisible().catch(() => false);
            if (found) {
              needsHuman = true;
              break;
            }
          }

          if (needsHuman) {
            await waitForHuman(page, "Login wall detected. Please bypass in the browser window, then click 'Resume'.");
          }

          await setAgentStatus({ status: `Processing form for ${job.company}...`, progress: 50 });
          await fillJobApplication(page, job, profile);
          
          // FINAL HUMAN REVIEW (Guardrail)
          await waitForHuman(page, "Form filled. Please REVIEW the data, UPLOAD your resume, and click SUBMIT on the site. Then click 'Resume' here.");

          // Verification Check: Look for success indicators
          await page.waitForTimeout(2000);
          const successIndicators = ['Thank you', 'Application received', 'Success', 'submitted', 'received your application', 'Confirmation'];
          let confirmed = false;
          const pageText = await page.innerText('body').catch(() => "");
          for (const indicator of successIndicators) {
            if (pageText.toLowerCase().includes(indicator.toLowerCase())) {
              confirmed = true;
              break;
            }
          }

          if (confirmed) {
            // Take a screenshot as "Proof of Work"
            const screenshotPath = `public/proofs/${job.id}.png`;
            await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`Proof of work saved to ${screenshotPath}`);

            // Update job status in DB
            const profileId = await getActiveProfileId();
            const allJobs = await getJobs(profileId);
            const updated = allJobs.map((j: any) => j.id === job.id ? { 
              ...j, 
              status: 'applied', 
              date: new Date().toISOString(),
              applicationStatus: { stage: 'submitted', lastUpdated: new Date().toISOString() } 
            } : j);
            await saveJobs(updated, profileId);
          } else {
            console.warn(`[Submission] Could not confirm success for ${job.company}. Leaving status as 'ready'.`);
            await setAgentStatus({ status: `Could not verify submission for ${job.company}. Manual check suggested.` });
          }
        }

      } catch (e: any) {
        console.error(`Failed to submit for ${job.company}:`, e.message);
        await setAgentStatus({ status: `Skipped ${job.company} due to error.` });
      }
    }
    
    await setAgentStatus({ 
      isSubmitting: false, 
      status: `Successfully completed mission sequence.`,
      progress: 100 
    });

  } catch (error: any) {
    console.error("Bulk submission failed:", error);
    await setAgentStatus({ isSubmitting: false, status: `Error: ${error.message}` });
  } finally {
    if (browser) await browser.close();
  }
}

async function waitForHuman(page: any, message: string) {
  await setAgentStatus({ 
    needsApproval: true, 
    status: message 
  });
  
  console.log(`[Submission] Waiting for human approval: ${message}`);
  
  // Poll for approval
  let approved = false;
  while (!approved) {
    const status = await getAgentStatus();
    if (status.needsApproval === false) {
      approved = true;
    } else {
      // Check if browser was closed or crashed
      if (page.isClosed()) throw new Error("Browser was closed during human interaction.");
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}


async function fillJobApplication(page: any, job: Job, profile: any) {
  // 1. Identify Fields (Semantic Selectors)
  const selectors = {
    firstName: ['input[name*="first_name"]', 'input[name*="firstname"]', 'input[id*="first_name"]'],
    lastName: ['input[name*="last_name"]', 'input[name*="lastname"]', 'input[id*="last_name"]'],
    fullName: ['input[name*="full_name"]', 'input[name*="name"]', 'input[placeholder*="name"]'],
    email: ['input[type="email"]', 'input[name*="email"]'],
    phone: ['input[type="tel"]', 'input[name*="phone"]'],
    resume: ['input[type="file"][name*="resume"]', 'input[type="file"][id*="resume"]'],
    coverLetter: [
      'textarea[name*="cover_letter"]', 
      'textarea[id*="cover"]', 
      'textarea[placeholder*="cover"]',
      'textarea[name*="additional"]',
      'textarea[id*="additional"]',
      'textarea[placeholder*="additional"]',
      'textarea[name*="message"]',
      'textarea[placeholder*="message"]'
    ]
  };

  // 2. Fill standard text fields
  for (const [key, list] of Object.entries(selectors)) {
    if (key === 'resume') continue;
    for (const selector of list) {
      try {
        const el = await page.$(selector);
        if (el && await el.isVisible()) {
          let val = "";
          const nameParts = profile.fullName.trim().split(/\s+/);
          
          if (key === 'firstName') val = nameParts[0];
          else if (key === 'lastName') val = nameParts.length > 1 ? nameParts.slice(1).join(' ') : "";
          else if (key === 'fullName') val = profile.fullName;
          else if (key === 'email') val = profile.email;
          else if (key === 'phone') val = profile.phone;
          else if (key === 'coverLetter') {
            val = job.coverLetterText || job.tailoredResumeText || ""; // Fallback to tailored text if cover letter empty
          }
          
          if (val) {
            console.log(`Filling ${key} with value...`);
            await el.clear(); // Clear existing content if any
            await el.fill(val);
          }
          break; 
        }
      } catch (e) {}
    }
  }

  // 3. Handle Resume (If tailored text exists, we'd ideally upload a generated PDF, but for now we'll log)
  console.log("Resume field detection complete. Manual upload may be required if no file input found.");
  
  // 4. Wait for user to review (In pilot mode)
  await page.waitForTimeout(15000); 
}
