import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { readPublicEnv, type PublicEnv } from "../../lib/env";
import { getSupabaseClient } from "../../lib/supabase";

interface AuthContextValue {
  client: SupabaseClient | null;
  env: PublicEnv | null;
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  configurationError: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [env] = useState(() => readPublicEnv());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(env !== null);
  const client = useMemo(() => (env ? getSupabaseClient(env) : null), [env]);

  useEffect(() => {
    if (!client) return;
    let active = true;

    void client.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      client,
      env,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      loading,
      configurationError: env === null,
    }),
    [client, env, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth muss innerhalb AuthProvider laufen.");
  return context;
}
