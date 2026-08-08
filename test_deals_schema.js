import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking bucket...");
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error("List Buckets Error:", bucketError.message);
  } else {
    console.log("Buckets:", buckets.map(b => b.name));
  }

  console.log("\nChecking deals table schema...");
  const { data: dealData, error: dealError } = await supabase.from('deals').select('id').limit(1);
  const { data: colData, error: colError } = await supabase.rpc('get_deals_columns'); // wait, can't run rpc if not defined.
  // Instead just query postgres directly using REST if possible? No.
  // Let's just do a select with a non-existent column to see if it throws.
  console.log("\nChecking partner_profiles table schema...");
  const { data: ppData, error: ppError } = await supabase.from('partner_profiles').select('brand_id').limit(1);
  console.log("Partner Profiles Check Error:", ppError ? ppError.message : "Success");
}

main();
