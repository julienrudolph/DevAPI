import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { RequestRepository } from "./domain/request-repository.js";
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
  createFolder: async () => null,
  createRequest: async () => null,
};
const requestRepository: RequestRepository = {
  find: async () => null,
  update: async () => ({ kind: "not-found" }),
};

describe("workspace routes", () => {
  it("lists only repository-visible workspaces", async () => {
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
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
      requests: requestRepository,
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
      requests: requestRepository,
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
      requests: requestRepository,
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

  it("creates another workspace in an existing team", async () => {
    let receivedTeamId: string | undefined;
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
      workspaces: {
        ...emptyWorkspaceRepository,
        create: async (command) => {
          receivedTeamId = "teamId" in command ? command.teamId : undefined;
          return workspace;
        },
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: { authorization: "Bearer verified-token" },
      payload: {
        teamId: workspace.teamId,
        workspaceName: "Internal API",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(receivedTeamId).toBe(workspace.teamId);
    await app.close();
  });

  it("maps denied workspace creation to 403", async () => {
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
      workspaces: {
        ...emptyWorkspaceRepository,
        create: async () => null,
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: { authorization: "Bearer verified-token" },
      payload: {
        teamId: workspace.teamId,
        workspaceName: "Forbidden",
      },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("maps denied collection creation to 403", async () => {
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
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

  it("creates a folder inside an editable collection", async () => {
    const collectionId = "95da6097-0742-4164-9c9a-75dc64d2cd8f";
    const folder = {
      id: "cc0814af-eeb4-45ad-8686-0784a67ea823",
      workspaceId: workspace.id,
      collectionId,
      parentFolderId: null,
      name: "Customers",
      position: 0,
      version: 1,
    };
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
      workspaces: {
        ...emptyWorkspaceRepository,
        createFolder: async () => folder,
      },
    });
    const response = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/folders`,
      headers: { authorization: "Bearer verified-token" },
      payload: { collectionId, name: "Customers" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(folder);
    await app.close();
  });

  it("creates a request with safe defaults", async () => {
    const collectionId = "95da6097-0742-4164-9c9a-75dc64d2cd8f";
    const createdRequest = {
      id: "fa7596b3-0041-4fe8-9ddf-956e7a107014",
      workspaceId: workspace.id,
      collectionId,
      folderId: null,
      name: "List customers",
      method: "GET" as const,
      url: "https://",
      version: 1,
    };
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
      workspaces: {
        ...emptyWorkspaceRepository,
        createRequest: async (command) => {
          expect(command.method).toBe("GET");
          expect(command.url).toBe("https://");
          return createdRequest;
        },
      },
    });
    const response = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/requests`,
      headers: { authorization: "Bearer verified-token" },
      payload: { collectionId, name: "List customers" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(createdRequest);
    await app.close();
  });

  it("deletes an empty collection with optimistic locking", async () => {
    const collectionId = "95da6097-0742-4164-9c9a-75dc64d2cd8f";
    let receivedVersion: number | undefined;
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
      workspaces: {
        ...emptyWorkspaceRepository,
        deleteCollection: async (command) => {
          receivedVersion = command.expectedVersion;
          return { kind: "deleted" };
        },
      },
    });
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/collections/${collectionId}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { expectedVersion: 2 },
    });
    expect(response.statusCode).toBe(204);
    expect(receivedVersion).toBe(2);
    await app.close();
  });

  it("explains why a non-empty folder cannot be deleted", async () => {
    const folderId = "cc0814af-eeb4-45ad-8686-0784a67ea823";
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
      workspaces: {
        ...emptyWorkspaceRepository,
        deleteFolder: async () => ({ kind: "not-empty" }),
      },
    });
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/folders/${folderId}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { expectedVersion: 1 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "FOLDER_NOT_EMPTY",
      message: "Der Ordner enthält noch Requests oder Unterordner.",
    });
    await app.close();
  });

  it("renames a collection through the versioned repository operation", async () => {
    const collectionId = "95da6097-0742-4164-9c9a-75dc64d2cd8f";
    const renamed = {
      id: collectionId,
      workspaceId: workspace.id,
      name: "Renamed",
      position: 0,
      version: 2,
    };
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
      workspaces: {
        ...emptyWorkspaceRepository,
        updateCollection: async (command) => {
          expect(command).toMatchObject({
            itemId: collectionId,
            expectedVersion: 1,
            name: "Renamed",
          });
          return { kind: "updated", item: renamed };
        },
      },
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/collections/${collectionId}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { expectedVersion: 1, name: "Renamed" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(renamed);
    await app.close();
  });

  it("maps stale folder reordering to HTTP 409", async () => {
    const folderId = "cc0814af-eeb4-45ad-8686-0784a67ea823";
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
      workspaces: {
        ...emptyWorkspaceRepository,
        updateFolder: async () => ({ kind: "conflict" }),
      },
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/folders/${folderId}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { expectedVersion: 1, targetPosition: 0 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "FOLDER_VERSION_CONFLICT",
    });
    await app.close();
  });

  it("returns only environments supplied by the RLS-backed repository", async () => {
    const environment = {
      id: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
      workspaceId: workspace.id,
      name: "Development",
      version: 1,
      variables: [],
    };
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
      workspaces: emptyWorkspaceRepository,
      environments: {
        list: async () => [environment],
        create: async () => null,
        createVariable: async () => ({ kind: "forbidden" }),
        updateVariable: async () => ({ kind: "forbidden" }),
      },
    });
    const response = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${workspace.id}/environments`,
      headers: { authorization: "Bearer verified-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([environment]);
    await app.close();
  });

  it("maps stale environment variable writes to HTTP 409", async () => {
    const variable = {
      id: "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8",
      environmentId: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
      key: "baseUrl",
      value: "https://new.example.com",
      scope: "shared" as const,
      version: 2,
    };
    const app = buildApp({
      authenticate: async () => user,
      requests: requestRepository,
      workspaces: emptyWorkspaceRepository,
      environments: {
        list: async () => [],
        create: async () => null,
        createVariable: async () => ({ kind: "forbidden" }),
        updateVariable: async () => ({
          kind: "conflict",
          current: variable,
        }),
      },
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/environment-variables/${variable.id}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { value: "https://local.example.com", expectedVersion: 1 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      currentVersion: 2,
      current: variable,
    });
    await app.close();
  });
});
