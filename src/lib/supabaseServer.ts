import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase URL or SERVICE_ROLE_KEY for server client");
}

// Admin client with service role key for server-side operations
export const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Default export for backwards compatibility
export default supabaseAdmin;
