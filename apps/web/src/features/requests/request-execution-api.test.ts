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
        name: "Health",
        method: "GET",
        url: "https://api.example.com/health",
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
          name: "Internal",
          method: "GET",
          url: "http://127.0.0.1",
          queryParams: [],
          headers: [],
          body: { type: "none" },
        },
        "session-token",
      ),
    ).rejects.toBeInstanceOf(RequestExecutionError);
  });
});
