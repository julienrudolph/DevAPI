import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpRequestExecutor } from "./http-request-executor.js";

afterEach(() => vi.unstubAllGlobals());

describe("HttpRequestExecutor", () => {
  it("keeps the internal service token on the API-to-proxy hop", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 204,
          statusText: "No Content",
          headers: {},
          body: "",
          durationMs: 12,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const executor = new HttpRequestExecutor(
      "http://proxy:3002",
      "internal-token",
    );

    await executor.execute(
      {
        method: "GET",
        url: "https://api.example.com/health",
        headers: [],
      },
      { correlationId: "3ac6a7df-5e80-427d-a6e4-d48427ac924d" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://proxy:3002/v1/execute"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer internal-token",
          "X-Correlation-Id": "3ac6a7df-5e80-427d-a6e4-d48427ac924d",
        }),
      }),
    );
  });
});
