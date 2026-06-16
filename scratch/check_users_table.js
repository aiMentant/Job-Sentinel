const fs = require('fs');
const { createClient } = require('/Users/leawenban/Documents/Antigravity-Files/Job-Sentinel/node_modules/@supabase/supabase-js');

const envContent = fs.readFileSync('/Users/leawenban/Documents/Antigravity-Files/Job-Sentinel/.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('users').select('*');
  console.log('Users table data:', data);
  console.log('Users table error:', error);
}
check().catch(console.error);
