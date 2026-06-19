// One-time seed script: uploads all local profile + jobs data to Supabase
// Run with: node seed_supabase.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);
const BASE = path.join(__dirname, 'data/profiles');

async function seed() {
  const dirs = fs.readdirSync(BASE).filter(d => !d.startsWith('.'));
  console.log(`Found ${dirs.length} local profiles:`, dirs);

  for (const profileId of dirs) {
    const profileFile = path.join(BASE, profileId, 'profile.json');
    const jobsFile = path.join(BASE, profileId, 'jobs.json');

    // Upload profile
    if (fs.existsSync(profileFile)) {
      const profileData = JSON.parse(fs.readFileSync(profileFile, 'utf-8'));
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: profileId, data: profileData });
      if (error) {
        console.error(`  ❌ Failed to seed profile "${profileId}":`, error.message);
      } else {
        console.log(`  ✅ Seeded profile: ${profileId} (${profileData.fullName || 'no name'})`);
      }
    }

    // Upload jobs
    if (fs.existsSync(jobsFile)) {
      const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf-8'));
      const { error } = await supabase
        .from('jobs')
        .upsert({ profile_id: profileId, jobs });
      if (error) {
        console.error(`  ❌ Failed to seed jobs for "${profileId}":`, error.message);
      } else {
        console.log(`  ✅ Seeded ${jobs.length} jobs for: ${profileId}`);
      }
    }
  }

  // Also seed "Robert" alias pointing to robert-test-slug data (since adminActions uses profile_id "Robert")
  const robertFile = path.join(BASE, 'robert-test-slug', 'profile.json');
  if (fs.existsSync(robertFile)) {
    const robertData = JSON.parse(fs.readFileSync(robertFile, 'utf-8'));
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: 'Robert', data: robertData });
    if (error) {
      console.error('  ❌ Failed to seed Robert alias:', error.message);
    } else {
      console.log('  ✅ Seeded profile alias: Robert');
    }
  }

  console.log('\nDone! All local profiles seeded to Supabase.');
}

seed().catch(console.error);
