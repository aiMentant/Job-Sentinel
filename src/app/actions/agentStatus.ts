"use server";

import { supabase } from "@/lib/supabaseClient";

export type AgentStatus = {
  isSearching: boolean;
  isSubmitting: boolean;
  status: string;
  lastUpdated: string;
  resultsFound: number;
  currentJobTitle?: string;
  progress?: number; // 0 to 100
  needsApproval?: boolean;
};

const DEFAULT_STATUS: AgentStatus = {
  isSearching: false,
  isSubmitting: false,
  status: "Idle",
  lastUpdated: new Date().toISOString(),
  resultsFound: 0,
};

// ---------------------------------------------------------------------------
// In-memory fallback — works within a single serverless function invocation.
// Enabled in ALL environments (previously only non-production, which meant
// production had no working fallback when filesystem writes fail).
// ---------------------------------------------------------------------------
const globalForStatus = (
  typeof globalThis !== "undefined" ? globalThis : global
) as unknown as { memoryStatus?: AgentStatus };

let memoryStatus: AgentStatus =
  globalForStatus.memoryStatus || { ...DEFAULT_STATUS };
globalForStatus.memoryStatus = memoryStatus;

// ---------------------------------------------------------------------------
// Supabase persistence (preferred in production)
// Uses a singleton row in the agent_status table (id = 'singleton').
// ---------------------------------------------------------------------------
async function readStatusFromSupabase(): Promise<AgentStatus | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("agent_status")
      .select("status")
      .eq("id", "singleton")
      .single();
    if (error || !data) return null;
    return data.status as AgentStatus;
  } catch {
    return null;
  }
}

async function writeStatusToSupabase(status: AgentStatus): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("agent_status").upsert({
      id: "singleton",
      status,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Filesystem fallback (works locally, not in serverless production)
// ---------------------------------------------------------------------------
async function readStatusFromFile(): Promise<AgentStatus | null> {
  try {
    const path = await import("path");
    const fs = await import("fs/promises");
    const STATUS_PATH = path.join(process.cwd(), "data", "agent_status.json");
    const data = await fs.readFile(STATUS_PATH, "utf-8");
    return JSON.parse(data) as AgentStatus;
  } catch {
    return null;
  }
}

async function writeStatusToFile(status: AgentStatus): Promise<boolean> {
  try {
    const path = await import("path");
    const fs = await import("fs/promises");
    const STATUS_PATH = path.join(process.cwd(), "data", "agent_status.json");
    await fs.mkdir(path.dirname(STATUS_PATH), { recursive: true });
    await fs.writeFile(STATUS_PATH, JSON.stringify(status, null, 2));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function getAgentStatus(): Promise<AgentStatus> {
  // 1. Try Supabase
  const fromSupabase = await readStatusFromSupabase();
  if (fromSupabase) {
    memoryStatus = fromSupabase;
    globalForStatus.memoryStatus = memoryStatus;
    return fromSupabase;
  }

  // 2. Try local filesystem (works locally)
  const fromFile = await readStatusFromFile();
  if (fromFile) {
    memoryStatus = fromFile;
    globalForStatus.memoryStatus = memoryStatus;
    return fromFile;
  }

  // 3. In-memory (last resort — resets on cold start)
  return globalForStatus.memoryStatus || { ...DEFAULT_STATUS };
}

export async function setAgentStatus(
  status: Partial<AgentStatus>
): Promise<AgentStatus> {
  const current = await getAgentStatus();
  const updated: AgentStatus = {
    ...current,
    ...status,
    lastUpdated: new Date().toISOString(),
  };

  // Always update memory first (instant, never fails)
  memoryStatus = updated;
  globalForStatus.memoryStatus = updated;

  // Try Supabase (non-blocking — don't await failure)
  const savedToSupabase = await writeStatusToSupabase(updated);

  // Fall back to filesystem if Supabase not available
  if (!savedToSupabase) {
    await writeStatusToFile(updated);
  }

  return updated;
}

export async function resolveApproval() {
  await setAgentStatus({
    needsApproval: false,
    status: "Approval received. Resuming mission...",
  });
}

export async function stopSubmissions() {
  await setAgentStatus({
    isSubmitting: false,
    needsApproval: false,
    status: "Submissions aborted by user.",
  });
}
