import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCollection,
  createFolder,
  createRequest,
  createWorkspace,
  fetchWorkspaces,
  fetchWorkspaceTree,
} from "./workspace-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workspace API client", () => {
  it("sends the Supabase session and validates workspace data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "85e52968-22cc-483d-b6a6-bdc169e46ede",
            teamId: "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b",
            name: "Commerce API",
            role: "owner",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWorkspaces("session-token");
    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/workspaces",
      expect.objectContaining({
        headers: { Authorization: "Bearer session-token" },
      }),
    );
  });

  it("rejects malformed tree responses at the network boundary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ workspaceId: "not-a-uuid" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(
      fetchWorkspaceTree(
        "85e52968-22cc-483d-b6a6-bdc169e46ede",
        "session-token",
      ),
    ).rejects.toThrow();
  });

  it("creates a team workspace with the authenticated session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "85e52968-22cc-483d-b6a6-bdc169e46ede",
          teamId: "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b",
          name: "Platform APIs",
          role: "owner",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createWorkspace(
      { teamName: "Platform", workspaceName: "Platform APIs" },
      "session-token",
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/workspaces", {
      method: "POST",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamName: "Platform",
        workspaceName: "Platform APIs",
      }),
    });
  });

  it("creates a versioned collection in the selected workspace", async () => {
    const workspaceId = "85e52968-22cc-483d-b6a6-bdc169e46ede";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "95da6097-0742-4164-9c9a-75dc64d2cd8f",
          workspaceId,
          name: "Customers",
          position: 0,
          version: 1,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCollection(
      workspaceId,
      { name: "Customers" },
      "session-token",
    );

    expect(result.version).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/workspaces/${workspaceId}/collections`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Customers" }),
      }),
    );
  });

  it("creates folders and requests through authenticated workspace routes", async () => {
    const workspaceId = "85e52968-22cc-483d-b6a6-bdc169e46ede";
    const collectionId = "95da6097-0742-4164-9c9a-75dc64d2cd8f";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "cc0814af-eeb4-45ad-8686-0784a67ea823",
            workspaceId,
            collectionId,
            parentFolderId: null,
            name: "Customers",
            position: 0,
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "fa7596b3-0041-4fe8-9ddf-956e7a107014",
            workspaceId,
            collectionId,
            folderId: null,
            name: "List customers",
            method: "GET",
            version: 1,
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createFolder(
      workspaceId,
      { collectionId, parentFolderId: null, name: "Customers" },
      "session-token",
    );
    await createRequest(
      workspaceId,
      {
        collectionId,
        folderId: null,
        name: "List customers",
        method: "GET",
        url: "https://",
      },
      "session-token",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/v1/workspaces/${workspaceId}/folders`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/v1/workspaces/${workspaceId}/requests`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});
