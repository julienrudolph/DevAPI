import { describe, expect, it } from "vitest";

import { readApiConfig } from "./config.js";

describe("API configuration", () => {
  it("accepts public Supabase server configuration", () => {
    expect(
      readApiConfig({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toEqual({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      API_PORT: 3001,
    });
  });

  it("fails closed without Supabase configuration", () => {
    expect(() => readApiConfig({})).toThrow("API-Konfiguration");
  });
});
