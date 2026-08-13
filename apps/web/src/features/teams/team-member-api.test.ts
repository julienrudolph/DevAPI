import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchTeamMembers,
  removeTeamMember,
  transferTeamOwnership,
  updateTeamMember,
} from "./team-member-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("team member API client", () => {
  const teamId = "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b";
  const userId = "db181f7c-ef66-4274-b464-a11ec7814c92";

  it("loads validated team members using the session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            userId,
            email: "ada@example.com",
            displayName: "Ada",
            role: "editor",
            joinedAt: "2026-07-30T08:00:00.000Z",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchTeamMembers(teamId, "session-token")).resolves.toHaveLength(
      1,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/teams/${teamId}/members`,
      { headers: { Authorization: "Bearer session-token" } },
    );
  });

  it("updates and removes a member through authenticated routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateTeamMember(teamId, userId, { role: "viewer" }, "token");
    await removeTeamMember(teamId, userId, "token");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/v1/teams/${teamId}/members/${userId}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ role: "viewer" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/v1/teams/${teamId}/members/${userId}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("transfers ownership through the authenticated route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await transferTeamOwnership(
      teamId,
      { newOwnerUserId: userId },
      "token",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/teams/${teamId}/ownership-transfer`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ newOwnerUserId: userId }),
      }),
    );
  });
});
