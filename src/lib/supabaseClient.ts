import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
  console.warn("Missing or invalid Supabase URL environment variable.");
}

let client = null;
try {
  if (supabaseUrl && supabaseUrl.startsWith("http") && supabaseServiceKey) {
    client = createClient(supabaseUrl, supabaseServiceKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
}

export const supabase = client as any;

