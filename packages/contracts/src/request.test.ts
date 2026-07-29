import { describe, expect, it } from "vitest";

import {
  canEdit,
  requestAuthSchema,
  requestDraftSchema,
} from "./index.js";

describe("requestDraftSchema", () => {
  it("accepts a minimal REST request", () => {
    const result = requestDraftSchema.safeParse({
      name: "List users",
      method: "GET",
      url: "{{baseUrl}}/users",
      queryParams: [],
      headers: [],
      body: { type: "none" },
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported methods", () => {
    const result = requestDraftSchema.safeParse({
      name: "Connect",
      method: "CONNECT",
      url: "https://example.test",
      queryParams: [],
      headers: [],
      body: { type: "none" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed JSON bodies before persistence or execution", () => {
    const result = requestDraftSchema.safeParse({
      name: "Create user",
      method: "POST",
      url: "https://example.test/users",
      queryParams: [],
      headers: [],
      body: { type: "json", content: '{"name":' },
    });

    expect(result.success).toBe(false);
  });
});

describe("requestAuthSchema", () => {
  it("validates local Basic and Bearer credentials without adding them to drafts", () => {
    expect(
      requestAuthSchema.safeParse({
        type: "bearer",
        token: "token",
      }).success,
    ).toBe(true);
    expect(
      requestAuthSchema.safeParse({
        type: "basic",
        username: "user",
        password: "password",
      }).success,
    ).toBe(true);
    expect("auth" in requestDraftSchema.parse({
      name: "Health",
      method: "GET",
      url: "https://example.test",
      queryParams: [],
      headers: [],
      body: { type: "none" },
    })).toBe(false);
  });
});

describe("role permissions", () => {
  it("prevents viewers from editing", () => {
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit("editor")).toBe(true);
  });
});
