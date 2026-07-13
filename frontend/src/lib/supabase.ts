import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are missing in the frontend configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Alias to prevent creating multiple GoTrueClient/Supabase instances in the same context
export const anonSupabase = supabase;

