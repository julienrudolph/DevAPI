import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { PublicClientConfig } from "@api-client/contracts";

import { loadPublicConfig } from "../../lib/env";
import { getSupabaseClient } from "../../lib/supabase";

interface AuthContextValue {
  client: SupabaseClient | null;
  env: PublicClientConfig | null;
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  configurationError: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [env, setEnv] = useState<PublicClientConfig | null>();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const client = useMemo(() => (env ? getSupabaseClient(env) : null), [env]);

  useEffect(() => {
    let active = true;
    void loadPublicConfig().then((config) => {
      if (active) setEnv(config);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!client) return;
    let active = true;
    setSessionLoading(true);

    void client.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setSessionLoading(false);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      client,
      env: env ?? null,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      loading: env === undefined || sessionLoading,
      configurationError: env === null,
    }),
    [client, env, session, sessionLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth muss innerhalb AuthProvider laufen.");
  return context;
}
