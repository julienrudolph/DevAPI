import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { RequestRepository } from "./domain/request-repository.js";
import type { WorkspaceRepository } from "./domain/workspace-repository.js";

const user = {
  id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  accessToken: "verified-token",
};
const teamId = "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b";
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

describe("invitation routes", () => {
  it("creates a single-use invitation for an authorized owner", async () => {
    const invitation = {
      id: "95da6097-0742-4164-9c9a-75dc64d2cd8f",
      teamId,
      role: "editor" as const,
      token: "a".repeat(64),
      expiresAt: "2026-08-05T12:00:00.000Z",
    };
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
      invitations: {
        create: async (command) => {
          expect(command).toMatchObject({
            teamId,
            role: "editor",
            userId: user.id,
            accessToken: user.accessToken,
          });
          return invitation;
        },
        accept: async () => null,
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/v1/teams/${teamId}/invitations`,
      headers: { authorization: "Bearer verified-token" },
      payload: { role: "editor" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(invitation);
    await app.close();
  });

  it("does not allow an owner role to be assigned by invitation", async () => {
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
    });
    const response = await app.inject({
      method: "POST",
      url: `/v1/teams/${teamId}/invitations`,
      headers: { authorization: "Bearer verified-token" },
      payload: { role: "owner" },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("accepts a valid token and hides invalid or expired tokens", async () => {
    const acceptedTokens: string[] = [];
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
      invitations: {
        create: async () => null,
        accept: async (command) => {
          acceptedTokens.push(command.token);
          return command.token.startsWith("a") ? teamId : null;
        },
      },
    });

    const accepted = await app.inject({
      method: "POST",
      url: "/v1/invitations/accept",
      headers: { authorization: "Bearer verified-token" },
      payload: { token: "a".repeat(64) },
    });
    const rejected = await app.inject({
      method: "POST",
      url: "/v1/invitations/accept",
      headers: { authorization: "Bearer verified-token" },
      payload: { token: "b".repeat(64) },
    });

    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ teamId });
    expect(rejected.statusCode).toBe(404);
    expect(acceptedTokens).toHaveLength(2);
    await app.close();
  });
});
