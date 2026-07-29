import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { WorkspaceRepository } from "./domain/workspace-repository.js";

const user = {
  id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  accessToken: "verified-token",
};
const workspace = {
  id: "85e52968-22cc-483d-b6a6-bdc169e46ede",
  teamId: "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b",
  name: "Commerce API",
  role: "owner" as const,
};
const emptyWorkspaceRepository: WorkspaceRepository = {
  list: async () => [],
  getTree: async () => null,
  create: async () => workspace,
  createCollection: async () => null,
};

describe("workspace routes", () => {
  it("lists only repository-visible workspaces", async () => {
    const app = buildApp({
      authenticate: async () => user,
      requests: { update: async () => ({ kind: "not-found" }) },
      workspaces: {
        ...emptyWorkspaceRepository,
        list: async () => [workspace],
      },
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/workspaces",
      headers: { authorization: "Bearer verified-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([workspace]);
    await app.close();
  });

  it("returns 404 for a workspace hidden by RLS", async () => {
    const app = buildApp({
      authenticate: async () => user,
      requests: { update: async () => ({ kind: "not-found" }) },
      workspaces: {
        ...emptyWorkspaceRepository,
      },
    });
    const response = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${workspace.id}/tree`,
      headers: { authorization: "Bearer verified-token" },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("rejects workspace reads without authentication", async () => {
    const app = buildApp({
      authenticate: async () => null,
      requests: { update: async () => ({ kind: "not-found" }) },
      workspaces: {
        ...emptyWorkspaceRepository,
      },
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/workspaces",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("creates the first team workspace for an authenticated user", async () => {
    const app = buildApp({
      authenticate: async () => user,
      requests: { update: async () => ({ kind: "not-found" }) },
      workspaces: emptyWorkspaceRepository,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: { authorization: "Bearer verified-token" },
      payload: { teamName: "Platform", workspaceName: "Internal API" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(workspace);
    await app.close();
  });

  it("maps denied collection creation to 403", async () => {
    const app = buildApp({
      authenticate: async () => user,
      requests: { update: async () => ({ kind: "not-found" }) },
      workspaces: emptyWorkspaceRepository,
    });
    const response = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/collections`,
      headers: { authorization: "Bearer verified-token" },
      payload: { name: "Customers" },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
