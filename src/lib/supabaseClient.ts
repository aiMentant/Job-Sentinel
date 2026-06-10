import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
  console.warn("Missing or invalid NEXT_PUBLIC_SUPABASE_URL environment variable.");
}

export const supabase = (supabaseUrl && supabaseUrl.startsWith("http") && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null as any;
