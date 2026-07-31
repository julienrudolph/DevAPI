import { describe, expect, it } from "vitest";

import { buildProxyApp, classifyTargetFailure } from "./app.js";
import type { Transport } from "./execution/executor.js";

const transport: Transport = async () => ({
  status: 200,
  statusText: "OK",
  headers: { "content-type": "application/json" },
  body: (async function* () {
    yield new TextEncoder().encode('{"ok":true}');
  })(),
});

describe("proxy API", () => {
  it.each([
    ["ENOTFOUND", "TARGET_DNS_FAILED"],
    ["ECONNREFUSED", "TARGET_CONNECTION_REFUSED"],
    ["ENETUNREACH", "TARGET_UNREACHABLE"],
    ["CERT_HAS_EXPIRED", "TARGET_TLS_FAILED"],
  ])("classifies %s target failures without exposing internals", (code, expected) => {
    const failure = classifyTargetFailure(
      new TypeError("fetch failed", {
        cause: Object.assign(new Error("sensitive host detail"), { code }),
      }),
    );

    expect(failure.code).toBe(expected);
    expect(failure.message).not.toContain("sensitive");
  });

  it("requires authentication before execution", async () => {
    const app = buildProxyApp({
      transport,
      authenticate: () => false,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      payload: { method: "GET", url: "https://1.1.1.1", headers: [] },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("executes a validated public request", async () => {
    const app = buildProxyApp({
      transport,
      authenticate: () => true,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { authorization: "Bearer test" },
      payload: { method: "GET", url: "https://1.1.1.1", headers: [] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 200,
      body: '{"ok":true}',
    });
    await app.close();
  });
});
