import fs from 'fs/promises';
import path from 'path';
import { supabase } from './supabaseClient';

const BASE_DATA_PATH = path.join(process.cwd(), 'data/profiles');

// Keep in-memory singletons across Next.js Hot Module Replacement (HMR)
const globalForStorage = global as unknown as {
  memoryProfiles?: Map<string, any>;
  memoryJobs?: Map<string, any[]>;
};

const memoryProfiles = globalForStorage.memoryProfiles || new Map<string, any>();
const memoryJobs = globalForStorage.memoryJobs || new Map<string, any[]>();

if (process.env.NODE_ENV !== "production") {
  globalForStorage.memoryProfiles = memoryProfiles;
  globalForStorage.memoryJobs = memoryJobs;
}

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
    const { data, error } = await supabase.from('profiles').select('id');
    if (error) {
      throw new Error(`Supabase listProfiles failed: ${error.message} (code: ${error.code})`);
    }
    const dbIds = (data || []).map((p: any) => p.id);
    return Array.from(new Set(['default', ...dbIds]));
  }

  // Fallback to local files
  try {
    await ensureDir(BASE_DATA_PATH);
    const dirs = await fs.readdir(BASE_DATA_PATH);
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
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase
      .from('profiles')
      .select('data')
      .eq('id', profileId)
      .single();
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Supabase getProfile failed: ${error.message} (code: ${error.code})`);
    }
    if (data) return data.data;
    if (profileId === 'default') {
      return { fullName: "Lea Wenban", targetTitles: [], targetLocations: [], skills: [], experience: [], education: [] };
    }
    // Fallback for custom profile not found in Supabase yet
    const formattedName = profileId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { fullName: formattedName, targetTitles: [], targetLocations: [], skills: [], experience: [], education: [] };
  }

  // Fallback to local files
  const profilePath = path.join(BASE_DATA_PATH, profileId, 'profile.json');
  try {
    const data = await fs.readFile(profilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (memoryProfiles.has(profileId)) {
      return memoryProfiles.get(profileId);
    }
    if (profileId === 'default') {
      return { fullName: "Lea Wenban", targetTitles: [], targetLocations: [], skills: [], experience: [], education: [] };
    }
    const formattedName = profileId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { fullName: formattedName, targetTitles: [], targetLocations: [], skills: [], experience: [], education: [] };
  }
}

export async function saveProfile(profile: any, profileId: string = 'default') {
  if (isSupabaseEnabled()) {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: profileId, data: profile });
    if (error) {
      throw new Error(`Supabase saveProfile failed: ${error.message} (code: ${error.code})`);
    }
    return;
  }

  // Fallback to local files
  try {
    const dir = path.join(BASE_DATA_PATH, profileId);
    await ensureDir(dir);
    await fs.writeFile(path.join(dir, 'profile.json'), JSON.stringify(profile, null, 2));
  } catch (fsError: any) {
    console.warn(`Local filesystem saveProfile failed (${fsError.message}), using in-memory storage fallback.`);
    memoryProfiles.set(profileId, profile);
  }
}

export async function getJobs(profileId: string = 'default') {
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase
      .from('jobs')
      .select('jobs')
      .eq('profile_id', profileId)
      .single();
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Supabase getJobs failed: ${error.message} (code: ${error.code})`);
    }
    if (data) return data.jobs || [];
  }

  // Fallback to local files
  const dbPath = path.join(BASE_DATA_PATH, profileId, 'jobs.json');
  try {
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (memoryJobs.has(profileId)) {
      return memoryJobs.get(profileId) || [];
    }
    return [];
  }
}

export async function saveJobs(jobs: any[], profileId: string = 'default') {
  if (isSupabaseEnabled()) {
    const { error } = await supabase
      .from('jobs')
      .upsert({ profile_id: profileId, jobs: jobs });
    if (error) {
      throw new Error(`Supabase saveJobs failed: ${error.message} (code: ${error.code})`);
    }
    return;
  }

  // Fallback to local files
  try {
    const dir = path.join(BASE_DATA_PATH, profileId);
    await ensureDir(dir);
    await fs.writeFile(path.join(dir, 'jobs.json'), JSON.stringify(jobs, null, 2));
  } catch (fsError: any) {
    console.warn(`Local filesystem saveJobs failed (${fsError.message}), using in-memory storage fallback.`);
    memoryJobs.set(profileId, jobs);
  }
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
