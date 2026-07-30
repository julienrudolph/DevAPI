import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { RequestRepository } from "./domain/request-repository.js";
import type { TeamMemberRepository } from "./domain/team-member-repository.js";
import type { WorkspaceRepository } from "./domain/workspace-repository.js";

const actor = {
  id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  accessToken: "verified-token",
};
const teamId = "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b";
const targetUserId = "db181f7c-ef66-4274-b464-a11ec7814c92";
const member = {
  userId: targetUserId,
  email: "ada@example.com",
  displayName: "Ada",
  role: "editor" as const,
  joinedAt: "2026-07-30T08:00:00.000Z",
};
const requests: RequestRepository = {
  find: async () => null,
  update: async () => ({ kind: "not-found" }),
};
const workspaces: WorkspaceRepository = {
  list: async () => [],
  getTree: async () => null,
  create: async () => {
    throw new Error("not used");
  },
  createCollection: async () => null,
  createFolder: async () => null,
  createRequest: async () => null,
};
const teamMembers: TeamMemberRepository = {
  list: async () => [member],
  update: async () => true,
  remove: async () => true,
};

describe("team member routes", () => {
  it("lists members visible to the owner repository", async () => {
    const app = buildApp({
      authenticate: async () => actor,
      requests,
      workspaces,
      teamMembers,
    });
    const response = await app.inject({
      method: "GET",
      url: `/v1/teams/${teamId}/members`,
      headers: { authorization: "Bearer verified-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([member]);
    await app.close();
  });

  it("uses the authenticated actor when changing a role", async () => {
    let received: unknown;
    const app = buildApp({
      authenticate: async () => actor,
      requests,
      workspaces,
      teamMembers: {
        ...teamMembers,
        update: async (command) => {
          received = command;
          return true;
        },
      },
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/teams/${teamId}/members/${targetUserId}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { role: "viewer" },
    });
    expect(response.statusCode).toBe(204);
    expect(received).toMatchObject({
      teamId,
      targetUserId,
      role: "viewer",
      userId: actor.id,
      accessToken: actor.accessToken,
    });
    await app.close();
  });

  it("rejects attempts to assign owner through the route", async () => {
    const app = buildApp({
      authenticate: async () => actor,
      requests,
      workspaces,
      teamMembers,
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/teams/${teamId}/members/${targetUserId}`,
      headers: { authorization: "Bearer verified-token" },
      payload: { role: "owner" },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("does not reveal whether a member exists to a non-owner", async () => {
    const app = buildApp({
      authenticate: async () => actor,
      requests,
      workspaces,
      teamMembers: {
        ...teamMembers,
        remove: async () => null,
      },
    });
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/teams/${teamId}/members/${targetUserId}`,
      headers: { authorization: "Bearer verified-token" },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
