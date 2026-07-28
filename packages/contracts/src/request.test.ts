import { describe, expect, it } from "vitest";

import { canEdit, requestDraftSchema } from "./index.js";

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
});

describe("role permissions", () => {
  it("prevents viewers from editing", () => {
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit("editor")).toBe(true);
  });
});
