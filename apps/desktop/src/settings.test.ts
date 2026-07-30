import { describe, expect, it } from "vitest";

import { validateServerUrl } from "./settings.js";

describe("validateServerUrl", () => {
  it("accepts HTTPS and removes paths with trailing slashes only", () => {
    expect(validateServerUrl("https://devapi.example.test/")).toBe(
      "https://devapi.example.test",
    );
  });

  it("rejects credentials and insecure remote servers", () => {
    expect(() => validateServerUrl("http://devapi.example.test")).toThrow(
      "HTTPS",
    );
    expect(() =>
      validateServerUrl("https://user:secret@devapi.example.test"),
    ).toThrow("Zugangsdaten");
  });

  it("allows HTTP localhost only in explicit development mode", () => {
    expect(
      validateServerUrl("http://localhost:8080", true),
    ).toBe("http://localhost:8080");
    expect(() => validateServerUrl("http://localhost:8080")).toThrow("HTTPS");
  });
});
