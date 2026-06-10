"use server";

import fs from "fs/promises";
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

export async function getAgentStatus(): Promise<AgentStatus> {
  try {
    const data = await fs.readFile(STATUS_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return { isSearching: false, isSubmitting: false, status: "Idle", lastUpdated: new Date().toISOString(), resultsFound: 0 };
  }
}

export async function setAgentStatus(status: Partial<AgentStatus>) {
  const current = await getAgentStatus();
  const updated = { ...current, ...status, lastUpdated: new Date().toISOString() };
  await fs.mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await fs.writeFile(STATUS_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

export async function resolveApproval() {
  await setAgentStatus({ needsApproval: false, status: "Approval received. Resuming mission..." });
}

