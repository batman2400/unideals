/**
 * Supabase Client
 *
 * Initializes and exports the Supabase client using
 * environment variables from .env.local.
 *
 * Usage:
 *   import { supabase } from '../lib/supabaseClient';
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[supabaseClient] Missing environment variables. " +
      "Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
