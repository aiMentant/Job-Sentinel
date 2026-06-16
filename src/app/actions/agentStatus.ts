"use server";

import path from "path";

const STATUS_PATH = path.join(process.cwd(), "data", "agent_status.json");

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

// Keep in-memory status cached globally across HMR
const globalForStatus = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as {
  memoryStatus?: AgentStatus;
};

let memoryStatus = globalForStatus.memoryStatus || { 
  isSearching: false, 
  isSubmitting: false, 
  status: "Idle", 
  lastUpdated: new Date().toISOString(), 
  resultsFound: 0 
};

if (process.env.NODE_ENV !== "production") {
  globalForStatus.memoryStatus = memoryStatus;
}

export async function getAgentStatus(): Promise<AgentStatus> {
  try {
    const data = await (await import("fs/promises")).readFile(STATUS_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return memoryStatus;
  }
}

export async function setAgentStatus(status: Partial<AgentStatus>) {
  const current = await getAgentStatus();
  const updated = { ...current, ...status, lastUpdated: new Date().toISOString() };
  try {
    await (await import("fs/promises")).mkdir(path.dirname(STATUS_PATH), { recursive: true });
    await (await import("fs/promises")).writeFile(STATUS_PATH, JSON.stringify(updated, null, 2));
  } catch (e: any) {
    console.warn(`Writing agent status to filesystem failed (${e.message}), using in-memory fallback.`);
  }
  memoryStatus = updated;
  if (process.env.NODE_ENV !== "production") {
    globalForStatus.memoryStatus = memoryStatus;
  }
  return updated;
}

export async function resolveApproval() {
  await setAgentStatus({ needsApproval: false, status: "Approval received. Resuming mission..." });
}

export async function stopSubmissions() {
  await setAgentStatus({ isSubmitting: false, needsApproval: false, status: "Submissions aborted by user." });
}

