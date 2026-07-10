import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkBrands() {
  const { data, error } = await supabase.from('brands').select('*').limit(1);
  console.log(error ? error : data);
}

checkBrands();
