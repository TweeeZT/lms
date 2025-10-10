"use client";

import { createClient } from "@supabase/supabase-js";

// Browser-side Supabase client (uses public anon key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast in dev to avoid confusing runtime errors
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment"
  );
}

// Create browser Supabase client. We persist session in storage but disable
// automatic refresh attempts to avoid noisy "Invalid Refresh Token" errors
// when a refresh token is not available (we handle session checks explicitly).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  }
);

export type SupabaseClientType = typeof supabase;
