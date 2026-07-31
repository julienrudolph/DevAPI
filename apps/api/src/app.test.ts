import type { ApiRequest, RequestDraft } from "@api-client/contracts";
import { describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import type { RequestRepository } from "./domain/request-repository.js";
import type { WorkspaceRepository } from "./domain/workspace-repository.js";

const requestId = "3ac6a7df-5e80-427d-a6e4-d48427ac924d";
const userId = "4776ac0f-28ba-474a-ad0d-d566be4199e8";
const draft: RequestDraft = {
  name: "List customers",
  method: "GET",
  url: "https://api.example.test/customers",
  queryParams: [],
  headers: [],
  body: { type: "none" },
};
const updated: ApiRequest = {
  ...draft,
  id: requestId,
  workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
  collectionId: null,
  folderId: null,
  version: 3,
  createdBy: userId,
  updatedBy: userId,
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T13:00:00.000Z",
};

const repository: RequestRepository = {
  find: async () => updated,
  update: async () => ({ kind: "updated", request: updated }),
};
const workspaceRepository: WorkspaceRepository = {
  list: async () => [],
  getTree: async () => null,
  create: async () => {
    throw new Error("not used");
  },
  createCollection: async () => null,
  createFolder: async () => null,
  createRequest: async () => null,
};

describe("request API authentication", () => {
  it("serves only validated public client configuration", async () => {
    const app = buildApp({
      authenticate: async () => null,
      requests: repository,
      workspaces: workspaceRepository,
      publicConfig: {
        apiBaseUrl: "/api",
        supabaseUrl: "https://project.supabase.co",
        supabasePublishableKey: "sb_publishable_test",
        passwordAuthEnabled: true,
        passwordSignupEnabled: true,
        magicLinkAuthEnabled: false,
      },
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/config",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({
      apiBaseUrl: "/api",
      supabaseUrl: "https://project.supabase.co",
      supabasePublishableKey: "sb_publishable_test",
      passwordAuthEnabled: true,
      passwordSignupEnabled: true,
      magicLinkAuthEnabled: false,
    });
    await app.close();
  });

  it("executes requests only after validating the user session", async () => {
    const app = buildApp({
      authenticate: async () => ({
        id: userId,
        accessToken: "verified-token",
      }),
      requests: repository,
      workspaces: workspaceRepository,
      executor: {
        execute: async () => ({
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
          body: '{"ok":true}',
          durationMs: 18,
        }),
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { authorization: "Bearer verified-token" },
      payload: {
        requestId,
        method: "GET",
        url: "https://api.example.com/health",
        headers: [],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 200, durationMs: 18 });
    await app.close();
  });

  it("rejects rate-limited executions before reaching the proxy", async () => {
    const execute = vi.fn();
    const app = buildApp({
      authenticate: async () => ({
        id: userId,
        accessToken: "verified-token",
      }),
      requests: repository,
      workspaces: workspaceRepository,
      executor: { execute },
      executionLimiter: {
        acquire: () => ({
          kind: "rejected",
          reason: "rate",
          retryAfterMs: 2_500,
        }),
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { authorization: "Bearer verified-token" },
      payload: {
        requestId,
        method: "GET",
        url: "https://api.example.com/health",
        headers: [],
      },
    });
    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("3");
    expect(response.json()).toMatchObject({
      code: "EXECUTION_RATE_LIMITED",
      retryAfterSeconds: 3,
    });
    expect(execute).not.toHaveBeenCalled();
    await app.close();
  });

  it("releases concurrency capacity after proxy failures", async () => {
    const release = vi.fn();
    const app = buildApp({
      authenticate: async () => ({
        id: userId,
        accessToken: "verified-token",
      }),
      requests: repository,
      workspaces: workspaceRepository,
      executor: {
        execute: async () => {
          throw new Error("upstream failed");
        },
      },
      executionLimiter: {
        acquire: () => ({ kind: "accepted", release }),
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { authorization: "Bearer verified-token" },
      payload: {
        requestId,
        method: "GET",
        url: "https://api.example.com/health",
        headers: [],
      },
    });
    expect(response.statusCode).toBe(502);
    expect(release).toHaveBeenCalledOnce();
    await app.close();
  });

  it("loads a visible request through the verified session", async () => {
    const app = buildApp({
      authenticate: async () => ({
        id: userId,
        accessToken: "verified-token",
      }),
      requests: repository,
      workspaces: workspaceRepository,
    });
    const response = await app.inject({
      method: "GET",
      url: `/v1/requests/${requestId}`,
      headers: { authorization: "Bearer verified-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(updated);
    await app.close();
  });

  it("rejects missing or invalid sessions", async () => {
    const app = buildApp({
      authenticate: async () => null,
      requests: repository,
      workspaces: workspaceRepository,
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/requests/${requestId}`,
      payload: { ...draft, expectedVersion: 2 },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("uses the verified identity and access token for persistence", async () => {
    let receivedUserId: string | undefined;
    let receivedToken: string | undefined;
    const app = buildApp({
      authenticate: async () => ({
        id: userId,
        accessToken: "verified-token",
      }),
      requests: {
        find: async () => updated,
        update: async (command) => {
          receivedUserId = command.userId;
          receivedToken = command.accessToken;
          return { kind: "updated", request: updated };
        },
      },
      workspaces: workspaceRepository,
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/requests/${requestId}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { ...draft, expectedVersion: 2 },
    });
    expect(response.statusCode).toBe(200);
    expect(receivedUserId).toBe(userId);
    expect(receivedToken).toBe("verified-token");
    await app.close();
  });

  it("does not trust former demo identity headers", async () => {
    const app = buildApp({
      authenticate: async () => null,
      requests: repository,
      workspaces: workspaceRepository,
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/requests/${requestId}`,
      headers: {
        "x-demo-user-id": userId,
        "x-demo-role": "owner",
      },
      payload: { ...draft, expectedVersion: 2 },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("does not expose authentication provider errors", async () => {
    const app = buildApp({
      authenticate: async () => {
        throw new Error("sensitive upstream detail");
      },
      requests: repository,
      workspaces: workspaceRepository,
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/requests/${requestId}`,
      headers: { authorization: "Bearer token" },
      payload: { ...draft, expectedVersion: 2 },
    });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("sensitive");
    await app.close();
  });

  it.each([
    ["forbidden", 403],
    ["not-found", 404],
  ] as const)("maps repository result %s to HTTP %s", async (kind, status) => {
    const app = buildApp({
      authenticate: async () => ({
        id: userId,
        accessToken: "verified-token",
      }),
      requests: {
        find: async () => updated,
        update: async () => ({ kind }),
      },
      workspaces: workspaceRepository,
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/requests/${requestId}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { ...draft, expectedVersion: 2 },
    });
    expect(response.statusCode).toBe(status);
    await app.close();
  });

  it("soft-deletes only the expected request version", async () => {
    let expectedVersion: number | undefined;
    const app = buildApp({
      authenticate: async () => ({
        id: userId,
        accessToken: "verified-token",
      }),
      requests: {
        find: async () => updated,
        update: async () => ({ kind: "updated", request: updated }),
        remove: async (command) => {
          expectedVersion = command.expectedVersion;
          return { kind: "updated", request: updated };
        },
      },
      workspaces: workspaceRepository,
    });
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/requests/${requestId}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { expectedVersion: 3 },
    });
    expect(response.statusCode).toBe(204);
    expect(expectedVersion).toBe(3);
    await app.close();
  });

  it("returns the current request when deletion detects a conflict", async () => {
    const app = buildApp({
      authenticate: async () => ({
        id: userId,
        accessToken: "verified-token",
      }),
      requests: {
        find: async () => updated,
        update: async () => ({ kind: "updated", request: updated }),
        remove: async () => ({
          kind: "conflict",
          conflict: {
            code: "REQUEST_VERSION_CONFLICT",
            message: "Der Request wurde zwischenzeitlich geändert.",
            expectedVersion: 2,
            currentVersion: 3,
            current: updated,
            updatedBy: {
              id: updated.updatedBy,
              displayName: "Teammitglied",
            },
            updatedAt: updated.updatedAt,
          },
        }),
      },
      workspaces: workspaceRepository,
    });
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/requests/${requestId}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { expectedVersion: 2 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "REQUEST_VERSION_CONFLICT",
      currentVersion: 3,
    });
    await app.close();
  });
});
