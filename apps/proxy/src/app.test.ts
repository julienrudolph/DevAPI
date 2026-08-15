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
  it("protects operational metrics", async () => {
    const app = buildProxyApp({ metricsToken: "metrics-secret" });
    expect((await app.inject({ method: "GET", url: "/ready" })).statusCode).toBe(
      200,
    );
    expect(
      (await app.inject({ method: "GET", url: "/metrics" })).statusCode,
    ).toBe(401);
    const metrics = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: "Bearer metrics-secret" },
    });
    expect(metrics.body).toContain("devapi_proxy_http_requests_total");
    await app.close();
  });

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

  it("echoes an inbound correlation ID as its own request ID", async () => {
    const app = buildProxyApp({
      transport,
      authenticate: () => true,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: {
        authorization: "Bearer test",
        "x-correlation-id": "3ac6a7df-5e80-427d-a6e4-d48427ac924d",
      },
      payload: { method: "GET", url: "https://1.1.1.1", headers: [] },
    });
    expect(response.headers["x-request-id"]).toBe(
      "3ac6a7df-5e80-427d-a6e4-d48427ac924d",
    );
    await app.close();
  });

  it("falls back to a generated request ID without an inbound correlation ID", async () => {
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
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.headers["x-request-id"]).not.toBe(
      "3ac6a7df-5e80-427d-a6e4-d48427ac924d",
    );
    await app.close();
  });

  it("maps an aborted target request to 504 TARGET_TIMEOUT", async () => {
    const abortingTransport: Transport = async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    };
    const app = buildProxyApp({
      transport: abortingTransport,
      authenticate: () => true,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { authorization: "Bearer test" },
      payload: { method: "GET", url: "https://1.1.1.1", headers: [] },
    });
    expect(response.statusCode).toBe(504);
    expect(response.json()).toMatchObject({ code: "TARGET_TIMEOUT" });
    await app.close();
  });

  it("rejects an oversized request body before executing it", async () => {
    const app = buildProxyApp({
      transport,
      authenticate: () => true,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { authorization: "Bearer test" },
      payload: {
        method: "POST",
        url: "https://1.1.1.1",
        headers: [],
        body: "x".repeat(1_100_001),
      },
    });
    expect(response.statusCode).toBe(413);
    await app.close();
  });

  it("rejects excess global concurrency without starting another transport", async () => {
    let releaseTransport!: () => void;
    let markTransportStarted!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseTransport = resolve;
    });
    const transportStarted = new Promise<void>((resolve) => {
      markTransportStarted = resolve;
    });
    let started = 0;
    const blockingTransport: Transport = async () => {
      started += 1;
      markTransportStarted();
      await gate;
      return transport({
        url: new URL("https://1.1.1.1"),
        address: "1.1.1.1",
        method: "GET",
        headers: {},
        signal: new AbortController().signal,
      });
    };
    const app = buildProxyApp({
      transport: blockingTransport,
      authenticate: () => true,
      maxConcurrentRequests: 1,
    });
    const first = app
      .inject({
        method: "POST",
        url: "/v1/execute",
        headers: { authorization: "Bearer test" },
        payload: { method: "GET", url: "https://1.1.1.1", headers: [] },
      })
      .then((response) => response);
    await transportStarted;

    const second = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { authorization: "Bearer test" },
      payload: { method: "GET", url: "https://1.1.1.1", headers: [] },
    });
    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({ code: "PROXY_CAPACITY_LIMITED" });
    expect(started).toBe(1);

    releaseTransport();
    expect((await first).statusCode).toBe(200);
    await app.close();
  });
});
