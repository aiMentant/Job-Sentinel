import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl) {
  console.warn("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
