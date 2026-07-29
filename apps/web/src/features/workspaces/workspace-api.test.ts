import { afterEach, describe, expect, it, vi } from "vitest";

import {
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
});
