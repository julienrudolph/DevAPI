import { createClient } from "@supabase/supabase-js";

export interface AuthenticatedUser {
  id: string;
  accessToken: string;
  email?: string;
}

export type Authenticator = (
  authorizationHeader: string | undefined,
) => Promise<AuthenticatedUser | null>;

export function createSupabaseAuthenticator(
  supabaseUrl: string,
  publishableKey: string,
): Authenticator {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return async (authorizationHeader) => {
    const token = extractBearerToken(authorizationHeader);
    if (!token) return null;

    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      accessToken: token,
      ...(data.user.email ? { email: data.user.email } : {}),
    };
  };
}

export function extractBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}
