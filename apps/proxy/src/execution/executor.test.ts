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
