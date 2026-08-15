import { describe, expect, it } from "vitest";

import { isLikelyLocalTarget } from "./local-target-detection";

describe("isLikelyLocalTarget", () => {
  it.each([
    "http://localhost:3000/health",
    "http://myapp.local/health",
    "http://127.0.0.1:8080",
    "http://192.168.1.10:5000",
    "http://10.0.0.5",
    "http://[::1]:8080",
  ])("recognizes %s as a local target", (url) => {
    expect(isLikelyLocalTarget(url)).toBe(true);
  });

  it.each([
    "https://api.example.com",
    "https://1.1.1.1",
    "not a url",
  ])("does not treat %s as a local target", (url) => {
    expect(isLikelyLocalTarget(url)).toBe(false);
  });
});
