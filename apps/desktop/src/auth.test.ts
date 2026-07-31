import { describe, expect, it } from "vitest";

import { parseAuthCallback, validateAuthStartUrl } from "./auth.js";

describe("parseAuthCallback", () => {
  it("accepts only the dedicated authentication callback", () => {
    expect(parseAuthCallback("devapi://auth/callback?code=abc")).toBe(
      "devapi://auth/callback?code=abc",
    );
    expect(parseAuthCallback("devapi://other/callback?code=abc")).toBeUndefined();
    expect(parseAuthCallback("https://auth/callback?code=abc")).toBeUndefined();
  });
});

describe("validateAuthStartUrl", () => {
  it("accepts the configured server authorization endpoint", () => {
    expect(
      validateAuthStartUrl(
        "https://devapi.example.test/auth/v1/authorize?provider=custom:oidc",
        "https://devapi.example.test",
      ),
    ).toContain("/auth/v1/authorize");
  });

  it("rejects foreign origins and unrelated server paths", () => {
    expect(() =>
      validateAuthStartUrl(
        "https://identity.example.test/authorize",
        "https://devapi.example.test",
      ),
    ).toThrow("AUTH_URL_INVALID");
    expect(() =>
      validateAuthStartUrl(
        "https://devapi.example.test/api/v1/config",
        "https://devapi.example.test",
      ),
    ).toThrow("AUTH_URL_INVALID");
  });
});
