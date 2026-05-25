import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This gives us a reusable 'supabase' object to talk to our cloud database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);