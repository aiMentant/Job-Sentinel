"use server";

import { getActiveProfileId } from "@/app/actions/profileSwitch";
import { getProfile } from "@/lib/storage";

/**
 * Direct fetch-based Gemini caller to bypass SDK bugs (like utils.typeOf)
 * and ensure stable performance in Next.js server actions.
 */
export async function generateWithAI(prompt: string, options: { retries?: number, jsonMode?: boolean } = {}) {
  const profileId = await getActiveProfileId().catch(() => "default");
  const profile = await getProfile(profileId).catch(() => null);
  
  const key = profile?.geminiApiKey || process.env.GEMINI_API_KEY || "";
  if (!key || key === "PASTE_YOUR_KEY_HERE") {
    throw new Error("Missing Gemini API Key. Please add it in settings or in your .env.local file.");
  }

  const retries = options.retries || 3;
  const model = profile?.preferredModel || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

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
        throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 100)}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        if (options.jsonMode) {
          const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
          throw new Error("AI failed to return valid JSON");
        }
        return text.trim();
      }
      throw new Error("Empty response from AI");
    } catch (error: any) {
      const isLastRetry = i === retries - 1;
      const msg = error.name === 'AbortError' ? 'Timeout' : error.message;
      console.warn(`AI Attempt ${i + 1} failed:`, msg);
      if (isLastRetry) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 2000));
    }
  }
}

export async function analyzeJobMatch(resume: string, jobDescription: string) {
  const prompt = `
    You are an expert recruitment assistant.
    RESUME: ${(resume || "").slice(0, 5000)}
    JOB: ${(jobDescription || "").slice(0, 5000)}
    TASK: Analyze match 0-100 and give a 2-sentence reason.
    RETURN JSON: {"score": number, "reason": "string"}
  `;
  
  try {
    return await generateWithAI(prompt, { jsonMode: true });
  } catch (e) {
    return { score: 0, reason: "AI Analysis temporary unavailable." };
  }
}
