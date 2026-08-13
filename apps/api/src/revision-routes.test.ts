import type {
  ApiRequest,
  RequestConflict,
  RequestRevision,
} from "@api-client/contracts";
import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { RequestRepository } from "./domain/request-repository.js";
import type { WorkspaceRepository } from "./domain/workspace-repository.js";

const user = {
  id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  accessToken: "verified-token",
};
const requestId = "fa7596b3-0041-4fe8-9ddf-956e7a107014";
const revisionId = "2a20ff6e-a6de-421e-bedd-01ef3a87c539";
const request: ApiRequest = {
  id: requestId,
  workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
  collectionId: null,
  folderId: null,
  name: "Health",
  method: "GET",
  url: "https://api.example.com/health",
  queryParams: [],
  headers: [],
  body: { type: "none" },
  assertions: [],
  version: 4,
  createdBy: user.id,
  updatedBy: user.id,
  createdAt: "2026-07-30T08:00:00.000Z",
  updatedAt: "2026-07-30T10:00:00.000Z",
};
const revision: RequestRevision = {
  id: revisionId,
  requestId,
  version: 2,
  name: "Old health",
  method: "GET",
  changeType: "update",
  createdBy: { id: user.id, displayName: "Ada" },
  createdAt: "2026-07-30T09:00:00.000Z",
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

describe("revision routes", () => {
  it("lists metadata supplied by the RLS-backed repository", async () => {
    const requests: RequestRepository = {
      find: async () => request,
      listRevisions: async () => [revision],
      update: async () => ({ kind: "not-found" }),
    };
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
    });
    const response = await app.inject({
      method: "GET",
      url: `/v1/requests/${requestId}/revisions`,
      headers: { authorization: "Bearer verified-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([revision]);
    expect(response.body).not.toContain("snapshot");
    await app.close();
  });

  it("restores against the expected current version", async () => {
    let received: unknown;
    const requests: RequestRepository = {
      find: async () => request,
      restore: async (command) => {
        received = command;
        return { kind: "updated", request: { ...request, version: 5 } };
      },
      update: async () => ({ kind: "not-found" }),
    };
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
    });
    const response = await app.inject({
      method: "POST",
      url: `/v1/requests/${requestId}/restore`,
      headers: { authorization: "Bearer verified-token" },
      payload: { revisionId, expectedVersion: 4 },
    });
    expect(response.statusCode).toBe(200);
    expect(received).toMatchObject({
      requestId,
      revisionId,
      expectedVersion: 4,
      userId: user.id,
      accessToken: user.accessToken,
    });
    await app.close();
  });

  it("returns the standard conflict contract for a stale restore", async () => {
    const conflict: RequestConflict = {
      code: "REQUEST_VERSION_CONFLICT",
      message: "Der Request wurde zwischenzeitlich geändert.",
      expectedVersion: 3,
      currentVersion: 4,
      current: request,
      updatedBy: { id: user.id, displayName: "Teammitglied" },
      updatedAt: request.updatedAt,
    };
    const requests: RequestRepository = {
      find: async () => request,
      restore: async () => ({ kind: "conflict", conflict }),
      update: async () => ({ kind: "not-found" }),
    };
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
    });
    const response = await app.inject({
      method: "POST",
      url: `/v1/requests/${requestId}/restore`,
      headers: { authorization: "Bearer verified-token" },
      payload: { revisionId, expectedVersion: 3 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(conflict);
    await app.close();
  });
});
