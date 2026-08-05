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
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@unideals.test',
    password: 'Test1234!',
  });

  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  
  console.log("Logged in as admin.");

  const { data: brands, error: brandsError } = await supabase.from('brands').select('*');
  const { data: events, error: eventsError } = await supabase.from('events').select('*');
  const { data: deals, error: dealsError } = await supabase.from('deals').select('*');

  console.log("Brands:");
  console.log(brands?.map(b => ({ id: b.id, name: b.name })));

  console.log("\nEvents:");
  console.log(events?.map(e => ({ id: e.id, title: e.title })));

  console.log("\nDeals:");
  console.log(deals?.map(d => ({ id: d.id, title: d.title, brand: d.brand })));
}

main();
