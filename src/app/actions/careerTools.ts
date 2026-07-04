"use server";

import { generateWithAI } from "@/lib/gemini";
import { getActiveProfileId } from "./profileSwitch";
import { getProfile } from "@/lib/storage";

async function getProfileContext(profileIdOverride?: string) {
  const profileId = profileIdOverride || await getActiveProfileId();
  const profile = await getProfile(profileId);
  if (!profile) return "";
  const experience = (profile.experience || [])
    .map((e: any) => `${e.role} at ${e.company}: ${(e.achievements || []).join(". ")}`)
    .join("\n");
  return `
Name: ${profile.fullName}
Summary: ${profile.summary}
Skills: ${(profile.skills || []).join(", ")}
Experience:\n${experience}
Education: ${(profile.education || []).map((e: any) => `${e.degree} from ${e.institution}`).join(", ")}
Target Titles: ${(profile.targetTitles || []).join(", ")}
  `.trim();
}

// ────────────────────────────────────────────────────────
// Shared anti-detection & human cadence rules
// Injected into every output-facing AI prompt so generated
// text bypasses common LLM-detection scanners naturally.
// ────────────────────────────────────────────────────────
const ANTI_DETECTION_RULES = `
AI DETECTION BYPASS — HUMAN CADENCE RULES (MANDATORY):
- BANNED WORDS & PHRASES: Do NOT use any of the following at any point in your output: "Moreover", "Furthermore", "Delve", "Testament to", "A testament", "Exciting mix", "Passion for", "Passionate about", "Foster", "Synergy", "Tapestry", "Leverage" (as a verb for skills), "Spearheaded" (unless directly from the user's background), "Utilize" (prefer "use"), "Embark", "Journey", "Landscape", "Transformative", "Impactful journey", "I am writing to", "Hope this finds you well", "Eager to bring my unique", "I would be a great fit", "Delighted to", "Thrilled to", "Excited to bring".
- SENTENCE VARIETY (BURSTINESS): Mix sentence lengths deliberately. Short punchy sentences. Occasionally use longer, more complex sentences that flow naturally into the next idea. Avoid a rhythm of uniformly-structured sentences of the same length.
- VOICE: Write in a direct, confident, professional first-person voice. Active voice only. Avoid passive constructions like "was responsible for" — prefer "managed", "built", "cut", "grew".
- NO BULLET OVERLOAD: Avoid more than 4–5 consecutive bullet points without a break. Prose paragraphs should be used where natural flow matters (cover letters, messages).
- CONTRACTIONS: Use natural contractions sparingly where appropriate (e.g. "I've", "I'm", "it's") to sound human — but only in cover letters and messages, not in resume bullets.
`.trim();

// ────────────────────────────────────────────────────────
// 0. AI Salary Estimator
// Estimates a realistic salary range when no salary is listed.
// Returns { estimate: "$XX,XXX – $XX,XXX", basis: "..." }
// ────────────────────────────────────────────────────────
export async function estimateAISalary(
  jobTitle: string,
  company: string,
  location: string,
  descriptionSnippet?: string
): Promise<{ estimate: string; basis: string } | null> {
  try {
    const locationHint = location || "United States";
    const descHint = descriptionSnippet
      ? `\nJob description excerpt: ${descriptionSnippet.slice(0, 400)}`
      : "";

    const prompt = `You are a compensation research specialist. Estimate a realistic market-rate annual salary range for the following job posting. Base your estimate on publicly available data sources such as BLS Occupational Employment Statistics, Glassdoor, LinkedIn Salary Insights, and Indeed for this specific role, seniority level inferred from the title, and geographic location.

Job Title: ${jobTitle}
Company: ${company}
Location: ${locationHint}${descHint}

Respond ONLY with a JSON object in this exact format (no markdown, no explanation outside the JSON):
{
  "estimate": "$XX,XXX – $XX,XXX",
  "basis": "Brief 1-sentence note on the data source or reasoning, max 12 words"
}

Rules:
- Use USD for US locations. Use the currency appropriate for the country if non-US.
- The range should be realistic — not aspirational, not lowball.
- If it is a senior role, reflect that in the range.
- basis must be concise, factual, and reference a source type (e.g., "BLS data for FL logistics operations roles" or "Glassdoor data for warehouse supervisors in Central FL").
- If you cannot make a reliable estimate (e.g., very niche role with no data), return null for both fields.`;

    const raw = await generateWithAI(prompt, { jsonMode: true });
    if (!raw) return null;

    let parsed: any;
    if (typeof raw === "string") {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } else {
      parsed = raw;
    }

    if (!parsed?.estimate || parsed.estimate === "null") return null;
    return { estimate: parsed.estimate, basis: parsed.basis || "" };
  } catch (err) {
    console.error("[estimateAISalary] error:", err);
    return null;
  }
}

// ────────────────────────────────────────────────────────
// 1. Resume Conversion Fixer
// Rewrites resume for maximum interview callbacks.
// ────────────────────────────────────────────────────────
export async function rewriteResume(resumeText?: string): Promise<string> {
  const context = resumeText || (await (async () => {
    const profileId = await getActiveProfileId();
    const profile = await getProfile(profileId);
    return profile?.resumeText || "";
  })());

  if (!context) return "No resume text found. Please paste your resume or save it to your profile first.";

  const prompt = `Here is my resume:\n\n${context}\n\nRewrite it to maximize interview callbacks. Use strong action verbs, quantified results, and ATS-friendly formatting. CRITICAL ANTI-HALLUCINATION GUARDRAILS: Rely ONLY on the provided resume content. Do NOT invent, fabricate, or exaggerate achievements, credentials, job roles, projects, technologies, KPIs, metrics, or experiences. Only optimize the phrasing, clarity, and layout of the existing content. Keep it 100% faithful to the source facts. Return the rewritten resume as plain text, preserving section headers.`;
  
  const result: any = await generateWithAI(prompt);
  return result;
}

// ────────────────────────────────────────────────────────
// 2. Job Description Matcher
// Identifies missing keywords and rewrites resume excerpt to match JD.
// ────────────────────────────────────────────────────────
export async function matchToJobDescription(jobDescription: string, resumeText?: string): Promise<{ missingKeywords: string[]; rewrittenSummary: string; matchScore: number }> {
  const resume = resumeText || (await (async () => {
    const profileId = await getActiveProfileId();
    const profile = await getProfile(profileId);
    return profile?.resumeText || await getProfileContext();
  })());

  const prompt = `
Job Description:
${jobDescription}

My Resume/Profile:
${resume}

Analyze the match between this job and my profile. 
Focus on:
1. ATS Keyword Gap: What specific technical or industry terms am I missing?
2. Score: A realistic score (0-100) based on how well my skills/years match the core requirements. 
3. Brief Match Summary: 1 sentence on why/why not this is a fit.

CRITICAL ANTI-HALLUCINATION GUARDRAILS:
- Rely ONLY on the provided Resume/Profile. 
- Do NOT assume, extrapolate, or invent any skills, metrics, KPIs, tools, or experiences not explicitly mentioned.
- Keep all analysis and summaries 100% faithful to the source facts.

Respond with ONLY a JSON object (no markdown):
{
  "missingKeywords": ["keyword1", "keyword2"],
  "matchScore": 78,
  "rewrittenSummary": "The 1-sentence match summary."
}
  `;

  try {
    return await generateWithAI(prompt, { jsonMode: true });
  } catch (e) {
    return { missingKeywords: [], rewrittenSummary: "Analysis unavailable.", matchScore: 0 };
  }
}

// ────────────────────────────────────────────────────────
// 3. Role Fit Finder
// Lists 10 roles ranked by demand and response likelihood.
// ────────────────────────────────────────────────────────
export async function findRoleFit(): Promise<Array<{ title: string; demandScore: number; reasoning: string }>> {
  const context = await getProfileContext();
  if (!context) return [];

  const prompt = `
Based on this professional's experience and skills:

${context}

List 10 roles they are qualified for that they might be overlooking. These should be real, in-demand job titles.
Rank them by hiring demand and response likelihood. 

CRITICAL ANTI-HALLUCINATION GUARDRAILS:
- Rely ONLY on the provided experience and skills as the absolute source of truth.
- Do NOT invent, fabricate, or embellish candidate history, accomplishments, credentials, or technologies in the reasoning.
- Do NOT assume skills or seniorities not explicitly present.

Return ONLY a JSON array (no markdown):
[
  { "title": "Role Title", "demandScore": 85, "reasoning": "One sentence why this is a strong match." }
]
  `;

  try {
    return await generateWithAI(prompt, { jsonMode: true });
  } catch (e) {
    return [];
  }
}

// ────────────────────────────────────────────────────────
// 4. Bullet Point Upgrader
// Rewrites resume bullets to be cleaner and more results-focused.
// ────────────────────────────────────────────────────────
export async function upgradeBullets(bullets: string[]): Promise<string[]> {
  const prompt = `
Rewrite these resume bullet points. Make them clearer, more results-focused, and more impressive to recruiters. Each bullet must be under 2 lines. 

CRITICAL ANTI-HALLUCINATION GUARDRAILS:
- Rely ONLY on the original bullet points provided.
- Do NOT invent, fabricate, or extrapolate any numbers, metrics, KPIs, tools, or responsibilities. If the original bullet has no metric, do NOT invent one.
- Keep the content 100% faithful to the factual truth.

Original bullets:
${bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}

Return ONLY a JSON array of the rewritten bullets (no markdown, no numbering):
["Rewritten bullet 1", "Rewritten bullet 2"]
  `;

  try {
    return await generateWithAI(prompt, { jsonMode: true });
  } catch (e) {
    return bullets;
  }
}

// ────────────────────────────────────────────────────────
// 5. Cover Letter Personalizer (upgraded with JD context)
// More specific and human-sounding than a generic cover letter.
// ────────────────────────────────────────────────────────
export async function personalizeCoverLetter(jobDescription: string, jobTitle: string, company: string): Promise<string> {
  const context = await getProfileContext();

  const prompt = `
My Background:
${context}

Job Description:
${jobDescription}

Write a short, tailored cover letter for the role of "${jobTitle}" at "${company}". 
Rules: Sound human and confident, not generic or AI-written. Be specific to the actual job requirements. 

CRITICAL ANTI-HALLUCINATION GUARDRAILS:
- Rely ONLY on the provided Background as the absolute source of truth.
- Do NOT invent or exaggerate achievements, tools, dates, projects, KPIs, metrics, or years of experience.
- Do NOT lie or extrapolate experiences beyond what is explicitly provided.
- If no direct match exists for a key requirement, focus on adjacent transferable skills mentioned in the background rather than inventing it.
- Keep it under 280 words.
- Do not use phrases like "I am writing to express my interest." Start with a strong hook.

${ANTI_DETECTION_RULES}
  `;

  const result: any = await generateWithAI(prompt);
  return result;
}

// ────────────────────────────────────────────────────────
// 6. Recruiter Hook Message
// Concise LinkedIn/email message designed to get a reply.
// ────────────────────────────────────────────────────────
export async function generateRecruiterMessage(jobTitle: string, company: string, jobDescription?: string): Promise<{ linkedin: string; email: string }> {
  const context = await getProfileContext();

  const prompt = `
My Background:
${context}

Target Role: ${jobTitle} at ${company}
${jobDescription ? `\nJob Description:\n${jobDescription}` : ""}

Write two outreach messages to a recruiter for this role — one for LinkedIn and one for email.
Goal: Spark genuine interest and get a reply. Be concise, confident, and specific. 

CRITICAL ANTI-HALLUCINATION GUARDRAILS:
- Rely ONLY on the provided Background as the absolute source of truth.
- Do NOT fabricate, embellish, or exaggerate achievements, tools, dates, projects, KPIs, metrics, or experiences.
- Do not make up any career details.
- Avoid begging, generic phrases, or "I hope this message finds you well." 
- LinkedIn message must be under 100 words. Email must be under 150 words with a subject line.

${ANTI_DETECTION_RULES}

Return ONLY a JSON object (no markdown):
{
  "linkedin": "The LinkedIn message text",
  "email": "Subject: ...\n\nThe email body text"
}
  `;

  try {
    return await generateWithAI(prompt, { jsonMode: true });
  } catch (e) {
    return { linkedin: "Failed to generate LinkedIn message.", email: "" };
  }
}

// ────────────────────────────────────────────────────────
// 7. Application Optimizer
// Builds a smart, personalized weekly application strategy.
// ────────────────────────────────────────────────────────
export async function generateApplicationStrategy(): Promise<string> {
  const context = await getProfileContext();
  if (!context) return "Please save your profile first.";

  const prompt = `
Based on this professional's background and target roles:

${context}

Create a smart, actionable job application strategy. Include:
1. How many roles to apply for per week (be specific and realistic)
2. How to prioritize and tier roles (e.g., "reach" vs "likely")
3. How to efficiently customize applications without starting from scratch each time
4. A follow-up cadence (when and how to follow up after applying)
5. Two or three specific platform recommendations for this person's background
6. Any red flags or gaps to address before applying

Be direct, tactical, and specific to this person's background. Avoid generic advice. 
Format with clear numbered sections. Keep it under 500 words.
  `;

  const result: any = await generateWithAI(prompt);
  return result;
}
// ────────────────────────────────────────────────────────
// 8. Application Package Optimizer (Unified)
// Generates match analysis, tailored resume content, and cover letter in one pass.
// ────────────────────────────────────────────────────────
export async function optimizeApplicationPackage(jobDescription: string, jobTitle: string, company: string): Promise<{ 
  matchScore: number; 
  missingKeywords: string[]; 
  tailoredResumeText: string; 
  tailoredCoverLetter: string;
  linkedinHook: string;
  emailHook: string;
  applicationStrategy: string;
}> {
  const context = await getProfileContext();

  const prompt = `
Job Context: ${jobTitle} at ${company}
Job Description:
${jobDescription}

My Background:
${context}

TASK: Generate a unified application optimization package. This must be a "Staff-Level" makeover.

CRITICAL ANTI-HALLUCINATION GUARDRAILS:
- Rely ONLY on the provided Background as the absolute source of truth.
- Do NOT invent, fabricate, or exaggerate achievements, credentials, job roles, projects, technologies, KPIs, metrics, or years of experience.
- Do NOT lie or extrapolate experiences beyond what is explicitly provided.
- If a skill is missing, focus on adjacent transferable skills found in the background rather than inventing it.
- Do NOT invent any numbers or metrics if they do not exist in the background.

CRITICAL FORMATTING & HUMAN CADENCE GUARDRAILS:
- NO BRACKETED PLACEHOLDERS: Do NOT output any bracketed placeholder text like "[hiring manager]", "[Hiring Manager Name]", "[Company Name]", "[Phone Number]", "[Email Address]", "[LinkedIn Profile URL]", "[Recruiter Name]", etc. If a piece of information is missing, do NOT put brackets around it; instead, substitute it cleanly or omit the line entirely. For phone, email, and LinkedIn, if you don't have them, do not output placeholder text lines.
- BULLET STYLE: Use the standard bullet character "•" instead of markdown asterisks ("*") for all bulleted lists in the resume and cover letter.
- HUMAN CADENCE / MULTI-LLM SYNERGY: Rewrite with a natural human conversational cadence. Vary sentence lengths (mix short, medium, and long sentences). Do not use formulaic AI transition phrases (e.g., "hope this message finds you well", "as a testament to", "passion for", "excited to bring my unique mix"). Make it read like a polished human professional who is technically expert and direct.

${ANTI_DETECTION_RULES}

1. Match Score (0-100).
2. Missing Keywords: Identify critical terms from the JD missing from my profile.
3. Tailored Resume: Rewrite my entire resume to match this role. 
   - Use strong action verbs and quantified results from my REAL experience.
   - Upgrade every bullet point to be clear, results-focused, and under 2 lines.
   - Stay 100% honest — no exaggeration.
4. Cover Letter: Write a short, tailored, human-sounding letter. 
   - Use a strong hook (no "I am writing to..."). 
   - Reference specific achievements.
5. Outreach Hooks: 
   - One concise LinkedIn message (under 100 words).
   - One professional email (under 150 words with subject line).
6. Killer Strategy: A 2-sentence tactical plan for this specific application.

Return ONLY a JSON object (no markdown):
{
  "matchScore": number,
  "missingKeywords": ["string"],
  "tailoredResumeText": "The full rewritten resume text",
  "tailoredCoverLetter": "The human-sounding cover letter",
  "linkedinHook": "Concise LinkedIn message",
  "emailHook": "Subject: ...\\n\\nEmail body",
  "applicationStrategy": "The tactical plan"
}
  `;

  try {
    return await generateWithAI(prompt, { jsonMode: true });
  } catch (e) {
    throw new Error("AI failed to generate a valid application package.");
  }
}

export async function refineTailoredMaterial(
  type: 'resume' | 'coverLetter' | 'outreach',
  currentText: string,
  instruction: string,
  jobTitle: string,
  company: string
): Promise<string> {
  const context = await getProfileContext();
  const prompt = `
Job Context: ${jobTitle} at ${company}
Current tailored ${type} text:
"""
${currentText}
"""

User instruction for refinement:
"${instruction}"

TASK: Refine the current tailored ${type} text based on the user's instructions.

CRITICAL INSTRUCTIONS:
1. Maintain strict factual honesty based on the user's background:
"""
${context}
"""
Do NOT invent or exaggerate credentials, metrics, or experiences.
2. Remove any bracketed placeholder text like "[hiring manager]", "[phone number]", etc. If missing, leave a clean space or omit the line entirely.
3. Use the standard bullet character "•" instead of markdown asterisks ("*") for lists.
4. Human Cadence & Multi-LLM Synergy: Emulate a natural human tone (varied sentence lengths, active voice, conversational yet professional, avoiding buzzwords like "hope this message finds you well", "testament to", "delighted to").
5. Return ONLY the final refined text. Do NOT include any preamble, conversational replies, or markdown blocks (like \`\`\`).

${ANTI_DETECTION_RULES}
`;

  try {
    const result: any = await generateWithAI(prompt);
    return result;
  } catch (e) {
    throw new Error("AI failed to refine the draft.");
  }
}
// ────────────────────────────────────────────────────────
// 9. Dream Company Researcher
// Researches and lists top-tier companies within a radius for the user's background.
// ────────────────────────────────────────────────────────
export async function generateDreamCompanies(locations: string[], radius: number, roles?: string[], profileIdOverride?: string): Promise<Array<{ name: string; industry: string; reasoning: string; careerUrl?: string }>> {
  const context = await getProfileContext(profileIdOverride);
  if (!context) return [];

  const rolesQuery = roles && roles.length > 0 ? roles : [];

  const prompt = `
  Context:
  ${context}
  
  Active Target Roles to prioritize: ${rolesQuery.join(", ")}
  Target Locations: ${locations.join(", ")}
  Search Radius: ${radius} miles
  
  TASK: Research and identify 15-20 "Dream Companies" within these locations (or globally if they hire remote for these roles) that are a high-value match for this person's career and actively hire for the target roles: ${rolesQuery.join(", ")}.
  Include:
  - Big Tech / Enterprises (if applicable)
  - High-growth startups
  - Industry leaders specific to their background
  
  Return ONLY a JSON array (no markdown):
  [
    { 
      "name": "Company Name", 
      "industry": "Industry Type", 
      "reasoning": "One sentence why this is a strategic target for this professional.",
      "careerUrl": "Best guess at their greenhouse/lever board or career page domain"
    }
  ]
  
  CRITICAL GUARDRAIL: For the 'careerUrl' field, return a URL only if you are highly confident it matches a standard, public career page or main company domain; otherwise, return null. Do not invent fictional URL paths.
  `;

  try {
    return await generateWithAI(prompt, { jsonMode: true });
  } catch (e) {
    return [];
  }
}

// ────────────────────────────────────────────────────────
// 10. Niche Job Board Finder
// Suggests 8-12 niche job boards based on user profile and skills.
// ────────────────────────────────────────────────────────
export async function generateNicheJobBoards(profileIdOverride?: string): Promise<Array<{ name: string; industry: string; reasoning: string; searchUrl: string }>> {
  const context = await getProfileContext(profileIdOverride);
  if (!context) return [];

  const prompt = `
  Context:
  ${context}
  
  TASK: Identify 8-12 high-value, highly specific niche job boards or career platforms (e.g. BuiltIn, WeWorkRemotely, Dice, Dribbble, RemoteOK, Crunchboard, Behance, AngelList/Wellfound) that align perfectly with this professional's industry, tech stack, and target roles.
  
  Do NOT suggest generic search aggregators like LinkedIn, Indeed, Glassdoor, or ZipRecruiter. Focus strictly on niche portals.
  
  For each board, determine a viable search query URL format. Use "{query}" as a placeholder where the search keyword/role should go.
  If the platform does not support query routing via URLs or is best browsed manually, provide the main career or dashboard URL.
  
  Return ONLY a JSON array (no markdown):
  [
    { 
      "name": "Platform Name", 
      "industry": "Focus Area (e.g., Tech Startup, Creative, Remote-first)", 
      "reasoning": "Briefly state why this board is a high-yield channel for their specific stack.",
      "searchUrl": "https://example.com/jobs?q={query} or main domain URL"
    }
  ]
  `;

  try {
    return await generateWithAI(prompt, { jsonMode: true });
  } catch (e) {
    return [];
  }
}

// ────────────────────────────────────────────────────────
// 11. Interview Prep Support Generator
// Generates pitches, predictive behavioral + technical Q&As,
// reverse questions, and salary negotiation strategies.
// ────────────────────────────────────────────────────────
export async function generateInterviewPrepMaterial(
  jobDescription: string,
  jobTitle: string,
  companyName: string,
  profileIdOverride?: string
): Promise<{
  pitch: string;
  behavioralQuestions: Array<{ q: string; a: string }>;
  technicalQuestions: Array<{ q: string; a: string }>;
  reverseQuestions: string[];
  salaryNegotiation: string;
}> {
  const context = await getProfileContext(profileIdOverride);
  
  const prompt = `
  Job Description:
  ${jobDescription}
  
  Job Title: ${jobTitle}
  Company: ${companyName}
  
  Candidate Profile:
  ${context}
  
  TASK: Generate scannable, highly tailored interview preparation materials for this candidate. Do NOT write long paragraphs. Write short, high-contrast, structured snapshot reference points.
  
  Please provide:
  1. Pitch: A custom, persuasive "Tell me about yourself" script structured strictly as 3 bullet points starting with bold markdown labels:
     • **Hook**: [1 sentence hook about their superpower & current role]
     • **Value Add**: [1-2 sentences summarizing their biggest relevant metric/achievement]
     • **Alignment**: [1 sentence explaining why this specific company/role is the perfect pivot]
  
  2. Behavioral Questions: 5 behavioral questions they are likely to be asked based on the job requirements. Each guideline answer ("a") MUST be structured strictly in a segmented STAR format:
     **Situation/Task**: [1 sentence challenge context]
     **Actions**:
     • [Action 1: key initial step you took]
     • [Action 2: how you solved it / technical detail]
     • [Action 3: impact-oriented action/leadership]
     **Result**:
     • [1 concrete outcome or metric]
  
  3. Technical Questions: 5 technical/role-specific questions based on the required skill set. Each guideline answer ("a") MUST be structured strictly as:
     **Core Concept**: [1 sentence definition/concept]
     **Key Talk Track**:
     • [Talking point to mention / drop during the answer]
     • [Technical architecture or best practice details]
     • [An optimization or trade-off consideration]
  
  4. Reverse Questions: 5 strategic, insightful questions the candidate should ask the interviewer to display deep interest and business acumen.
  
  5. Salary Negotiation: Compensation advice structured strictly as:
     **Market Benchmark**: [Realistic local market range, e.g. £110k - £130k]
     **Talking Points**:
     • [Deflection script: how to redirect if asked for expectations first]
     • [Target script: how to strategically state expectations]
     • [Leverage point: key value or experience to anchor the number]
  
  CRITICAL ANTI-HALLUCINATION GUARDRAILS:
  - Rely strictly on the provided Candidate Profile for their accomplishments and credentials.
  - Do NOT invent projects, metrics, certifications, or past titles that the candidate does not have.
  - Formulate answer guidelines based strictly on the candidate's actual skills.
  
  Return ONLY a JSON object (no markdown):
  {
    "pitch": "• **Hook**: ...\n• **Value Add**: ...\n• **Alignment**: ...",
    "behavioralQuestions": [
      { "q": "Behavioral Question 1", "a": "**Situation/Task**:\n...\n\n**Actions**:\n• ...\n• ...\n• ...\n\n**Result**:\n• ..." }
    ],
    "technicalQuestions": [
      { "q": "Technical/Role Question 1", "a": "**Core Concept**:\n...\n\n**Key Talk Track**:\n• ...\n• ...\n• ..." }
    ],
    "reverseQuestions": [
      "Question 1",
      "Question 2"
    ],
    "salaryNegotiation": "**Market Benchmark**:\n...\n\n**Talking Points**:\n• ...\n• ...\n• ..."
  }
  `;

  const fallback = {
    pitch: "Elevator pitch script generating failed.",
    behavioralQuestions: [{ q: "Tell me about a time you solved a complex problem.", a: "Prepare a STAR method answer based on your achievements." }],
    technicalQuestions: [{ q: "What technical skills qualify you for this role?", a: "Discuss the core requirements mentioned in the job post." }],
    reverseQuestions: ["What does success look like in the first 90 days?", "How does this role contribute to the company's immediate goals?"],
    salaryNegotiation: "Prepare compensation requirements based on local market averages."
  };

  try {
    const result = await generateWithAI(prompt, { jsonMode: true });
    return {
      pitch: result.pitch || fallback.pitch,
      behavioralQuestions: result.behavioralQuestions || fallback.behavioralQuestions,
      technicalQuestions: result.technicalQuestions || fallback.technicalQuestions,
      reverseQuestions: result.reverseQuestions || fallback.reverseQuestions,
      salaryNegotiation: result.salaryNegotiation || fallback.salaryNegotiation
    };
  } catch (e) {
    console.error("Gemini failed to generate interview prep:", e);
    return fallback;
  }
}

// ────────────────────────────────────────────────────────
// 12. Resume Structurer
// Clean up a raw parser-extracted ATS resume text into clean, structured paragraphs and bullet points.
// ────────────────────────────────────────────────────────
export async function structureRawResume(resumeText: string): Promise<string> {
  if (!resumeText || !resumeText.trim()) return "";

  const prompt = `
You are an expert ATS layout optimizer.
Your task is to take this raw, messy, parser-extracted ATS resume text and clean up its structure.

INPUT RAW TEXT:
"""
${resumeText}
"""

INSTRUCTIONS:
1. Reconstruct clean paragraphs, logical section headers (e.g. PROFESSIONAL EXPERIENCE, EDUCATION, SKILLS), and bullet breaks.
2. Standardize all list items/bullets to use the standard bullet character "•" instead of asterisks ("*"), hyphens ("-"), or odd symbols.
3. CRITICAL: Do NOT alter, omit, summarize, edit, add, or exaggerate any factual information, accomplishments, tools, dates, names, or metrics. Keep all original wording/content exactly as is, only fixing the spacing, broken layout lines, headers, and bullet formatting.
4. Return ONLY the formatted structured text. Do NOT include any intro, outro, markdown code blocks (like \`\`\`), or commentary.
`;

  try {
    const result: any = await generateWithAI(prompt);
    return result || resumeText;
  } catch (e) {
    console.error("Failed to structure raw resume:", e);
    return resumeText;
  }
}

// ────────────────────────────────────────────────────────
// 13. Application Question Answerer
// Generate a concise, professional answer to a job application question based on the user's resume.
// ────────────────────────────────────────────────────────
export async function generateQuestionAnswer(
  question: string,
  wordLimit: number,
  jobTitle: string,
  company: string,
  jobDescription: string
): Promise<string> {
  const context = await getProfileContext();
  const prompt = `
Job Context: ${jobTitle} at ${company}
Job Description:
${jobDescription}

My Background:
${context}

Application Question:
"${question}"

TASK: Write a professional, concise answer to this application question. 
Word Limit: Approximately ${wordLimit} words.

CRITICAL INSTRUCTIONS:
1. Rely ONLY on the provided Background as the absolute source of truth. Do NOT invent, fabricate, or exaggerate achievements, credentials, job roles, projects, technologies, KPIs, metrics, or years of experience.
2. Style: Write with a natural human conversational cadence (varied sentence lengths, active voice, technically direct, avoiding clichés like "delighted to", "testament to", "excited to bring my unique mix") rather than generic AI phrasing.
3. Word count: Respect the limit of ${wordLimit} words.
4. Return ONLY the final answer text. Do NOT include any intro, outro, markdown block ticks, or comments.
`;

  try {
    const result: any = await generateWithAI(prompt);
    return result;
  } catch (e) {
    throw new Error("AI failed to generate answer.");
  }
}

// ────────────────────────────────────────────────────────
// 14. Recruiter Screen Cheat Sheet Generator
// ────────────────────────────────────────────────────────
export async function generateRecruiterCheatSheet(
  jobTitle: string,
  company: string,
  jobDescription: string
): Promise<{
  introduction: string;
  qaPairs: Array<{ question: string; answer: string }>;
  questionsToAsk: string[];
}> {
  const context = await getProfileContext();
  const prompt = `
Job Context: ${jobTitle} at ${company}
Job Description:
${jobDescription}

My Background:
${context}

TASK: Generate a highly structured Recruiter Interview Screen Cheat Sheet.
Return the output ONLY as a JSON object (no markdown formatting, no code block backticks):
{
  "introduction": "A short, professional introduction/elevator pitch (approx 100 words) tailored to this company and job context that the user can use to introduce themselves at the start of the call.",
  "qaPairs": [
    {
      "question": "Most commonly asked interview question for this role based on the JD (e.g. Tell me about your experience with X, why do you want this role)",
      "answer": "A crisp, metrics-driven answer (under 120 words) matching the candidate's actual background without exaggerating or fabricating achievements."
    },
    {
      "question": "Standard screening question 2",
      "answer": "Answer 2 matching the candidate's background."
    },
    {
      "question": "Standard screening question 3",
      "answer": "Answer 3 matching the candidate's background."
    }
  ],
  "questionsToAsk": [
    "Smart question 1 to ask the recruiter (e.g. about the team structure, success metrics, or design systems if relevant)",
    "Smart question 2 to ask",
    "Smart question 3 to ask"
  ]
}

CRITICAL ANTI-HALLUCINATION GUARDRAIL:
- Rely ONLY on the provided Background as the absolute source of truth. Do NOT invent, fabricate, or exaggerate any metrics, tools, certifications, projects, or credentials.
`;

  try {
    return await generateWithAI(prompt, { jsonMode: true });
  } catch (e) {
    return {
      introduction: "Elevator pitch draft.",
      qaPairs: [
        { question: "Tell me about your experience.", answer: "Experience summary." }
      ],
      questionsToAsk: ["What does success look like in the first 90 days?"]
    };
  }
}

export async function askRecruiterCheatSheet(
  currentData: any,
  query: string,
  jobTitle: string,
  company: string,
  jobDescription: string
): Promise<string> {
  const context = await getProfileContext();
  const prompt = `
Job: ${jobTitle} at ${company}
Job Description:
${jobDescription}

My Background:
${context}

Current Cheat Sheet Details:
${JSON.stringify(currentData, null, 2)}

User Question/Prompt:
"${query}"

TASK: Provide a helpful, direct, and factual answer to the user's question or prompt in the context of this job and candidate profile.
If they are asking for granular company details (like company size, tools, or design systems), use your background knowledge of ${company} to answer accurately. If uncertain, provide a reasonable industry estimate based on the company's profile.
Return ONLY the markdown formatted response text. Do NOT include any JSON, intro, or outro text.
`;

  try {
    const result: any = await generateWithAI(prompt);
    return result;
  } catch (e) {
    return "Failed to query the AI assistant. Please check your connection.";
  }
}

export async function refineCheatSheetQuestion(
  question: string,
  currentAnswer: string,
  instruction: string,
  jobTitle: string,
  company: string
): Promise<string> {
  const context = await getProfileContext();
  const prompt = `
Job Context: ${jobTitle} at ${company}
Interview Question: ${question}
Current AI-crafted response:
"""
${currentAnswer}
"""

User instruction to refine/tweak the answer:
"${instruction}"

TASK: Rewrite or refine the answer to the interview question based on the user's instructions.

CRITICAL INSTRUCTIONS:
1. Maintain strict factual honesty based on the user's background:
"""
${context}
"""
Do NOT invent or exaggerate credentials, metrics, or experiences.
2. Rely ONLY on the provided Background as the absolute source of truth.
3. Keep the response crisp and concise (under 120 words), direct, and written in a natural human tone.
4. Return ONLY the final refined text. Do NOT include any preamble, conversational replies, or markdown blocks (like \`\`\`).
`;

  try {
    const result: any = await generateWithAI(prompt);
    return result.trim();
  } catch (e) {
    throw new Error("AI failed to refine the answer.");
  }
}

export async function refineInterviewPrepSection(
  contextType: 'pitch' | 'behavioral' | 'technical' | 'reverse' | 'salary',
  currentText: string,
  instruction: string,
  jobTitle: string,
  company: string,
  extraContext?: string
): Promise<string> {
  const context = await getProfileContext();
  const prompt = `
Job Context: ${jobTitle} at ${company}
Section: ${contextType}
${extraContext ? `Question/Topic Context: ${extraContext}` : ""}

Current AI-crafted text:
"""
${currentText}
"""

User instruction to refine/tweak:
"${instruction}"

TASK: Refine the text according to the user's instructions.

CRITICAL INSTRUCTIONS:
1. Maintain strict factual honesty based on the user's background:
"""
${context}
"""
Do NOT invent or exaggerate credentials, metrics, or experiences.
2. Rely ONLY on the provided Background as the absolute source of truth.
3. Keep the response natural, highly professional, clean of placeholders, and written in a crisp human tone.
4. Return ONLY the final refined text. Do NOT include any preamble, conversational replies, or markdown blocks (like \`\`\`).
`;

  try {
    const result: any = await generateWithAI(prompt);
    return result.trim();
  } catch (e) {
    throw new Error("AI failed to refine the text.");
  }
}







