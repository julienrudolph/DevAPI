import { afterEach, describe, expect, it, vi } from "vitest";

import { acceptInvitation, createInvitation } from "./invitation-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("invitation API client", () => {
  it("creates an invitation using the authenticated team route", async () => {
    const teamId = "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "95da6097-0742-4164-9c9a-75dc64d2cd8f",
          teamId,
          role: "viewer",
          token: "a".repeat(64),
          expiresAt: "2026-08-05T12:00:00.000Z",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createInvitation(
      teamId,
      { role: "viewer" },
      "session-token",
    );

    expect(result.token).toHaveLength(64);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/teams/${teamId}/invitations`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
        }),
      }),
    );
  });

  it("accepts an invitation without putting its token into the URL", async () => {
    const teamId = "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b";
    const token = "a".repeat(64);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ teamId }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(acceptInvitation(token, "session-token")).resolves.toBe(teamId);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/invitations/accept",
      expect.objectContaining({
        body: JSON.stringify({ token }),
      }),
    );
  });
});
