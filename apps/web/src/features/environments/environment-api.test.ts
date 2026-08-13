import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEnvironmentVariable,
  deleteEnvironment,
  deleteEnvironmentVariable,
  EnvironmentConflictError,
  EnvironmentVariableConflictError,
  fetchEnvironments,
  updateEnvironment,
  updateEnvironmentVariable,
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

  it("maps stale variable updates to a typed conflict", async () => {
    const variableId = "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "ENVIRONMENT_VARIABLE_VERSION_CONFLICT",
            message: "Die Variable wurde zwischenzeitlich geändert.",
            expectedVersion: 1,
            currentVersion: 2,
            current: {
              id: variableId,
              environmentId: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
              key: "baseUrl",
              value: "https://new.example.com",
              scope: "shared",
              version: 2,
            },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(
      updateEnvironmentVariable(
        variableId,
        { value: "https://local.example.com", expectedVersion: 1 },
        "session-token",
      ),
    ).rejects.toBeInstanceOf(EnvironmentVariableConflictError);
  });

  it("renames a variable's key through the write request", async () => {
    const variableId = "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: variableId,
          environmentId: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
          key: "newKey",
          value: "value",
          scope: "shared",
          version: 2,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateEnvironmentVariable(
      variableId,
      { key: "newKey", expectedVersion: 1 },
      "session-token",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/environment-variables/${variableId}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ key: "newKey", expectedVersion: 1 }),
      }),
    );
  });

  it("deletes a variable through the authenticated route", async () => {
    const variableId = "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteEnvironmentVariable(
      variableId,
      { expectedVersion: 1 },
      "session-token",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/environment-variables/${variableId}`,
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
    );
  });

  it("renames an environment through the authenticated route", async () => {
    const environmentId = "a768f717-d11f-4ce0-a72b-8e1d439222b0";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: environmentId,
          workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
          name: "Staging",
          version: 2,
          variables: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateEnvironment(
      environmentId,
      { name: "Staging", expectedVersion: 1 },
      "session-token",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/environments/${environmentId}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Staging", expectedVersion: 1 }),
      }),
    );
  });

  it("maps stale environment renames to a typed conflict", async () => {
    const environmentId = "a768f717-d11f-4ce0-a72b-8e1d439222b0";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "ENVIRONMENT_VERSION_CONFLICT",
            message: "Die Umgebung wurde zwischenzeitlich geändert.",
            expectedVersion: 1,
            currentVersion: 2,
            current: {
              id: environmentId,
              workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
              name: "Prod",
              version: 2,
              variables: [],
            },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(
      updateEnvironment(
        environmentId,
        { name: "Staging", expectedVersion: 1 },
        "session-token",
      ),
    ).rejects.toBeInstanceOf(EnvironmentConflictError);
  });

  it("deletes an environment through the authenticated route", async () => {
    const environmentId = "a768f717-d11f-4ce0-a72b-8e1d439222b0";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteEnvironment(
      environmentId,
      { expectedVersion: 1 },
      "session-token",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/environments/${environmentId}`,
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
    );
  });
});
