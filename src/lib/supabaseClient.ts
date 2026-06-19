import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

// Log env var presence (never log actual values)
if (!supabaseUrl) {
  console.error(
    "[Supabase] CRITICAL: NEXT_PUBLIC_SUPABASE_URL is missing or empty."
  );
} else if (!supabaseUrl.startsWith("http")) {
  console.error(
    `[Supabase] CRITICAL: NEXT_PUBLIC_SUPABASE_URL is invalid (does not start with 'http'). Length: ${supabaseUrl.length}`
  );
}

if (!supabaseServiceKey) {
  console.error(
    "[Supabase] CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing or empty."
  );
} else if (supabaseServiceKey.length < 100) {
  console.error(
    `[Supabase] WARNING: SUPABASE_SERVICE_ROLE_KEY looks too short (${supabaseServiceKey.length} chars). Expected 200+. May be truncated.`
  );
}

let client: SupabaseClient | null = null;

if (supabaseUrl.startsWith("http") && supabaseServiceKey.length > 50) {
  try {
    client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        // Service role key should never auto-refresh or persist sessions
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log(
      `[Supabase] Client initialized successfully. URL: ${supabaseUrl}`
    );
  } catch (e: any) {
    console.error("[Supabase] CRITICAL: createClient() threw an error:", e?.message || e);
    client = null;
  }
} else {
  console.warn(
    "[Supabase] Client NOT initialized — missing or invalid credentials. App will use filesystem/memory fallback."
  );
}

export const supabase = client;

/**
 * Returns the Supabase client, or throws a clear error if it is not initialized.
 * Use this in places where Supabase is required and a silent fallback is NOT acceptable.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      "[Supabase] Client is not initialized. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }
  return client;
}
