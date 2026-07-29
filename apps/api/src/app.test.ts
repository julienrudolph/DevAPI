import type { ApiRequest, RequestDraft } from "@api-client/contracts";
import { describe, expect, it } from "vitest";

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
        method: "GET",
        url: "https://api.example.com/health",
        headers: [],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 200, durationMs: 18 });
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
});
