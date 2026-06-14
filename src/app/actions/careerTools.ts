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
  
  TASK: Generate comprehensive, highly tailored interview preparation materials for this candidate.
  
  Please provide:
  1. Pitch: A custom, persuasive "Tell me about yourself" elevator pitch script (approx. 150-200 words) connecting their experiences to the company's mission and job requirements.
  2. Behavioral Questions: 5 behavioral questions they are likely to be asked based on the job requirements, with tailored guideline answers showing how they can use the STAR method from their experience.
  3. Technical Questions: 5 technical/role-specific questions based on the required skill set in the job description, with precise guideline answers.
  4. Reverse Questions: 5 strategic, insightful questions the candidate should ask the interviewer to display deep interest and business acumen.
  5. Salary Negotiation: Compensation advice with a realistic range and a mini-script/strategy for discussing target compensation.
  
  CRITICAL ANTI-HALLUCINATION GUARDRAILS:
  - Rely strictly on the provided Candidate Profile for their accomplishments and credentials.
  - Do NOT invent projects, metrics, certifications, or past titles that the candidate does not have.
  - Formulate answer guidelines based strictly on the candidate's actual skills.
  
  Return ONLY a JSON object (no markdown):
  {
    "pitch": "Elevator pitch script text here...",
    "behavioralQuestions": [
      { "q": "Behavioral Question 1", "a": "Guideline answer using STAR method based on their profile..." }
    ],
    "technicalQuestions": [
      { "q": "Technical/Role Question 1", "a": "Guideline answer based on their profile..." }
    ],
    "reverseQuestions": [
      "Question 1",
      "Question 2"
    ],
    "salaryNegotiation": "Comp advice, range and talking points..."
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


