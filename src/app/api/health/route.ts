import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    supabase_url_present: !!url,
    supabase_url_valid: url.startsWith("http"),
    supabase_url_suffix: url ? `...${url.slice(-20)}` : "MISSING",
    supabase_key_present: !!key,
    supabase_key_length: key ? key.length : 0,
    supabase_key_suffix: key ? `...${key.slice(-6)}` : "MISSING",
    supabase_client_initialized: supabase !== null && supabase !== undefined,
    browserless_key_present: !!process.env.BROWSERLESS_API_KEY,
    browserless_key_length: process.env.BROWSERLESS_API_KEY ? process.env.BROWSERLESS_API_KEY.length : 0,
    gemini_key_present: !!process.env.GEMINI_API_KEY,
    gemini_key_length: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
    supabase_connected: false,
    tables: {} as Record<string, string>,
    profiles_in_db: [] as string[],
    error: null as string | null,
  };

  if (!supabase) {
    report.error = "Supabase client is null — check env vars above.";
    return NextResponse.json(report, { status: 503 });
  }

  // Ping each expected table
  const tables = ["profiles", "jobs", "users", "activity_logs", "agent_status"];
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select("*").limit(1);
      report.tables[table] = error
        ? `ERROR: ${error.message} (code: ${error.code})`
        : "OK";
    } catch (e: any) {
      report.tables[table] = `EXCEPTION: ${e?.message || e}`;
    }
  }

  // List which profile IDs actually exist in the DB
  try {
    const { data } = await supabase.from("profiles").select("id");
    report.profiles_in_db = (data || []).map((r: any) => r.id);
  } catch {}

  // Mark overall connection health
  const profilesOk = report.tables["profiles"] === "OK";
  const jobsOk = report.tables["jobs"] === "OK";
  report.supabase_connected = profilesOk && jobsOk;

  return NextResponse.json(report, {
    status: report.supabase_connected ? 200 : 503,
  });
}
