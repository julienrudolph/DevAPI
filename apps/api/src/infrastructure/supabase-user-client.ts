import { createClient } from "@supabase/supabase-js";

export function createUserSupabaseClient(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
) {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
