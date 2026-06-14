const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Supabase URL:", url);
console.log("Supabase Key configured:", !!key);

if (!url || !key) {
  console.error("Missing credentials in environment");
  process.exit(1);
}

const supabase = createClient(url, key);

async function runTest() {
  console.log("Testing profiles list...");
  const { data: listData, error: listError } = await supabase.from('profiles').select('id');
  if (listError) {
    console.error("Profiles List Error:", listError);
  } else {
    console.log("Profiles List Success:", listData);
  }

  console.log("Testing profile upsert...");
  const { data: upsertData, error: upsertError } = await supabase
    .from('profiles')
    .upsert({ id: 'test-profile-id', data: { fullName: "Test User" } });
  if (upsertError) {
    console.error("Profiles Upsert Error:", upsertError);
  } else {
    console.log("Profiles Upsert Success:", upsertData);
  }
}

runTest();
