import { describe, expect, it } from "vitest";

import { publicClientConfigSchema } from "./client-config.js";

describe("publicClientConfigSchema", () => {
  it("accepts public runtime values without server secrets", () => {
    expect(
      publicClientConfigSchema.parse({
        supabaseUrl: "https://project.supabase.co",
        supabasePublishableKey: "sb_publishable_test",
        oidcProvider: "custom:company-oidc",
      }),
    ).toEqual({
      apiBaseUrl: "/api",
      supabaseUrl: "https://project.supabase.co",
      supabasePublishableKey: "sb_publishable_test",
      oidcProvider: "custom:company-oidc",
    });
  });

  it("rejects secrets and malformed providers at the contract boundary", () => {
    expect(
      publicClientConfigSchema.safeParse({
        supabaseUrl: "https://project.supabase.co",
        supabasePublishableKey: "key",
        oidcProvider: "google",
      }).success,
    ).toBe(false);
  });
});
