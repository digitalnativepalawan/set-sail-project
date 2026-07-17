import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ---------------------------------------------------------------------------
// Supabase Client — Auto-detects Lovable / Supabase Cloud variables
// ---------------------------------------------------------------------------
// Lovable.dev automatically injects these environment variables when you
// connect your Supabase project in the Lovable dashboard.
//
// If they are missing (e.g., during local development before connecting),
// this client returns null, and our repository layer (storage.ts) will
// transparently fall back to localStorage so the CMS remains 100% functional.
// ---------------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;

/** Helper to check if Supabase Cloud is actively connected and ready */
export function isSupabaseConnected(): boolean {
  return !!supabase;
}
