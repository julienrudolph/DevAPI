import { describe, expect, it } from "vitest";

import { readApiConfig } from "./config.js";

describe("API configuration", () => {
  it("accepts public Supabase server configuration", () => {
    expect(
      readApiConfig({
        SUPABASE_URL: "https://project.supabase.co",
        PUBLIC_SUPABASE_URL: "https://devapi.example.test",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        PROXY_INTERNAL_URL: "http://proxy:3002",
        PROXY_INTERNAL_TOKEN: "a".repeat(32),
      }),
    ).toEqual({
      SUPABASE_URL: "https://project.supabase.co",
      PUBLIC_SUPABASE_URL: "https://devapi.example.test",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      PROXY_INTERNAL_URL: "http://proxy:3002",
      PROXY_INTERNAL_TOKEN: "a".repeat(32),
      OIDC_PROVIDER: undefined,
      OIDC_LABEL: undefined,
      PASSWORD_AUTH_ENABLED: true,
      PASSWORD_SIGNUP_ENABLED: true,
      MAGIC_LINK_AUTH_ENABLED: false,
      API_HOST: "127.0.0.1",
      API_PORT: 3001,
    });
  });

  it("fails closed without Supabase configuration", () => {
    expect(() => readApiConfig({})).toThrow("API-Konfiguration");
  });
});
