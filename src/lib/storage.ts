import path from 'path';
import { supabase } from './supabaseClient';

const safeCwd = typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '';
const BASE_DATA_PATH = path.join(safeCwd, 'data/profiles');

// Keep in-memory singletons across Next.js Hot Module Replacement (HMR)
// NOTE: Enabled in ALL environments — previously only non-production, which
// meant production serverless had no working fallback when filesystem writes fail.
const globalForStorage = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as {
  memoryProfiles?: Map<string, any>;
  memoryJobs?: Map<string, any[]>;
  memoryJobDetails?: Map<string, any>;
};

const memoryProfiles = globalForStorage.memoryProfiles || new Map<string, any>();
const memoryJobs = globalForStorage.memoryJobs || new Map<string, any[]>();
const memoryJobDetails = globalForStorage.memoryJobDetails || new Map<string, any>();

// Always persist singletons on globalThis so they survive HMR in dev
// and within-invocation re-imports in production serverless.
globalForStorage.memoryProfiles = memoryProfiles;
globalForStorage.memoryJobs = memoryJobs;
globalForStorage.memoryJobDetails = memoryJobDetails;

// Helper to determine if we should use Supabase or local files
export function isSupabaseEnabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  // Also check that the supabase client was actually initialized (not null)
  return !!(url && key && url !== "" && key !== "" && supabase !== null && supabase !== undefined);
}

async function ensureDir(dir: string) {
  try {
    await (await import("fs/promises")).mkdir(dir, { recursive: true });
  } catch (e) {
    // Ignore folder creation errors (e.g. read-only filesystem)
  }
}

export async function listProfiles() {
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = await supabase!.from('profiles').select('id');
      if (error) throw error;
      const dbIds = (data || []).map((p: any) => p.id);
      return Array.from(new Set(['default', ...dbIds]));
    } catch (supabaseError: any) {
      console.warn("Supabase listProfiles failed, falling back to local files:", supabaseError.message || supabaseError);
    }
  }

  // Fallback to local files
  try {
    await ensureDir(BASE_DATA_PATH);
    const dirs = await (await import("fs/promises")).readdir(BASE_DATA_PATH);
    const filtered = dirs.filter(d => !d.startsWith('.'));
    const combined = Array.from(new Set([...filtered, ...memoryProfiles.keys()]));
    return combined.length > 0 ? combined : ['default'];
  } catch (fsError) {
    console.warn("Local filesystem read failed, returning combined memory list:", fsError);
    const combined = Array.from(new Set(['default', ...memoryProfiles.keys()]));
    return combined;
  }
}

export async function getProfile(profileId: string = 'default') {
  const safeId = (typeof profileId === 'string' && profileId.trim()) ? profileId.trim() : 'default';
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = await supabase!
        .from('profiles')
        .select('data')
        .eq('id', safeId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) return data.data;
    } catch (supabaseError: any) {
      console.warn("Supabase getProfile failed, falling back to local files:", supabaseError.message || supabaseError);
    }
  }

  // Fallback to local files
  const profilePath = path.join(BASE_DATA_PATH, safeId, 'profile.json');
  try {
    const data = await (await import("fs/promises")).readFile(profilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (memoryProfiles.has(safeId)) {
      return memoryProfiles.get(safeId);
    }
    if (safeId === 'default') {
      return { fullName: "Lea Wenban", targetTitles: [], targetLocations: [], skills: [], experience: [], education: [] };
    }
    const formattedName = safeId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { fullName: formattedName, targetTitles: [], targetLocations: [], skills: [], experience: [], education: [] };
  }
}

export async function saveProfile(profile: any, profileId: string = 'default') {
  const safeId = (typeof profileId === 'string' && profileId.trim()) ? profileId.trim() : 'default';
  if (isSupabaseEnabled()) {
    try {
      const { error } = await supabase!
        .from('profiles')
        .upsert({ id: safeId, data: profile });
      if (error) throw error;
      return;
    } catch (supabaseError: any) {
      console.warn("Supabase saveProfile failed, falling back to local files:", supabaseError.message || supabaseError);
    }
  }

  // Fallback to local files (works in dev, read-only in production serverless)
  try {
    const dir = path.join(BASE_DATA_PATH, safeId);
    await ensureDir(dir);
    await (await import("fs/promises")).writeFile(path.join(dir, 'profile.json'), JSON.stringify(profile, null, 2));
  } catch (fsError: any) {
    console.warn(`[Storage] Local filesystem saveProfile failed (${fsError.message}). Using in-memory fallback. Note: in-memory data is lost on serverless cold start — ensure Supabase is connected for production persistence.`);
    memoryProfiles.set(safeId, profile);
  }
}

export async function getJobs(profileId: string = 'default') {
  const safeId = (typeof profileId === 'string' && profileId.trim()) ? profileId.trim() : 'default';
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = await supabase!
        .from('jobs')
        .select('jobs')
        .eq('profile_id', safeId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) return data.jobs || [];
    } catch (supabaseError: any) {
      console.warn("Supabase getJobs failed, falling back to local files:", supabaseError.message || supabaseError);
    }
  }

  // Fallback to local files
  const dbPath = path.join(BASE_DATA_PATH, safeId, 'jobs.json');
  try {
    const data = await (await import("fs/promises")).readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (memoryJobs.has(safeId)) {
      return memoryJobs.get(safeId) || [];
    }
    return [];
  }
}

export async function saveJobs(jobs: any[], profileId: string = 'default') {
  const safeId = (typeof profileId === 'string' && profileId.trim()) ? profileId.trim() : 'default';

  // Split metadata and heavy details
  const HEAVY_FIELDS = ['description', 'raw_description', 'tailored_resume_text', 'cover_letter_text', 'recruiter_hook_linkedin', 'recruiter_hook_email', 'application_notes', 'form_field_answers', 'interview_prep_data'];
  const jobsMetadata: any[] = [];
  const jobsDetails: Record<string, any>[] = [];

  for (const job of jobs) {
    const metadata: any = { ...job };
    const details: any = { job_id: job.id, profile_id: safeId };
    let hasDetails = false;
    for (const field of HEAVY_FIELDS) {
      if (job[field] !== undefined) {
        details[field] = job[field];
        delete metadata[field];
        hasDetails = true;
      }
    }
    jobsMetadata.push(metadata);
    if (hasDetails) {
      jobsDetails.push(details);
    }
  }

  let detailsSaved = false;
  if (isSupabaseEnabled() && jobsDetails.length > 0) {
    try {
      const { error: detailsError } = await supabase!
        .from('job_details')
        .upsert(jobsDetails);
      if (detailsError) throw detailsError;
      detailsSaved = true;
    } catch (err: any) {
      console.warn("[Storage] job_details upsert failed (table may not exist yet, falling back to inline):", err.message || err);
    }
  }

  if (isSupabaseEnabled()) {
    try {
      const { error } = await supabase!
        .from('jobs')
        .upsert({ profile_id: safeId, jobs: detailsSaved ? jobsMetadata : jobs });
      if (error) throw error;
      return;
    } catch (supabaseError: any) {
      console.warn("Supabase saveJobs failed, falling back to local files:", supabaseError.message || supabaseError);
    }
  }

  // Fallback to local files
  try {
    const dir = path.join(BASE_DATA_PATH, safeId);
    await ensureDir(dir);
    await (await import("fs/promises")).writeFile(path.join(dir, 'jobs.json'), JSON.stringify(jobsMetadata, null, 2));

    const detailsDir = path.join(dir, 'jobs_details');
    await ensureDir(detailsDir);
    const fs = await import("fs/promises");
    for (const detail of jobsDetails) {
      await fs.writeFile(path.join(detailsDir, `${detail.job_id}.json`), JSON.stringify(detail, null, 2));
    }
  } catch (fsError: any) {
    console.warn(`[Storage] Local filesystem saveJobs failed (${fsError.message}). Using in-memory fallback.`);
    memoryJobs.set(safeId, jobsMetadata);
    for (const detail of jobsDetails) {
      memoryJobDetails.set(detail.job_id, detail);
    }
  }
}

export async function getJobDetails(jobId: string, profileId: string = 'default') {
  const safeId = (typeof profileId === 'string' && profileId.trim()) ? profileId.trim() : 'default';

  if (isSupabaseEnabled()) {
    try {
      const { data, error } = await supabase!
        .from('job_details')
        .select('*')
        .eq('job_id', jobId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) return data;
    } catch (supabaseError: any) {
      console.warn("Supabase getJobDetails failed, falling back to local files:", supabaseError.message || supabaseError);
    }
  }

  // Fallback to local files
  const detailPath = path.join(BASE_DATA_PATH, safeId, 'jobs_details', `${jobId}.json`);
  try {
    const data = await (await import("fs/promises")).readFile(detailPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (memoryJobDetails.has(jobId)) {
      return memoryJobDetails.get(jobId);
    }
    // Fallback check in jobs metadata array in case it hasn't been split yet
    const jobs = await getJobs(safeId);
    const job = jobs.find((j: any) => j.id === jobId);
    if (job) {
      return {
        job_id: jobId,
        profile_id: safeId,
        description: job.description || "",
        raw_description: job.raw_description || "",
        tailored_resume_text: job.tailored_resume_text || "",
        cover_letter_text: job.cover_letter_text || "",
        recruiter_hook_linkedin: job.recruiter_hook_linkedin || "",
        recruiter_hook_email: job.recruiter_hook_email || "",
        application_notes: job.application_notes || "",
        form_field_answers: job.form_field_answers || null,
        interview_prep_data: job.interview_prep_data || null
      };
    }
    return null;
  }
}

export async function updateJobStatus(id: string, status: string, profileId: string = 'default') {
  const jobs = await getJobs(profileId);
  const updated = jobs.map((j: any) => j.id === id ? { ...j, status } : j);
  await saveJobs(updated, profileId);
  return updated;
}

export async function deleteJob(id: string, profileId: string = 'default') {
  const safeId = (typeof profileId === 'string' && profileId.trim()) ? profileId.trim() : 'default';

  if (isSupabaseEnabled()) {
    try {
      await supabase!.from('job_details').delete().eq('job_id', id);
    } catch (supabaseError: any) {
      console.warn("Supabase deleteJob details failed:", supabaseError.message || supabaseError);
    }
  }

  // Fallback to local files
  const detailPath = path.join(BASE_DATA_PATH, safeId, 'jobs_details', `${id}.json`);
  try {
    const fs = await import("fs/promises");
    await fs.unlink(detailPath);
  } catch (err) {}
  memoryJobDetails.delete(id);

  const jobs = await getJobs(profileId);
  const filtered = jobs.filter((j: any) => j.id !== id);
  await saveJobs(filtered, profileId);
  return filtered;
}

export async function toggleFavourite(id: string, profileId: string = 'default') {
  const jobs = await getJobs(profileId);
  const updated = jobs.map((j: any) => j.id === id ? { ...j, isFavourite: !j.isFavourite } : j);
  await saveJobs(updated, profileId);
  return updated.find((j: any) => j.id === id);
}

export async function updateJobField(id: string, fields: Record<string, any>, profileId: string = 'default') {
  const safeId = (typeof profileId === 'string' && profileId.trim()) ? profileId.trim() : 'default';

  const HEAVY_FIELDS = ['description', 'raw_description', 'tailored_resume_text', 'cover_letter_text', 'recruiter_hook_linkedin', 'recruiter_hook_email', 'application_notes', 'form_field_answers', 'interview_prep_data'];
  const metadataFields: Record<string, any> = {};
  const detailsFields: Record<string, any> = {};
  let hasDetails = false;

  for (const key of Object.keys(fields)) {
    if (HEAVY_FIELDS.includes(key)) {
      detailsFields[key] = fields[key];
      hasDetails = true;
    } else {
      metadataFields[key] = fields[key];
    }
  }

  // Save metadata
  const jobs = await getJobs(profileId);
  const updated = jobs.map((j: any) => j.id === id ? { ...j, ...metadataFields } : j);
  await saveJobs(updated, profileId);

  // Save details
  if (hasDetails) {
    let detailsSaved = false;
    if (isSupabaseEnabled()) {
      try {
        const { error } = await supabase!
          .from('job_details')
          .upsert({ job_id: id, profile_id: safeId, ...detailsFields });
        if (!error) detailsSaved = true;
      } catch (err: any) {
        console.warn("Supabase updateJobField details failed (falling back inline):", err.message || err);
      }
    }

    if (!detailsSaved) {
      // Fallback: save details inside the metadata array
      const updatedWithDetails = jobs.map((j: any) => j.id === id ? { ...j, ...fields } : j);
      await saveJobs(updatedWithDetails, profileId);
    }

    // Local files details
    const detailsDir = path.join(BASE_DATA_PATH, safeId, 'jobs_details');
    await ensureDir(detailsDir);
    const detailPath = path.join(detailsDir, `${id}.json`);
    try {
      const fs = await import("fs/promises");
      let existingDetails = {};
      try {
        const existingData = await fs.readFile(detailPath, 'utf-8');
        existingDetails = JSON.parse(existingData);
      } catch (e) {}
      const mergedDetails = { job_id: id, profile_id: safeId, ...existingDetails, ...detailsFields };
      await fs.writeFile(detailPath, JSON.stringify(mergedDetails, null, 2));
    } catch (fsError: any) {
      const existing = memoryJobDetails.get(id) || {};
      memoryJobDetails.set(id, { job_id: id, profile_id: safeId, ...existing, ...detailsFields });
    }
  }

  return updated.find((j: any) => j.id === id);
}
