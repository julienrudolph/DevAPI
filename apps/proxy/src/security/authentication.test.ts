import { describe, expect, it } from "vitest";

import { createServiceTokenAuthenticator } from "./authentication.js";

describe("proxy service authentication", () => {
  it("accepts only the configured bearer token", () => {
    const authenticate = createServiceTokenAuthenticator("expected-secret");
    expect(authenticate("Bearer expected-secret")).toBe(true);
    expect(authenticate("Bearer wrong-secret")).toBe(false);
    expect(authenticate(undefined)).toBe(false);
  });

  it("fails closed when no token is configured", () => {
    const authenticate = createServiceTokenAuthenticator(undefined);
    expect(authenticate("Bearer anything")).toBe(false);
  });
});
