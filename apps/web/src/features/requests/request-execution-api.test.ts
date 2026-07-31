import { afterEach, describe, expect, it, vi } from "vitest";

import {
  executionErrorMessage,
  executeRequest,
  RequestExecutionError,
} from "./request-execution-api";

afterEach(() => vi.unstubAllGlobals());

describe("request execution API", () => {
  const requestId = "fa7596b3-0041-4fe8-9ddf-956e7a107014";

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
        requestId,
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
          requestId,
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

  it("explains DNS failures with actionable guidance", () => {
    expect(executionErrorMessage("TARGET_DNS_FAILED")).toContain(
      "Schreibweise der Domain",
    );
  });

  it("rejects malformed URLs before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      executeRequest(
        {
          requestId,
          request: {
            name: "Invalid",
            method: "GET",
            url: "keine gültige URL",
            queryParams: [],
            headers: [],
            body: { type: "none" },
          },
          auth: { type: "none" },
          variables: [],
        },
        "session-token",
      ),
    ).rejects.toMatchObject({
      code: "INVALID_URL",
      message: expect.stringContaining("URL ist ungültig"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains a non-JSON response from the DevAPI backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Gateway error</html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    await expect(
      executeRequest(
        {
          requestId,
          request: {
            name: "Health",
            method: "GET",
            url: "https://api.example.com",
            queryParams: [],
            headers: [],
            body: { type: "none" },
          },
          auth: { type: "none" },
          variables: [],
        },
        "session-token",
      ),
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: expect.stringContaining("unerwartete Antwort"),
    });
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
        requestId,
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

  it("preserves a manually configured Authorization header", async () => {
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
        requestId,
        request: {
          name: "Private",
          method: "GET",
          url: "https://api.example.com/private",
          queryParams: [],
          headers: [
            {
              id: "b1eab850-761b-4530-9c4c-ee22c42d39bb",
              key: "Authorization",
              value: "Bearer manual-token",
              enabled: true,
            },
          ],
          body: { type: "none" },
        },
        auth: { type: "none" },
        variables: [],
      },
      "session-token",
    );

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(options.body))).toMatchObject({
      headers: [
        expect.objectContaining({
          key: "Authorization",
          value: "Bearer manual-token",
        }),
      ],
    });
  });

  it("adds application/json for a JSON body when no content type is configured", async () => {
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
        requestId,
        request: {
          name: "Create message",
          method: "POST",
          url: "https://api.example.com/messages",
          queryParams: [],
          headers: [],
          body: { type: "json", content: '{"message":"Hallo"}' },
        },
        auth: { type: "none" },
        variables: [],
      },
      "session-token",
    );

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(options.body))).toMatchObject({
      headers: [
        expect.objectContaining({
          key: "Content-Type",
          value: "application/json",
        }),
      ],
    });
  });

  it("preserves an explicitly configured content type", async () => {
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
        requestId,
        request: {
          name: "Create message",
          method: "POST",
          url: "https://api.example.com/messages",
          queryParams: [],
          headers: [
            {
              id: "b1eab850-761b-4530-9c4c-ee22c42d39bb",
              key: "content-type",
              value: "application/vnd.api+json",
              enabled: true,
            },
          ],
          body: { type: "json", content: '{"message":"Hallo"}' },
        },
        auth: { type: "none" },
        variables: [],
      },
      "session-token",
    );

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(options.body)) as {
      headers: Array<{ key: string; value: string }>;
    };
    expect(payload.headers).toEqual([
      expect.objectContaining({
        key: "content-type",
        value: "application/vnd.api+json",
      }),
    ]);
  });

  it("ignores disabled and unfinished header rows", async () => {
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
        requestId,
        request: {
          name: "Headers",
          method: "GET",
          url: "https://api.example.com/headers",
          queryParams: [],
          headers: [
            {
              id: "172075c3-83a8-4696-a7a6-e993f1f4a325",
              key: "X-Enabled",
              value: "yes",
              enabled: true,
            },
            {
              id: "f48c8753-c539-48b8-8ca9-553c72476dbc",
              key: "X-Disabled",
              value: "no",
              enabled: false,
            },
            {
              id: "1fe9ec0d-963d-488c-a555-447478dd7b5f",
              key: " ",
              value: "",
              enabled: true,
            },
          ],
          body: { type: "none" },
        },
        auth: { type: "none" },
        variables: [],
      },
      "session-token",
    );

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(options.body))).toMatchObject({
      headers: [
        expect.objectContaining({
          key: "X-Enabled",
          value: "yes",
        }),
      ],
    });
  });
});
