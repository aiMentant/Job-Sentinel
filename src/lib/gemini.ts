"use server";

import { getActiveProfileId } from "@/app/actions/profileSwitch";
import { getProfile } from "@/lib/storage";

/**
 * Direct fetch-based Gemini caller to bypass SDK bugs (like utils.typeOf)
 * and ensure stable performance in Next.js server actions.
 */
export async function generateWithAI(prompt: string, options: { retries?: number, jsonMode?: boolean, profileIdOverride?: string, timeoutMs?: number } = {}) {
  const profileId = options.profileIdOverride || await getActiveProfileId().catch(() => "default");
  const profile = await getProfile(profileId).catch(() => null);
  
  let key = profile?.geminiApiKey;
  let model = profile?.preferredModel;

  if (!key || key === "PASTE_YOUR_KEY_HERE") {
    const defaultProfile = await getProfile("default").catch(() => null);
    key = defaultProfile?.geminiApiKey;
    if (!model) {
      model = defaultProfile?.preferredModel;
    }
  }

  if (!key || key === "PASTE_YOUR_KEY_HERE") {
    key = process.env.GEMINI_API_KEY || "";
  }

  if (!model || model.includes("gemini-2.0-flash")) {
    model = "gemini-2.5-flash";
  }

  if (!key || key === "PASTE_YOUR_KEY_HERE" || !key.trim()) {
    throw new Error("Missing Gemini API Key. Please add it in Settings or your environment config.");
  }

  const retries = options.retries || 3;
  // Allow callers to specify a longer timeout for heavy prompts (e.g. full resume tailoring)
  const timeoutMs = options.timeoutMs || 15000;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: options.jsonMode ? { responseMimeType: "application/json" } : undefined
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        if (options.jsonMode) {
          const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
          throw new Error("AI returned text but no valid JSON could be parsed. The response may have been truncated.");
        }
        return text.trim();
      }
      throw new Error("Empty response from AI — the model may have refused the prompt or returned a safety block.");
    } catch (error: any) {
      const isLastRetry = i === retries - 1;
      const msg = error.name === 'AbortError' ? `Timeout after ${timeoutMs / 1000}s — prompt may be too large for this model` : error.message;
      console.warn(`AI Attempt ${i + 1} failed:`, msg);
      if (isLastRetry) throw new Error(msg);
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 2000));
    }
  }
}

export async function analyzeJobMatch(resume: string, jobDescription: string): Promise<{ score: number; reason: string; isGhost?: boolean }> {
  const prompt = `
    You are an expert recruitment assistant.
    RESUME: ${(resume || "").slice(0, 5000)}
    JOB: ${(jobDescription || "").slice(0, 5000)}
    TASK: Analyze the match between the resume and the job listing.
    Determine:
    1. A match score (0-100) based on how well the candidate's skills and experience fit the job.
    2. A brief 2-sentence explanation of the match.
    3. Whether this listing is a "ghost job" or "harvesting/talent pool post" (e.g. evergreen postings, generic talent pipelines, or extremely vague descriptions).
    
    RETURN JSON format:
    {
      "score": number,
      "reason": "string",
      "isGhost": boolean
    }
  `;
  
  try {
    const res = await generateWithAI(prompt, { jsonMode: true });
    return {
      score: typeof res?.score === 'number' ? res.score : 0,
      reason: typeof res?.reason === 'string' ? res.reason : "Pending AI analysis.",
      isGhost: typeof res?.isGhost === 'boolean' ? res.isGhost : false
    };
  } catch (e) {
    return { score: 0, reason: "AI Analysis temporary unavailable.", isGhost: false };
  }
}
