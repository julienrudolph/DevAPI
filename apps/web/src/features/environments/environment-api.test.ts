import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEnvironmentVariable,
  fetchEnvironments,
} from "./environment-api";

afterEach(() => vi.unstubAllGlobals());

describe("environment API client", () => {
  it("validates RLS-filtered environments at the network boundary", async () => {
    const workspaceId = "85e52968-22cc-483d-b6a6-bdc169e46ede";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
              workspaceId,
              name: "Development",
              version: 1,
              variables: [],
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(
      fetchEnvironments(workspaceId, "session-token"),
    ).resolves.toHaveLength(1);
  });

  it("marks personal values explicitly in the write request", async () => {
    const environmentId = "a768f717-d11f-4ce0-a72b-8e1d439222b0";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8",
          environmentId,
          key: "token",
          value: "personal-secret",
          scope: "personal",
          version: 1,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createEnvironmentVariable(
      environmentId,
      { key: "token", value: "personal-secret", scope: "personal" },
      "session-token",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/environments/${environmentId}/variables`,
      expect.objectContaining({
        body: JSON.stringify({
          key: "token",
          value: "personal-secret",
          scope: "personal",
        }),
      }),
    );
  });
});
