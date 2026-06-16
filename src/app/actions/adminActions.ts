"use server";

import fs from "fs/promises";
import path from "path";
import { isSupabaseEnabled } from "@/lib/storage";
import { supabase } from "@/lib/supabaseClient";

const USERS_FILE_PATH = path.join(process.cwd(), "data/users.json");
const LOGS_FILE_PATH = path.join(process.cwd(), "data/activity_logs.json");

// Helper to race a promise against a timeout to prevent serverless function hangs
function withTimeout<T>(promise: Promise<T>, ms: number = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Database timeout")), ms))
  ]);
}

// Ensure data folder exists
async function ensureDataDir() {
  try {
    await fs.mkdir(path.join(process.cwd(), "data"), { recursive: true });
  } catch (e) {
    // Ignore
  }
}

// Initial fallback seed
const DEFAULT_USERS = [
  { email: "robert.tombs@sky.com", password: "PixelPusher1", role: "user", profile_id: "Robert", created_at: new Date().toISOString() },
  { email: "dominicmadonia80@gmail.com", password: "PixelPusher1", role: "user", profile_id: "Nick", created_at: new Date().toISOString() },
  { email: "lwenban@gmail.com", password: "pixel1", role: "admin", profile_id: "Lea", created_at: new Date().toISOString() }
];

export async function listAllUsers() {
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = (await withTimeout(
        supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: true })
      )) as any;
      if (!error && data) return data;
    } catch (e) {
      console.warn("Supabase listAllUsers failed, falling back to local storage:", e);
    }
  }

  // Fallback to local files
  try {
    await ensureDataDir();
    const content = await fs.readFile(USERS_FILE_PATH, "utf8");
    return JSON.parse(content);
  } catch (e) {
    // Return seeded defaults if file doesn't exist
    return DEFAULT_USERS;
  }
}

export async function saveUser(user: { email: string; password?: string; role?: string; profile_id?: string }) {
  if (isSupabaseEnabled()) {
    try {
      const { error } = (await withTimeout(
        supabase.from("users").upsert({
          email: user.email,
          password: user.password,
          role: user.role || "user",
          profile_id: user.profile_id || "default",
          created_at: new Date().toISOString()
        })
      )) as any;
      if (!error) return { success: true };
      throw error;
    } catch (e: any) {
      console.warn("Supabase saveUser failed, falling back to local storage:", e.message || e);
    }
  }

  // Fallback to local files
  try {
    await ensureDataDir();
    const users = await listAllUsers();
    const existingIndex = users.findIndex((u: any) => u.email === user.email);
    
    if (existingIndex > -1) {
      users[existingIndex] = {
        ...users[existingIndex],
        ...user
      };
    } else {
      users.push({
        email: user.email,
        password: user.password || "",
        role: user.role || "user",
        profile_id: user.profile_id || "default",
        created_at: new Date().toISOString()
      });
    }

    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

export async function deleteUser(email: string) {
  if (isSupabaseEnabled()) {
    try {
      const { error } = (await withTimeout(
        supabase.from("users").delete().eq("email", email)
      )) as any;
      if (!error) return { success: true };
      throw error;
    } catch (e: any) {
      console.warn("Supabase deleteUser failed, falling back to local storage:", e.message || e);
    }
  }

  // Fallback to local files
  try {
    await ensureDataDir();
    const users = await listAllUsers();
    const filtered = users.filter((u: any) => u.email !== email);
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(filtered, null, 2));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

export async function logActivity(email: string, action: string, details: Record<string, any> = {}) {
  const timestamp = new Date().toISOString();
  if (isSupabaseEnabled()) {
    try {
      const { error } = (await withTimeout(
        supabase.from("activity_logs").insert({
          email,
          action,
          details,
          created_at: timestamp
        })
      )) as any;
      if (!error) return;
    } catch (e) {
      console.warn("Supabase logActivity failed:", e);
    }
  }

  // Fallback to local files
  try {
    await ensureDataDir();
    let logs: any[] = [];
    try {
      const content = await fs.readFile(LOGS_FILE_PATH, "utf8");
      logs = JSON.parse(content);
    } catch (readErr) {
      // Ignore if file is missing
    }

    logs.unshift({
      id: Math.random().toString(36).substring(2, 15),
      email,
      action,
      details,
      created_at: timestamp
    });

    // Keep last 500 logs locally
    if (logs.length > 500) logs = logs.slice(0, 500);

    await fs.writeFile(LOGS_FILE_PATH, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error("Local logActivity failed:", e);
  }
}

export async function getActivityLogs() {
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = (await withTimeout(
        supabase
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
      )) as any;
      if (!error && data) return data;
    } catch (e) {
      console.warn("Supabase getActivityLogs failed, falling back to local storage:", e);
    }
  }

  // Fallback to local files
  try {
    await ensureDataDir();
    const content = await fs.readFile(LOGS_FILE_PATH, "utf8");
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}
