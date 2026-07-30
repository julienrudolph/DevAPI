import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestConflictError } from "../requests/request-api";
import {
  fetchRequestRevisions,
  restoreRequestRevision,
} from "./revision-api";

afterEach(() => vi.unstubAllGlobals());

describe("revision API", () => {
  const requestId = "fa7596b3-0041-4fe8-9ddf-956e7a107014";
  const revisionId = "2a20ff6e-a6de-421e-bedd-01ef3a87c539";

  it("loads revision metadata with the authenticated session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: revisionId,
            requestId,
            version: 2,
            name: "Health",
            method: "GET",
            changeType: "update",
            createdBy: {
              id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
              displayName: "Ada",
            },
            createdAt: "2026-07-30T09:00:00.000Z",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchRequestRevisions(requestId, "session-token"),
    ).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/requests/${requestId}/revisions`,
      { headers: { Authorization: "Bearer session-token" } },
    );
  });

  it("maps stale restores to the shared conflict error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "REQUEST_VERSION_CONFLICT",
            message: "Konflikt",
            expectedVersion: 3,
            currentVersion: 4,
            current: {
              id: requestId,
              workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
              collectionId: null,
              folderId: null,
              name: "Health",
              method: "GET",
              url: "https://api.example.com",
              queryParams: [],
              headers: [],
              body: { type: "none" },
              version: 4,
              createdBy: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
              updatedBy: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
              createdAt: "2026-07-30T08:00:00.000Z",
              updatedAt: "2026-07-30T10:00:00.000Z",
            },
            updatedBy: {
              id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
              displayName: "Ada",
            },
            updatedAt: "2026-07-30T10:00:00.000Z",
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    await expect(
      restoreRequestRevision(
        requestId,
        { revisionId, expectedVersion: 3 },
        "session-token",
      ),
    ).rejects.toBeInstanceOf(RequestConflictError);
  });
});
