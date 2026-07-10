import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkPartnerProfiles() {
  const { data, error } = await supabase.from('partner_profiles').select('*, brands(*)');
  console.log("Partner Profiles:", error ? error : data);
}

checkPartnerProfiles();
