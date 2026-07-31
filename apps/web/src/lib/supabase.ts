import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { PublicClientConfig } from "@api-client/contracts";

let client: SupabaseClient | undefined;

export function getSupabaseClient(config: PublicClientConfig): SupabaseClient {
  const desktop = window.devapiDesktop;
  client ??= createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        flowType: "pkce",
        storage: desktop?.sessionStorage,
        detectSessionInUrl: !desktop,
      },
    },
  );
  return client;
}
