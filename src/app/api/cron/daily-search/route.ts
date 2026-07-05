import { NextResponse } from "next/server";
import { listAllProfiles, fetchUserProfile, runJobSearch, findReferralRoutes, addJobs, updateJobStatus } from "@/app/actions/jobActions";
import { getProfile, saveProfile, getJobs, saveJobs } from "@/lib/storage";
import fs from "fs/promises";
import path from "path";

export async function GET(request: Request) {
  return handleDailySearch(request);
}

export async function POST(request: Request) {
  return handleDailySearch(request);
}

async function handleDailySearch(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    // Secure endpoints in production (optional CRON secret verification)
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[Cron] Starting daily background job search agent...");
    const profileIds = await listAllProfiles();
    const summaryReports: any[] = [];

    const startTime = Date.now();
    for (const profileId of profileIds) {
      if (Date.now() - startTime > 22000) {
        console.warn("[Cron] Approaching execution timeout (22s). Exiting daily search profile loop early.");
        break;
      }
      const profile = await getProfile(profileId);
      if (!profile || !profile.dailySearchEnabled) {
        console.log(`[Cron] Daily search disabled for profile: ${profileId}`);
        continue;
      }

      console.log(`[Cron] Running job search for profile: ${profileId} (${profile.fullName})`);
      
      const targetTitles = profile.targetTitles || [];
      const targetLocations = profile.targetLocations || [];
      const radius = profile.searchRadius || 25;
      const resumeText = profile.resumeText || "";
      const targetSites = profile.targetSites || [];
      const strictness = profile.matchStrictness || "exact";

      if (targetTitles.length === 0) {
        console.log(`[Cron] No target titles defined for profile: ${profileId}`);
        continue;
      }

      // Execute search scan
      // Note: runJobSearch internally fetches, filters, matches via Gemini, and adds matching jobs
      const jobsFound = await runJobSearch(
        targetTitles,
        targetLocations,
        radius,
        resumeText,
        targetSites,
        profileId,
        strictness
      );

      console.log(`[Cron] Scraper found ${jobsFound?.length || 0} jobs for ${profileId}`);

      // Filter to newly found high match jobs
      const highMatches = (jobsFound || []).filter(j => j.score >= 80);
      const jobsWithReferrals = [];

      for (const job of highMatches) {
        console.log(`[Cron] Searching network referral routes for high-match company: ${job.company}`);
        const referrals = await findReferralRoutes(job.company, profile);
        job.referralRoutes = referrals;
        jobsWithReferrals.push(job);
      }

      // If we got new jobs with referral routes, save the updated jobs to storage
      if (jobsWithReferrals.length > 0) {
        const existingJobs = await getJobs(profileId);
        const jobMap = new Map(existingJobs.map((j: any) => [j.id, j]));
        
        for (const updatedJob of jobsWithReferrals) {
          const current = jobMap.get(updatedJob.id);
          if (current) {
            jobMap.set(updatedJob.id, { ...current, referralRoutes: updatedJob.referralRoutes });
          }
        }
        await saveJobs(Array.from(jobMap.values()), profileId);
      }

      // Generate HTML digest
      if (highMatches.length > 0) {
        const reportHtml = generateHtmlReport(profile, highMatches);
        
        // Save the daily report locally for preview/backup
        const reportPath = path.join(process.cwd(), `data/profiles/${profileId}/daily_report.html`);
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, reportHtml, "utf-8");
        console.log(`[Cron] Daily HTML digest written to: ${reportPath}`);

        // Email sending integration
        if (process.env.RESEND_API_KEY && profile.email) {
          try {
            await sendEmailViaResend(profile.email, profile.fullName, reportHtml);
            console.log(`[Cron] Morning digest successfully sent to ${profile.email}`);
          } catch (resendError) {
            console.error(`[Cron] Failed to send email via Resend to ${profile.email}:`, resendError);
          }
        } else {
          console.log(`[Cron] Skipping email delivery for ${profile.fullName} (missing RESEND_API_KEY or email address)`);
        }

        summaryReports.push({
          profileId,
          recipient: profile.email,
          matchesCount: highMatches.length,
          savedReport: reportPath
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processedProfilesCount: summaryReports.length,
      reports: summaryReports
    });
  } catch (error: any) {
    console.error("[Cron] Daily search agent crashed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function generateHtmlReport(profile: any, matches: any[]): string {
  const jobItems = matches.map(j => {
    const referralHtml = j.referralRoutes && j.referralRoutes.length > 0
      ? `
        <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 12px; margin-top: 8px;">
          <h4 style="margin: 0 0 8px 0; color: #6d28d9; font-size: 13px;">👥 Potential Referral Routes Found:</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #4c1d95;">
            ${j.referralRoutes.map((r: any) => `
              <li>
                <strong>${r.name}</strong> - ${r.role} (${r.connectionType}) 
                ${r.profileUrl ? `<a href="${r.profileUrl}" target="_blank" style="color: #2563eb; text-decoration: underline; margin-left: 4px;">LinkedIn ↗</a>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `
      : '';

    return `
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; background-color: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h3 style="margin: 0; color: #1e293b; font-size: 16px;">${j.title}</h3>
            <p style="margin: 4px 0; color: #64748b; font-size: 13px;"><strong>${j.company}</strong> — ${j.location}</p>
          </div>
          <span style="background-color: #10b981; color: white; font-weight: bold; font-size: 12px; padding: 4px 8px; border-radius: 20px;">
            ${j.score}% Match
          </span>
        </div>
        <p style="margin: 8px 0; font-size: 13px; color: #334155;"><em>${j.reason}</em></p>
        ${referralHtml}
        <a href="${j.url}" target="_blank" style="display: inline-block; margin-top: 12px; font-size: 12px; font-weight: bold; color: white; background-color: #4f46e5; padding: 6px 12px; border-radius: 6px; text-decoration: none;">View Job Post ↗</a>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Job Sentinel Morning Digest</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0; color: #334155;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background-color: #4f46e5; padding: 24px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Job Sentinel</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Your Daily Autonomous Placement Report</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 15px; line-height: 1.5;">Hello ${profile.fullName},</p>
          <p style="font-size: 15px; line-height: 1.5; margin-bottom: 24px;">Our background agent has scanned your target markets and identified the following high-match job opportunities, including potential alumni or network referral routes:</p>
          
          ${jobItems}
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; margin: 0;">
            This report was autonomously generated by Job Sentinel.<br />
            To adjust your target roles, locations, or disable daily reports, manage your settings in the Identity Hub dashboard.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendEmailViaResend(to: string, name: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: "Job Sentinel <notifications@jobsentinel.ai>",
      to,
      subject: `☀️ Job Sentinel Morning Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      html
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend API: ${response.status} - ${errText}`);
  }
}
