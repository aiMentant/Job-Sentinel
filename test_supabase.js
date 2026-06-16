const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.log("No Supabase keys");
  process.exit(0);
}

const supabase = createClient(url, key);

async function run() {
  console.log("Querying profiles...");
  const res = await supabase.from('profiles').select('data').eq('id', 'Lea').single();
  console.log(res);
}

run();
