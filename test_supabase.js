import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY // fallback to anon if service missing, but I'll add service
);

async function test() {
  const { data, error } = await supabase.from('partner_profiles').select('user_id, brands(*)').limit(1);
  console.log("Partner Profiles:", error || JSON.stringify(data, null, 2));
}

test();
