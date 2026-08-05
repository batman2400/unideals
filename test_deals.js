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
  const { data, error } = await supabase.rpc("get_public_deals");
  if (error) {
    console.error("Error fetching deals:", error.message, error.code, error.details);
  } else {
    console.log("get_public_deals returned:", JSON.stringify(data, null, 2));
  }
}

main();
