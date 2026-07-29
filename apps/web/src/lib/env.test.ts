import { describe, expect, it } from "vitest";

import { readPublicEnv } from "./env";

describe("public auth configuration", () => {
  it("accepts Supabase auth without OIDC", () => {
    expect(
      readPublicEnv({
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toMatchObject({
      VITE_SUPABASE_URL: "https://project.supabase.co",
    });
  });

  it("accepts a custom OIDC provider", () => {
    expect(
      readPublicEnv({
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        VITE_OIDC_PROVIDER: "custom:company-oidc",
      }),
    ).toMatchObject({ VITE_OIDC_PROVIDER: "custom:company-oidc" });
  });

  it("rejects built-in or malformed provider identifiers", () => {
    expect(
      readPublicEnv({
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        VITE_OIDC_PROVIDER: "google",
      }),
    ).toBeNull();
  });
});
