import { describe, expect, it } from "vitest";

import {
  apiRequestSchema,
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

describe("apiRequestSchema", () => {
  it("accepts PostgreSQL timestamps with a UTC offset", () => {
    const result = apiRequestSchema.safeParse({
      id: "cf62b918-dcbd-457c-9545-20b94f281994",
      workspaceId: "d9b5c57f-bb1e-4538-9bef-90f11d5bf3eb",
      collectionId: null,
      folderId: null,
      name: "getUser",
      method: "GET",
      url: "https://example.test/users",
      queryParams: [],
      headers: [],
      body: { type: "none" },
      version: 1,
      createdBy: "be96a6de-4128-4dee-bd20-88a02a7ef6ac",
      updatedBy: "be96a6de-4128-4dee-bd20-88a02a7ef6ac",
      createdAt: "2026-07-30T07:30:00.000000+00:00",
      updatedAt: "2026-07-30T07:30:00.000000+00:00",
    });

    expect(result.success).toBe(true);
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
