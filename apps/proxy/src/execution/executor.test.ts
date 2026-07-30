import type { ExecuteRequest } from "@api-client/contracts";
import { describe, expect, it } from "vitest";

import {
  executeHttpRequest,
  RedirectLimitError,
  ResponseTooLargeError,
  type Transport,
} from "./executor.js";
import { UnsafeTargetError } from "../security/target-policy.js";

const input: ExecuteRequest = {
  method: "GET",
  url: "https://public.example/start",
  headers: [],
};

const resolver = async (hostname: string) => [
  {
    address: hostname === "internal.example" ? "127.0.0.1" : "93.184.216.34",
    family: 4,
  },
];

function stream(...chunks: string[]): AsyncIterable<Uint8Array> {
  return (async function* () {
    for (const chunk of chunks) yield new TextEncoder().encode(chunk);
  })();
}

describe("executeHttpRequest", () => {
  it("pins the transport to the validated address", async () => {
    const seenAddresses: string[] = [];
    const transport: Transport = async (request) => {
      seenAddresses.push(request.address);
      return {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: stream('{"ok":true}'),
      };
    };
    const response = await executeHttpRequest(input, {
      resolver,
      transport,
    });
    expect(seenAddresses).toEqual(["93.184.216.34"]);
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

      await executeHttpRequest(
        {
          method,
          url: "https://public.example/resource",
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

    await executeHttpRequest(
      { ...input, body: '{"ignored":true}' },
      { resolver, transport },
    );

    expect(requests[0]?.body).toBeUndefined();
  });

  it("revalidates and blocks an internal redirect", async () => {
    const transport: Transport = async () => ({
      status: 302,
      statusText: "Found",
      headers: { location: "http://internal.example/admin" },
      body: stream(),
    });
    await expect(
      executeHttpRequest(input, { resolver, transport }),
    ).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it("limits redirect chains", async () => {
    const transport: Transport = async ({ url }) => ({
      status: 302,
      statusText: "Found",
      headers: { location: `${url.origin}/again` },
      body: stream(),
    });
    await expect(
      executeHttpRequest(input, { resolver, transport, maxRedirects: 1 }),
    ).rejects.toBeInstanceOf(RedirectLimitError);
  });

  it("stops responses that exceed the byte limit", async () => {
    const transport: Transport = async () => ({
      status: 200,
      statusText: "OK",
      headers: {},
      body: stream("1234", "5678"),
    });
    await expect(
      executeHttpRequest(input, {
        resolver,
        transport,
        maxResponseBytes: 6,
      }),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
  });
});
