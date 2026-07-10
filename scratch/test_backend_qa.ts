import { isTitleMatch, computeGhostScore } from "../src/lib/jobUtils";

function runTests() {
  console.log("\n========================================================");
  console.log("          JOB SENTINEL - BACKEND QA TESTING             ");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  const assert = (name: string, condition: boolean, message?: string) => {
    if (condition) {
      console.log(`🟢 [PASS] ${name}`);
      passed++;
    } else {
      console.error(`🔴 [FAIL] ${name} ${message ? `- ${message}` : ""}`);
      failed++;
    }
  };

  // --- 1. TITLE MATCHING EDGE CASES ---
  console.log("\n--- Testing Title Matching Engine ---");

  // A. Undefined/Null Inputs
  try {
    const res = isTitleMatch(undefined as any, null as any, undefined as any);
    assert("Undefined/Null Inputs safety", res === true); // Should safely return true when all target lists are empty
  } catch (e: any) {
    assert("Undefined/Null Inputs safety", false, `Threw exception: ${e.message}`);
  }

  // B. Empty lists (should return true to allow fallback query match-all behavior)
  assert("Empty targets & alt lists matches everything", isTitleMatch("Software Engineer", [], []) === true);
  assert("Null array parameters safety", isTitleMatch("Software Engineer", null as any, undefined as any) === true);

  // C. Target containing only stop words/spaces
  // An invalid target (like empty string or stop word only) should NOT match everything.
  // E.g. if we have targets: ["Software Engineer", ""], the empty string targetWords length will be 0.
  // It shouldn't return true for every job title because of the empty string target!
  assert("Stopword-only or empty target string does not leak match-all", isTitleMatch("Accounting Manager", [""]) === false);
  assert("Stopword-only target string does not leak match-all", isTitleMatch("Accounting Manager", ["of"]) === false);
  assert("Stopword-only target string in list along with valid target", isTitleMatch("Software Engineer", ["of", "Software Engineer"]) === true);

  // D. Special Characters Preservation (+ and #)
  assert("C++ Developer matches C++ Developer", isTitleMatch("C++ Developer", ["C++ Developer"]) === true);
  assert("C++ Developer does NOT match C Developer (exact)", isTitleMatch("C Developer", ["C++ Developer"], [], "exact") === false);
  assert("C++ Developer does NOT match C Developer (strong)", isTitleMatch("C Developer", ["C++ Developer"], [], "strong") === false);
  assert("C# Developer matches C# Developer", isTitleMatch("C# Developer", ["C# Developer"]) === true);
  assert("C# Developer does NOT match C++ Developer", isTitleMatch("C# Developer", ["C++ Developer"]) === false);
  assert("C# Developer does NOT match C Developer (exact)", isTitleMatch("C Developer", ["C# Developer"], [], "exact") === false);

  // E. Prefix matching leak prevention (java vs javascript)
  assert("Java Developer does NOT match Javascript Developer (exact)", isTitleMatch("Javascript Developer", ["Java Developer"], [], "exact") === false);
  assert("Java Developer does NOT match Javascript Developer (strong)", isTitleMatch("Javascript Developer", ["Java Developer"], [], "strong") === false);
  assert("Java Developer matches Javascript Developer (flexible) due to shared 'Developer'", isTitleMatch("Javascript Developer", ["Java Developer"], [], "flexible") === true);
  assert("Pure 'Java' target does NOT match 'Javascript Developer' (flexible)", isTitleMatch("Javascript Developer", ["Java"], [], "flexible") === false);
  assert("Javascript Developer does NOT match Java Developer (exact)", isTitleMatch("Java Developer", ["Javascript Developer"], [], "exact") === false);
  assert("Java matches Java", isTitleMatch("Java Developer", ["Java Developer"]) === true);
  assert("Javascript matches Javascript", isTitleMatch("Javascript Developer", ["Javascript Developer"]) === true);

  // --- 2. GHOST / HARVESTING HEURISTIC ENGINE ---
  console.log("\n--- Testing Ghost/Harvesting Heuristics ---");

  // A. USAJobs Age Adjustments (Deliberate Slow timelines)
  const usajobsNew = { source: "USAJobs", postedAt: new Date().toISOString() };
  const usajobsOld = { source: "USAJobs", postedAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString() }; // 95 days old
  const corporateOld = { source: "LinkedIn", postedAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString() }; // 95 days old

  const scoreUsajobsNew = computeGhostScore(usajobsNew);
  const scoreUsajobsOld = computeGhostScore(usajobsOld);
  const scoreCorpOld = computeGhostScore(corporateOld);

  assert("New USAJobs post has 0/low ghost score", scoreUsajobsNew <= 30);
  assert("Old USAJobs post gets USAJobs age penalty (+40)", scoreUsajobsOld > scoreUsajobsNew);
  assert("Old Corporate post gets higher age penalty (+55) than USAJobs", scoreCorpOld > scoreUsajobsOld);

  // B. Harvesting Keywords
  const harvestingJob = { title: "Operations", description: "Join our talent community for future openings!" };
  const standardJob = { title: "Operations", description: "Standard job description with normal details and salary range." };
  
  const scoreHarvesting = computeGhostScore(harvestingJob);
  const scoreStandard = computeGhostScore(standardJob);
  assert("Harvesting keywords increase ghost score", scoreHarvesting > scoreStandard);
  assert("Talent community keyword correctly flags the job", scoreHarvesting >= 40);

  // Summary
  console.log("\n========================================================");
  console.log("                    SUMMARY REPORT                      ");
  console.log("========================================================");
  console.log(`Passed: ${passed} | Failed: ${failed}`);
  console.log("========================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
