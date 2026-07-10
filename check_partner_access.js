import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkPartnerAccess() {
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  // We can't use admin API with anon key.
  
  // Let's just query partner_access
  const { data, error } = await supabase.from('partner_access').select('*, brands(*)');
  console.log("Partner Access:", error ? error : data);
}

checkPartnerAccess();
