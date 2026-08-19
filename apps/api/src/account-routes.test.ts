import { describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import type { AccountRepository } from "./domain/account-repository.js";
import type { RequestRepository } from "./domain/request-repository.js";
import type { WorkspaceRepository } from "./domain/workspace-repository.js";

const user = {
  id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  accessToken: "verified-token",
  email: "ada@example.test",
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
const account: AccountRepository = {
  listBlockingTeams: async () => [],
  deleteAccount: async () => undefined,
};

describe("account deletion routes", () => {
  it("lists teams that would block self-deletion", async () => {
    const blocking = [{ id: "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b", name: "Solo Team" }];
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
      account: { ...account, listBlockingTeams: async () => blocking },
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/account/deletion-check",
      headers: { authorization: "Bearer verified-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(blocking);
    await app.close();
  });

  it("deletes the caller's own account once the confirmation email matches", async () => {
    const deleteAccount = vi.fn(async () => undefined);
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
      account: { ...account, deleteAccount },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/account/delete",
      headers: { authorization: "Bearer verified-token" },
      payload: { confirmEmail: "ada@example.test" },
    });
    expect(response.statusCode).toBe(204);
    expect(deleteAccount).toHaveBeenCalledWith(user.id);
    await app.close();
  });

  it("rejects a confirmation email that does not match the caller's own", async () => {
    const deleteAccount = vi.fn(async () => undefined);
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
      account: { ...account, deleteAccount },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/account/delete",
      headers: { authorization: "Bearer verified-token" },
      payload: { confirmEmail: "someone-else@example.test" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "EMAIL_CONFIRMATION_MISMATCH",
    });
    expect(deleteAccount).not.toHaveBeenCalled();
    await app.close();
  });

  it("blocks self-deletion while the caller is a team's sole owner", async () => {
    const blocking = [{ id: "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b", name: "Solo Team" }];
    const deleteAccount = vi.fn(async () => undefined);
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
      account: {
        listBlockingTeams: async () => blocking,
        deleteAccount,
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/account/delete",
      headers: { authorization: "Bearer verified-token" },
      payload: { confirmEmail: "ada@example.test" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "SOLE_OWNER_OF_TEAMS",
      teams: blocking,
    });
    expect(deleteAccount).not.toHaveBeenCalled();
    await app.close();
  });

  it("reports account deletion as unavailable when not configured", async () => {
    const app = buildApp({
      authenticate: async () => user,
      requests,
      workspaces,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/account/delete",
      headers: { authorization: "Bearer verified-token" },
      payload: { confirmEmail: "ada@example.test" },
    });
    expect(response.statusCode).toBe(503);
    await app.close();
  });

  it("rejects deletion without a verified session", async () => {
    const app = buildApp({
      authenticate: async () => null,
      requests,
      workspaces,
      account,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/account/delete",
      payload: { confirmEmail: "ada@example.test" },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
