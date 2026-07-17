// Bridge the app's supabase helper to the integrated Lovable Cloud client.
import { supabase as integrationSupabase } from "@/integrations/supabase/client";

export const supabase = integrationSupabase as unknown as any;

export function isSupabaseConnected(): boolean {
  return true;
}
