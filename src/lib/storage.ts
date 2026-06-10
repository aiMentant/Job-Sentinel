import fs from 'fs/promises';
import path from 'path';
import { supabase } from './supabaseClient';

const BASE_DATA_PATH = path.join(process.cwd(), 'data/profiles');

// Helper to determine if we should use Supabase or local files
function isSupabaseEnabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return !!(url && key && url !== "" && key !== "" && supabase);
}

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // Ignore folder creation errors (e.g. read-only filesystem)
  }
}

export async function listProfiles() {
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = await supabase.from('profiles').select('id');
      if (error) throw error;
      return (data || []).map((p: any) => p.id);
    } catch (e) {
      console.warn("Supabase listProfiles failed, falling back to local files:", e);
    }
  }

  // Fallback to local files
  try {
    await ensureDir(BASE_DATA_PATH);
    const dirs = await fs.readdir(BASE_DATA_PATH);
    const filtered = dirs.filter(d => !d.startsWith('.'));
    return filtered.length > 0 ? filtered : ['default'];
  } catch (fsError) {
    console.warn("Local filesystem read failed, returning default profile ID:", fsError);
    return ['default'];
  }
}

export async function getProfile(profileId: string = 'default') {
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('data')
        .eq('id', profileId)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is empty result code
      if (data) return data.data;
      if (profileId === 'default') {
        return { fullName: "Lea Wenban", targetTitles: [], targetLocations: [], skills: [], experience: [], education: [] };
      }
    } catch (e) {
      console.warn("Supabase getProfile failed, falling back to local files:", e);
    }
  }

  // Fallback to local files
  const profilePath = path.join(BASE_DATA_PATH, profileId, 'profile.json');
  try {
    const data = await fs.readFile(profilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { fullName: "Lea Wenban", targetTitles: [], targetLocations: [], skills: [], experience: [], education: [] };
  }
}

export async function saveProfile(profile: any, profileId: string = 'default') {
  if (isSupabaseEnabled()) {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: profileId, data: profile });
      if (error) throw error;
      return;
    } catch (e) {
      console.warn("Supabase saveProfile failed, falling back to local files:", e);
    }
  }

  // Fallback to local files
  try {
    const dir = path.join(BASE_DATA_PATH, profileId);
    await ensureDir(dir);
    await fs.writeFile(path.join(dir, 'profile.json'), JSON.stringify(profile, null, 2));
  } catch (fsError) {
    throw new Error("Unable to save profile. The production filesystem is read-only. Please ensure your Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are configured in your hosting dashboard settings (e.g. Netlify/Vercel) so database persistence is active.");
  }
}

export async function getJobs(profileId: string = 'default') {
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('jobs')
        .eq('profile_id', profileId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) return data.jobs || [];
    } catch (e) {
      console.warn("Supabase getJobs failed, falling back to local files:", e);
    }
  }

  // Fallback to local files
  const dbPath = path.join(BASE_DATA_PATH, profileId, 'jobs.json');
  try {
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

export async function saveJobs(jobs: any[], profileId: string = 'default') {
  if (isSupabaseEnabled()) {
    try {
      const { error } = await supabase
        .from('jobs')
        .upsert({ profile_id: profileId, jobs: jobs });
      if (error) throw error;
      return;
    } catch (e) {
      console.warn("Supabase saveJobs failed, falling back to local files:", e);
    }
  }

  // Fallback to local files
  const dir = path.join(BASE_DATA_PATH, profileId);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, 'jobs.json'), JSON.stringify(jobs, null, 2));
}

export async function updateJobStatus(id: string, status: string, profileId: string = 'default') {
  const jobs = await getJobs(profileId);
  const updated = jobs.map((j: any) => j.id === id ? { ...j, status } : j);
  await saveJobs(updated, profileId);
  return updated;
}

export async function deleteJob(id: string, profileId: string = 'default') {
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
  const jobs = await getJobs(profileId);
  const updated = jobs.map((j: any) => j.id === id ? { ...j, ...fields } : j);
  await saveJobs(updated, profileId);
  return updated.find((j: any) => j.id === id);
}
