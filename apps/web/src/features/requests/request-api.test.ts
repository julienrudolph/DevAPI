import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchRequest,
  RequestConflictError,
  updateRequest,
} from "./request-api";

const request = {
  id: "fa7596b3-0041-4fe8-9ddf-956e7a107014",
  workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
  collectionId: "95da6097-0742-4164-9c9a-75dc64d2cd8f",
  folderId: null,
  name: "List customers",
  method: "GET",
  url: "https://api.example.com/customers",
  queryParams: [],
  headers: [],
  body: { type: "none" },
  version: 2,
  createdBy: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  updatedBy: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T13:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("request API client", () => {
  it("loads and validates a persisted request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(request), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRequest(request.id, "session-token")).resolves.toEqual(
      request,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/requests/${request.id}`,
      expect.objectContaining({
        headers: { Authorization: "Bearer session-token" },
      }),
    );
  });

  it("maps HTTP 409 to a typed conflict containing the current version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "REQUEST_VERSION_CONFLICT",
            message: "Der Request wurde zwischenzeitlich geändert.",
            expectedVersion: 2,
            currentVersion: 3,
            current: { ...request, version: 3 },
            updatedBy: {
              id: request.updatedBy,
              displayName: "Teammitglied",
            },
            updatedAt: request.updatedAt,
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const promise = updateRequest(
      request.id,
      {
        name: request.name,
        method: "GET",
        url: request.url,
        queryParams: [],
        headers: [],
        body: { type: "none" },
        expectedVersion: 2,
      },
      "session-token",
    );
    await expect(promise).rejects.toBeInstanceOf(RequestConflictError);
  });
});
