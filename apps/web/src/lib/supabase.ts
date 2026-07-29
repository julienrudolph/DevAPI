import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { PublicEnv } from "./env";

let client: SupabaseClient | undefined;

export function getSupabaseClient(env: PublicEnv): SupabaseClient {
  client ??= createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        flowType: "pkce",
      },
    },
  );
  return client;
}
