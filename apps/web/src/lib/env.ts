import {
  publicClientConfigSchema,
  type PublicClientConfig,
} from "@api-client/contracts";

const legacyBuildConfigSchema = publicClientConfigSchema.transform(
  (config) => config,
);

export async function loadPublicConfig(
  fetchConfig: typeof fetch = fetch,
  buildEnv: Record<string, unknown> = import.meta.env,
): Promise<PublicClientConfig | null> {
  try {
    const response = await fetchConfig("/api/v1/config", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const parsed = publicClientConfigSchema.safeParse(await response.json());
      if (parsed.success) return parsed.data;
    }
  } catch {
    // Der lokale Vite-Betrieb darf auf seine öffentlichen Build-Werte
    // zurückfallen. Produktionscontainer liefern die Konfiguration per API.
  }
  return readLegacyBuildConfig(buildEnv);
}

export function readLegacyBuildConfig(
  source: Record<string, unknown> = import.meta.env,
): PublicClientConfig | null {
  const result = legacyBuildConfigSchema.safeParse({
    apiBaseUrl: "/api",
    supabaseUrl: source.VITE_SUPABASE_URL,
    supabasePublishableKey: source.VITE_SUPABASE_PUBLISHABLE_KEY,
    oidcProvider: emptyStringToUndefined(source.VITE_OIDC_PROVIDER),
    oidcLabel: emptyStringToUndefined(source.VITE_OIDC_LABEL),
  });
  return result.success ? result.data : null;
}

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === ""
    ? undefined
    : value;
}
