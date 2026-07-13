import { parseResumeText, runJobSearch, saveUserProfile } from "../src/app/actions/jobActions";
import { getProfile, getJobs } from "../src/lib/storage";

async function runSimulation() {
  console.log("=== STARTING END-TO-END FUNNEL SIMULATION ===");

  // 1. Mock Raw LinkedIn / PDF Text Ingestion
  const mockRawText = `
    Robert Madonia
    robert.madonia@example.com
    +44 7911 123456
    London, United Kingdom
    linkedin.com/in/robertmadonia

    Summary:
    Experienced Senior UX Designer and Product UI architect with 8 years of experience designing mobile fintech solutions and web dashboards.

    Experience:
    Senior UX Designer | Wise (formerly TransferWise)
    London, UK | Jan 2021 - Present
    - Led product design for the Wise borderless account dashboard, reducing user bounce rates by 22%.
    - Designed user flows and UI components for iOS and Android apps using Figma.
    - Mentored 3 junior designers and collaborated with product management.

    Product Designer | Monzo Bank
    London, UK | Jun 2018 - Dec 2020
    - Owned the end-to-end design for Monzo's premium subscription product launch.
    - Formulated interactive high-fidelity prototypes and conducted usability testing with 50+ users.

    Skills:
    Figma, User Research, Mobile UI Design, Interaction Design, Wireframing, Agile.

    Education:
    Bachelor of Arts in Interaction Design | University of the Arts London | 2015 - 2018
  `;

  console.log("\n[Step 1] Ingesting raw resume text & parsing via Gemini API...");
  let parsedProfile: any;
  try {
    parsedProfile = await parseResumeText(mockRawText);
    console.log("✅ SUCCESS: Resume text parsed into structured JSON profile:");
    console.log(JSON.stringify(parsedProfile, null, 2));
  } catch (error: any) {
    if (error.message?.includes("429") || error.message?.includes("depleted") || error.message?.includes("quota")) {
      console.warn("\n⚠️ Live Gemini API returned 429 (Prepayment Depleted). Falling back to mock structured parse data to test DB & Search pipelines...");
      parsedProfile = {
        fullName: "Robert Madonia",
        email: "robert.madonia@example.com",
        phone: "+44 7911 123456",
        location: "London, United Kingdom",
        summary: "Senior UX Designer and fintech UI architect.",
        experience: [
          { company: "Wise", role: "Senior UX Designer", startDate: "2021-01", endDate: "Present", achievements: ["Led design for Wise dashboard"] }
        ],
        education: [
          { institution: "University of the Arts London", degree: "BA in Interaction Design" }
        ],
        skills: ["Figma", "User Research", "Mobile UI Design"],
        targetTitles: ["Senior UX Designer", "Product Designer", "UX Architect"],
        targetLocations: ["London", "Remote"]
      };
    } else {
      throw error;
    }
  }

  try {
    // 2. Mock Persistence to DB/Storage
    console.log("\n[Step 2] Saving profile to the database under ID 'robert-test-slug'...");
    // We pass 'robert-test-slug' directly as targetProfileId parameter
    await saveUserProfile(parsedProfile, "robert-test-slug");
    
    // Verify write
    const fetchedProfile = await getProfile("robert-test-slug");
    if (fetchedProfile && fetchedProfile.fullName === "Robert Madonia") {
      console.log("✅ SUCCESS: Profile verified in DB/Storage.");
    } else {
      throw new Error("Failed to verify profile in DB/Storage. Mismatched data.");
    }

    // 3. Mock Running Search
    console.log("\n[Step 3] Simulating job search based on parsed target titles and locations...");
    console.log("Target Job Titles:", fetchedProfile.targetTitles);
    console.log("Target Locations:", fetchedProfile.targetLocations);
    
    // Execute search logic
    const results = await runJobSearch(
      fetchedProfile.targetTitles || ["Product Designer"],
      fetchedProfile.targetLocations || ["London"],
      25,
      mockRawText,
      undefined,
      "robert-test-slug",
      fetchedProfile.matchStrictness || 'exact',
      fetchedProfile.alternativeTitles || []
    );
    
    console.log(`✅ SUCCESS: Job Search completed. Found ${results.length} matched jobs.`);
    if (results.length > 0) {
      console.log("Sample Match:", {
        title: results[0].title,
        company: results[0].company,
        location: results[0].location,
        score: results[0].score,
        reason: results[0].reason
      });
    }

    console.log("\n=== END-TO-END FUNNEL SIMULATION COMPLETED SUCCESSFULLY ===");
  } catch (error: any) {
    console.error("\n❌ SIMULATION FAILED:", error);
  }
}

runSimulation();
