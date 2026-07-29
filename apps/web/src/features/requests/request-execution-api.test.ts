import { afterEach, describe, expect, it, vi } from "vitest";

import {
  executeRequest,
  RequestExecutionError,
} from "./request-execution-api";

afterEach(() => vi.unstubAllGlobals());

describe("request execution API", () => {
  it("sends enabled parameters and headers through the authenticated API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
          body: '{"ok":true}',
          durationMs: 42,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeRequest(
      {
        request: {
          name: "Health",
          method: "GET",
          url: "{{baseUrl}}/health",
          queryParams: [
            {
              id: "e5c539a4-3fa9-4bc4-b6dc-acba97f1c9a3",
              key: "verbose",
              value: "true",
              enabled: true,
            },
          ],
          headers: [
            {
              id: "b1eab850-761b-4530-9c4c-ee22c42d39bb",
              key: "Accept",
              value: "application/json",
              enabled: true,
            },
          ],
          body: { type: "none" },
        },
        auth: { type: "none" },
        variables: [
          {
            id: "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8",
            environmentId: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
            key: "baseUrl",
            value: "https://api.example.com",
            scope: "shared",
            version: 1,
          },
        ],
      },
      "session-token",
    );

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/execute",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
        }),
        body: expect.stringContaining("verbose=true"),
      }),
    );
  });

  it("exposes the safe proxy error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "UNSAFE_TARGET",
            message: "Private Netzwerkziele sind nicht erlaubt.",
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(
      executeRequest(
        {
          request: {
            name: "Internal",
            method: "GET",
            url: "http://127.0.0.1",
            queryParams: [],
            headers: [],
            body: { type: "none" },
          },
          auth: { type: "none" },
          variables: [],
        },
        "session-token",
      ),
    ).rejects.toBeInstanceOf(RequestExecutionError);
  });

  it.each([
    [
      { type: "bearer" as const, token: "secret-token" },
      "Bearer secret-token",
    ],
    [
      {
        type: "basic" as const,
        username: "jörg",
        password: "päss",
      },
      `Basic ${btoa(
        String.fromCharCode(
          ...new TextEncoder().encode("jörg:päss"),
        ),
      )}`,
    ],
  ])("adds %s credentials only to the execution payload", async (auth, expected) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 200,
          statusText: "OK",
          headers: {},
          body: "",
          durationMs: 10,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await executeRequest(
      {
        request: {
          name: "Private",
          method: "GET",
          url: "https://api.example.com/private",
          queryParams: [],
          headers: [],
          body: { type: "none" },
        },
        auth,
        variables: [],
      },
      "session-token",
    );

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(options.body))).toMatchObject({
      headers: [
        expect.objectContaining({
          key: "Authorization",
          value: expected,
        }),
      ],
    });
  });
});
