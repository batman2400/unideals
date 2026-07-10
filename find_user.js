import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function findUser() {
  // Let's just list all partner_profiles and join brands
  const { data, error } = await supabase.from('partner_profiles').select('user_id, brand_name, brand_id, brands(*)');
  console.log("Profiles:", error || JSON.stringify(data, null, 2));
}

findUser();
