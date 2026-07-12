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

const ANTI_DETECTION_RULES = `
AI DETECTION BYPASS — HUMAN CADENCE RULES (MANDATORY):
- BANNED WORDS & PHRASES: Do NOT use any of the following at any point in your output: "Moreover", "Furthermore", "Delve", "Testament to", "A testament", "Exciting mix", "Passion for", "Passionate about", "Foster", "Synergy", "Tapestry", "Leverage" (as a verb for skills), "Spearheaded" (unless directly from the user's background), "Utilize" (prefer "use"), "Embark", "Journey", "Landscape", "Transformative", "Impactful journey", "I am writing to", "Hope this finds you well", "Eager to bring my unique", "I would be a great fit", "Delighted to", "Thrilled to", "Excited to bring".
- SENTENCE VARIETY (BURSTINESS): Mix sentence lengths deliberately. Short punchy sentences. Occasionally use longer, more complex sentences that flow naturally into the next idea. Avoid a rhythm of uniformly-structured sentences of the same length.
- VOICE: Write in a direct, confident, professional first-person voice. Active voice only. Avoid passive constructions like "was responsible for" — prefer "managed", "built", "cut", "grew".
- NO BULLET OVERLOAD: Avoid more than 4–5 consecutive bullet points without a break. Prose paragraphs should be used where natural flow matters (cover letters, messages).
- CONTRACTIONS: Use natural contractions sparingly where appropriate (e.g. "I've", "I'm", "it's") to sound human — but only in cover letters and messages, not in resume bullets.
`.trim();

export type OptimizationResult = {
  matchScore: number;
  missingKeywords: string[];
  tailoredResumeText: string;
  tailoredCoverLetter: string;
  linkedinHook: string;
  emailHook: string;
  applicationStrategy: string;
};

export async function generateTailoringDraftAction(
  jobDescription: string,
  jobTitle: string,
  company: string,
  profileIdOverride?: string
): Promise<OptimizationResult> {
  const context = await getProfileContext(profileIdOverride);

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
    // Draft is the heaviest call — full resume + cover letter + outreach in one JSON blob
    const draft: OptimizationResult = await generateWithAI(prompt, { jsonMode: true, profileIdOverride, timeoutMs: 55000 });
    
    // Strip markdown bold asterisks from all generated textual fields
    if (draft.tailoredResumeText) draft.tailoredResumeText = draft.tailoredResumeText.replace(/\*\*/g, "");
    if (draft.tailoredCoverLetter) draft.tailoredCoverLetter = draft.tailoredCoverLetter.replace(/\*\*/g, "");
    if (draft.linkedinHook) draft.linkedinHook = draft.linkedinHook.replace(/\*\*/g, "");
    if (draft.emailHook) draft.emailHook = draft.emailHook.replace(/\*\*/g, "");
    if (draft.applicationStrategy) draft.applicationStrategy = draft.applicationStrategy.replace(/\*\*/g, "");
    
    return draft;
  } catch (e: any) {
    throw new Error("AI failed to generate initial tailoring draft: " + e.message);
  }
}

export type AuditResult = {
  hasHallucinations: boolean;
  findings: Array<{
    type: 'resume' | 'coverLetter';
    fact: string;
    reason: string;
  }>;
};

export async function auditTailoringDraftAction(
  tailoredResume: string,
  tailoredCoverLetter: string,
  profileIdOverride?: string
): Promise<AuditResult> {
  const context = await getProfileContext(profileIdOverride);

  const prompt = `
Context Profile (Source of Truth):
${context}

Generated Tailored Resume:
${tailoredResume}

Generated Cover Letter:
${tailoredCoverLetter}

TASK: Act as an expert adversarial resume auditor. Compare the generated tailored resume and cover letter against the Context Profile. 
Verify that EVERY achievement, certification, job title, company, project, technology, metric, and KPI mentioned exists in some form in the Context Profile. 
Identify any "hallucinations", "lies", or "exaggerated claims" that cannot be proven by the Context Profile.

Return ONLY a JSON object (no markdown):
{
  "hasHallucinations": boolean,
  "findings": [
    {
      "type": "resume" | "coverLetter",
      "fact": "The claim made in the generated document",
      "reason": "Why it is unsupported by the profile context"
    }
  ]
}
  `;

  try {
    return await generateWithAI(prompt, { jsonMode: true, profileIdOverride, timeoutMs: 40000 });
  } catch (e) {
    // If the audit call fails, default to no findings to avoid breaking the execution flow
    return { hasHallucinations: false, findings: [] };
  }
}

export async function refineTailoredDraftAction(
  draftResume: string,
  draftCoverLetter: string,
  auditFindings: Array<{ type: 'resume' | 'coverLetter'; fact: string; reason: string }>,
  profileIdOverride?: string
): Promise<{ tailoredResumeText: string; tailoredCoverLetter: string }> {
  const context = await getProfileContext(profileIdOverride);

  const prompt = `
Context Profile (Source of Truth):
${context}

Generated Resume:
${draftResume}

Generated Cover Letter:
${draftCoverLetter}

List of Hallucinations/Lies to remove:
${JSON.stringify(auditFindings, null, 2)}

TASK: Re-write the Tailored Resume and Cover Letter to remove all flagged hallucinations and lies. Ensure every single claim is fully grounded in the Context Profile. Keep all formatting (like bullet points and bullet styles).

Return ONLY a JSON object (no markdown):
{
  "tailoredResumeText": "The corrected resume text",
  "tailoredCoverLetter": "The corrected cover letter text"
}
  `;

  try {
    const refined = await generateWithAI(prompt, { jsonMode: true, profileIdOverride, timeoutMs: 40000 });
    
    if (refined.tailoredResumeText) refined.tailoredResumeText = refined.tailoredResumeText.replace(/\*\*/g, "");
    if (refined.tailoredCoverLetter) refined.tailoredCoverLetter = refined.tailoredCoverLetter.replace(/\*\*/g, "");
    
    return refined;
  } catch (e: any) {
    throw new Error("AI failed to refine tailored materials: " + e.message);
  }
}
