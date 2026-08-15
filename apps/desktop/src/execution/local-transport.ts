import { Agent, request } from "undici";
import { STATUS_CODES } from "node:http";
import type { LookupFunction } from "node:net";

import type { Transport, TransportResponse } from "./local-executor.js";

// Mirrors apps/proxy/src/execution/undici-transport.ts: pins the connection
// to the address the security policy already validated, so the underlying
// HTTP client can never re-resolve DNS and reintroduce a rebinding window.
export const localUndiciTransport: Transport = async ({
  url,
  address,
  method,
  headers,
  body,
  signal,
}): Promise<TransportResponse> => {
  const family = address.includes(":") ? 6 : 4;
  const agent = new Agent({
    connect: {
      lookup: createPinnedLookup(address, family),
    },
  });

  try {
    const response = await request(url, {
      dispatcher: agent,
      method,
      headers,
      body,
      signal,
      headersTimeout: 10_000,
      bodyTimeout: 15_000,
    });

    return {
      status: response.statusCode,
      statusText: STATUS_CODES[response.statusCode] ?? "",
      headers: response.headers,
      body: closeAfter(response.body, agent),
    };
  } catch (error) {
    await agent.close();
    throw error;
  }
};

export function createPinnedLookup(
  address: string,
  family: 4 | 6,
): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };
}

async function* closeAfter(
  body: AsyncIterable<Uint8Array>,
  agent: Agent,
): AsyncIterable<Uint8Array> {
  try {
    yield* body;
  } finally {
    await agent.close();
  }
}
