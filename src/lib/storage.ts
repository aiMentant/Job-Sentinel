import fs from 'fs/promises';
import path from 'path';
import { supabase } from './supabaseClient';

const safeCwd = typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '';
const BASE_DATA_PATH = path.join(safeCwd, 'data/profiles');

// Keep in-memory singletons across Next.js Hot Module Replacement (HMR)
const globalForStorage = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as {
  memoryProfiles?: Map<string, any>;
  memoryJobs?: Map<string, any[]>;
};

const memoryProfiles = globalForStorage.memoryProfiles || new Map<string, any>();
const memoryJobs = globalForStorage.memoryJobs || new Map<string, any[]>();

if (typeof process !== 'undefined' && process.env.NODE_ENV !== "production") {
  globalForStorage.memoryProfiles = memoryProfiles;
  globalForStorage.memoryJobs = memoryJobs;
}

// Helper to determine if we should use Supabase or local files
export function isSupabaseEnabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
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
      const dbIds = (data || []).map((p: any) => p.id);
      return Array.from(new Set(['default', ...dbIds]));
    } catch (supabaseError: any) {
      console.warn("Supabase listProfiles failed, falling back to local files:", supabaseError.message || supabaseError);
    }
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
  const safeId = (typeof profileId === 'string' && profileId.trim()) ? profileId.trim() : 'default';
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = await supabase
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
    const data = await fs.readFile(profilePath, 'utf-8');
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
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: safeId, data: profile });
      if (error) throw error;
      return;
    } catch (supabaseError: any) {
      console.warn("Supabase saveProfile failed, falling back to local files:", supabaseError.message || supabaseError);
    }
  }

  // Fallback to local files
  try {
    const dir = path.join(BASE_DATA_PATH, safeId);
    await ensureDir(dir);
    await fs.writeFile(path.join(dir, 'profile.json'), JSON.stringify(profile, null, 2));
  } catch (fsError: any) {
    console.warn(`Local filesystem saveProfile failed (${fsError.message}), using in-memory storage fallback.`);
    memoryProfiles.set(safeId, profile);
  }
}

export async function getJobs(profileId: string = 'default') {
  const safeId = (typeof profileId === 'string' && profileId.trim()) ? profileId.trim() : 'default';
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = await supabase
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
    const data = await fs.readFile(dbPath, 'utf-8');
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
  if (isSupabaseEnabled()) {
    try {
      const { error } = await supabase
        .from('jobs')
        .upsert({ profile_id: safeId, jobs: jobs });
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
    await fs.writeFile(path.join(dir, 'jobs.json'), JSON.stringify(jobs, null, 2));
  } catch (fsError: any) {
    console.warn(`Local filesystem saveJobs failed (${fsError.message}), using in-memory storage fallback.`);
    memoryJobs.set(safeId, jobs);
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
