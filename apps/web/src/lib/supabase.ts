import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { PublicClientConfig } from "@api-client/contracts";

let client: SupabaseClient | undefined;

export function getSupabaseClient(config: PublicClientConfig): SupabaseClient {
  client ??= createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
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
