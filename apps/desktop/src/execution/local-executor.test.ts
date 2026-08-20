import type { ExecuteRequest } from "@api-client/contracts";
import { describe, expect, it } from "vitest";

import {
  executeLocalHttpRequest,
  RedirectLimitError,
  ResponseTooLargeError,
  type Transport,
} from "./local-executor.js";
import { UnsafeLocalTargetError } from "../security/local-target-policy.js";

const input: ExecuteRequest = {
  method: "GET",
  url: "http://devserver.local/start",
  headers: [],
};

const resolver = async (hostname: string) => [
  {
    address: hostname === "metadata.example" ? "169.254.169.254" : "127.0.0.1",
    family: 4,
  },
];

function stream(...chunks: string[]): AsyncIterable<Uint8Array> {
  return (async function* () {
    for (const chunk of chunks) yield new TextEncoder().encode(chunk);
  })();
}

describe("executeLocalHttpRequest", () => {
  it("pins the transport to the validated local address", async () => {
    const seenAddresses: string[] = [];
    const transport: Transport = async (request) => {
      seenAddresses.push(request.address!);
      return {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: stream('{"ok":true}'),
      };
    };
    const response = await executeLocalHttpRequest(input, {
      resolver,
      transport,
    });
    expect(seenAddresses).toEqual(["127.0.0.1"]);
    expect(response.body).toBe('{"ok":true}');
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "forwards method, body and enabled headers for %s",
    async (method) => {
      const requests: Parameters<Transport>[0][] = [];
      const transport: Transport = async (request) => {
        requests.push(request);
        return {
          status: 204,
          statusText: "No Content",
          headers: {},
          body: stream(),
        };
      };

      await executeLocalHttpRequest(
        {
          method,
          url: "http://devserver.local/resource",
          headers: [
            {
              id: "172075c3-83a8-4696-a7a6-e993f1f4a325",
              key: "Content-Type",
              value: "application/json",
              enabled: true,
            },
            {
              id: "f48c8753-c539-48b8-8ca9-553c72476dbc",
              key: "X-Disabled",
              value: "not-sent",
              enabled: false,
            },
          ],
          body: '{"ok":true}',
        },
        { resolver, transport },
      );

      expect(requests[0]).toMatchObject({
        method,
        body: '{"ok":true}',
        headers: { "content-type": "application/json" },
      });
      expect(requests[0]?.headers).not.toHaveProperty("x-disabled");
    },
  );

  it("never forwards a body with GET", async () => {
    const requests: Parameters<Transport>[0][] = [];
    const transport: Transport = async (request) => {
      requests.push(request);
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: stream(),
      };
    };

    await executeLocalHttpRequest(
      { ...input, body: '{"ignored":true}' },
      { resolver, transport },
    );

    expect(requests[0]?.body).toBeUndefined();
  });

  it("revalidates and blocks a redirect to a cloud metadata address", async () => {
    const transport: Transport = async () => ({
      status: 302,
      statusText: "Found",
      headers: { location: "http://metadata.example/latest" },
      body: stream(),
    });
    await expect(
      executeLocalHttpRequest(input, { resolver, transport }),
    ).rejects.toBeInstanceOf(UnsafeLocalTargetError);
  });

  it("limits redirect chains", async () => {
    const transport: Transport = async ({ url }) => ({
      status: 302,
      statusText: "Found",
      headers: { location: `${url.origin}/again` },
      body: stream(),
    });
    await expect(
      executeLocalHttpRequest(input, { resolver, transport, maxRedirects: 1 }),
    ).rejects.toBeInstanceOf(RedirectLimitError);
  });

  it("aborts a hanging transport once the timeout elapses", async () => {
    const transport: Transport = ({ signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });

    await expect(
      executeLocalHttpRequest(input, { resolver, transport, timeoutMs: 5 }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("routes through the resolved proxy without resolving DNS itself", async () => {
    let resolverCalled = false;
    const proxyResolver = async () => {
      resolverCalled = true;
      return [{ address: "127.0.0.1", family: 4 }];
    };
    const requests: Parameters<Transport>[0][] = [];
    const transport: Transport = async (request) => {
      requests.push(request);
      return { status: 200, statusText: "OK", headers: {}, body: stream() };
    };

    await executeLocalHttpRequest(input, {
      resolver: proxyResolver,
      transport,
      resolveProxy: async () => "http://proxy.corp.example:8080",
    });

    expect(resolverCalled).toBe(false);
    expect(requests[0]).toMatchObject({
      proxyUrl: "http://proxy.corp.example:8080",
      address: undefined,
    });
  });

  it("connects directly and resolves DNS when resolveProxy reports no proxy", async () => {
    const requests: Parameters<Transport>[0][] = [];
    const transport: Transport = async (request) => {
      requests.push(request);
      return { status: 200, statusText: "OK", headers: {}, body: stream() };
    };

    await executeLocalHttpRequest(input, {
      resolver,
      transport,
      resolveProxy: async () => undefined,
    });

    expect(requests[0]).toMatchObject({
      proxyUrl: undefined,
      address: "127.0.0.1",
    });
  });

  it("still blocks a literal cloud-metadata IP written directly in the URL when proxied", async () => {
    const transport: Transport = async () => ({
      status: 200,
      statusText: "OK",
      headers: {},
      body: stream(),
    });

    await expect(
      executeLocalHttpRequest(
        { method: "GET", url: "http://169.254.169.254/latest/meta-data/", headers: [] },
        {
          resolver,
          transport,
          resolveProxy: async () => "http://proxy.corp.example:8080",
        },
      ),
    ).rejects.toBeInstanceOf(UnsafeLocalTargetError);
  });

  it("stops responses that exceed the byte limit", async () => {
    const transport: Transport = async () => ({
      status: 200,
      statusText: "OK",
      headers: {},
      body: stream("1234", "5678"),
    });
    await expect(
      executeLocalHttpRequest(input, {
        resolver,
        transport,
        maxResponseBytes: 6,
      }),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
  });
});
