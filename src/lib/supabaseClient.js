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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
