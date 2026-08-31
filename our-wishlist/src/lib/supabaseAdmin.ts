// Server-side only — never exposed to client
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
