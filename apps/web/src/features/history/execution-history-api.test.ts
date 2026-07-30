import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchExecutionHistory } from "./execution-history-api";

afterEach(() => vi.unstubAllGlobals());

describe("execution history API", () => {
  it("loads validated metadata with the authenticated session", async () => {
    const workspaceId = "85e52968-22cc-483d-b6a6-bdc169e46ede";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "2a20ff6e-a6de-421e-bedd-01ef3a87c539",
            requestId: "fa7596b3-0041-4fe8-9ddf-956e7a107014",
            requestName: "Health",
            method: "GET",
            statusCode: 200,
            durationMs: 18,
            successful: true,
            executedBy: {
              id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
              displayName: "Ada",
            },
            executedAt: "2026-07-30T09:00:00.000Z",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchExecutionHistory(workspaceId, "session-token"),
    ).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/workspaces/${workspaceId}/executions`,
      { headers: { Authorization: "Bearer session-token" } },
    );
  });
});
