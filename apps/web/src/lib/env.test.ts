import { describe, expect, it, vi } from "vitest";

import { loadPublicConfig, readLegacyBuildConfig } from "./env";

describe("public client configuration", () => {
  it("loads and validates runtime configuration from the API", async () => {
    const fetchConfig = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          apiBaseUrl: "/api",
          supabaseUrl: "https://devapi.example.test",
          supabasePublishableKey: "sb_publishable_test",
          oidcProvider: "custom:company-oidc",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(loadPublicConfig(fetchConfig, {})).resolves.toMatchObject({
      supabaseUrl: "https://devapi.example.test",
      oidcProvider: "custom:company-oidc",
    });
    expect(fetchConfig).toHaveBeenCalledWith("/api/v1/config", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  it("uses legacy Vite values only as a development fallback", async () => {
    const fetchConfig = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));
    await expect(
      loadPublicConfig(fetchConfig, {
        VITE_SUPABASE_URL: "http://localhost:8000",
        VITE_SUPABASE_PUBLISHABLE_KEY: "local-anon-jwt",
        VITE_OIDC_PROVIDER: "",
      }),
    ).resolves.toEqual({
      apiBaseUrl: "/api",
      supabaseUrl: "http://localhost:8000",
      supabasePublishableKey: "local-anon-jwt",
      oidcProvider: undefined,
      oidcLabel: undefined,
    });
  });

  it("rejects malformed runtime and fallback configuration", async () => {
    const fetchConfig = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          supabaseUrl: "not-a-url",
          supabasePublishableKey: "key",
        }),
        { status: 200 },
      ),
    );
    await expect(loadPublicConfig(fetchConfig, {})).resolves.toBeNull();
    expect(
      readLegacyBuildConfig({
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "key",
        VITE_OIDC_PROVIDER: "google",
      }),
    ).toBeNull();
  });
});
