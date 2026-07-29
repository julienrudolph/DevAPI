import { describe, expect, it } from "vitest";

import { readApiConfig } from "./config.js";

describe("API configuration", () => {
  it("accepts public Supabase server configuration", () => {
    expect(
      readApiConfig({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        PROXY_INTERNAL_URL: "http://proxy:3002",
        PROXY_INTERNAL_TOKEN: "a".repeat(32),
      }),
    ).toEqual({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      PROXY_INTERNAL_URL: "http://proxy:3002",
      PROXY_INTERNAL_TOKEN: "a".repeat(32),
      API_PORT: 3001,
    });
  });

  it("fails closed without Supabase configuration", () => {
    expect(() => readApiConfig({})).toThrow("API-Konfiguration");
  });
});
