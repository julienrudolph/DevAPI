import { describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import type { ExecutionHistoryRepository } from "./domain/execution-history-repository.js";
import type { RequestRepository } from "./domain/request-repository.js";
import type { WorkspaceRepository } from "./domain/workspace-repository.js";

const user = {
  id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  accessToken: "verified-token",
};
const requestId = "fa7596b3-0041-4fe8-9ddf-956e7a107014";
const workspaceId = "85e52968-22cc-483d-b6a6-bdc169e46ede";
const persistedRequest = {
  id: requestId,
  workspaceId,
  collectionId: null,
  folderId: null,
  name: "Health",
  method: "GET" as const,
  url: "https://api.example.com/health",
  queryParams: [],
  headers: [],
  body: { type: "none" as const },
  assertions: [],
  version: 1,
  createdBy: user.id,
  updatedBy: user.id,
  createdAt: "2026-07-30T08:00:00.000Z",
  updatedAt: "2026-07-30T08:00:00.000Z",
};
const requests: RequestRepository = {
  find: async () => persistedRequest,
  update: async () => ({ kind: "not-found" }),
};
const workspaces: WorkspaceRepository = {
  list: async () => [],
  getTree: async () => null,
  create: async () => {
    throw new Error("not used");
  },
  createCollection: async () => null,
  createFolder: async () => null,
  createRequest: async () => null,
};

describe("execution history routes", () => {
  it("records only execution metadata after a visible request succeeds", async () => {
    const record = vi.fn<ExecutionHistoryRepository["record"]>();
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
      executor: {
        execute: async () => ({
          status: 200,
          statusText: "OK",
          headers: { authorization: "must not be persisted" },
          body: "sensitive response",
          durationMs: 18,
        }),
      },
      executionHistory: {
        record,
        list: async () => [],
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { authorization: "Bearer verified-token" },
      payload: {
        requestId,
        method: "GET",
        url: "https://api.example.com/health?token=secret",
        headers: [
          {
            id: crypto.randomUUID(),
            key: "Authorization",
            value: "Bearer secret",
            enabled: true,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(record).toHaveBeenCalledWith({
      requestId,
      method: "GET",
      statusCode: 200,
      durationMs: 18,
      successful: true,
      userId: user.id,
      accessToken: user.accessToken,
    });
    expect(JSON.stringify(record.mock.calls)).not.toContain("secret");
    await app.close();
  });

  it("lists bounded metadata supplied by the membership-backed repository", async () => {
    const execution = {
      id: "2a20ff6e-a6de-421e-bedd-01ef3a87c539",
      requestId,
      requestName: "Health",
      method: "GET" as const,
      statusCode: 200,
      durationMs: 18,
      successful: true,
      executedBy: { id: user.id, displayName: "Ada" },
      executedAt: "2026-07-30T09:00:00.000Z",
    };
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
      executionHistory: {
        record: async () => undefined,
        list: async () => [execution],
      },
    });
    const response = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${workspaceId}/executions`,
      headers: { authorization: "Bearer verified-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([execution]);
    await app.close();
  });

  it("does not execute a request hidden by RLS", async () => {
    const execute = vi.fn();
    const app = buildApp({
      authenticate: async () => user,
      requests: { ...requests, find: async () => null },
      workspaces,
      executor: { execute },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { authorization: "Bearer verified-token" },
      payload: {
        requestId,
        method: "GET",
        url: "https://api.example.com",
        headers: [],
      },
    });
    expect(response.statusCode).toBe(404);
    expect(execute).not.toHaveBeenCalled();
    await app.close();
  });
});
