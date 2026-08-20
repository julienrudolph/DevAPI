import { Agent, ProxyAgent, request } from "undici";
import { STATUS_CODES } from "node:http";
import type { Dispatcher } from "undici";
import type { LookupFunction } from "node:net";

import type { Transport, TransportResponse } from "./local-executor.js";

// Mirrors apps/proxy/src/execution/undici-transport.ts: pins the connection
// to the address the security policy already validated, so the underlying
// HTTP client can never re-resolve DNS and reintroduce a rebinding window.
// A proxied hop (AGENTS.md 11.1b) can't be pinned the same way, since the
// upstream proxy resolves DNS itself for its own CONNECT tunnel.
export const localUndiciTransport: Transport = async ({
  url,
  address,
  proxyUrl,
  method,
  headers,
  body,
  signal,
}): Promise<TransportResponse> => {
  // proxyTunnel: false uses plain absolute-URI forwarding for an http://
  // target instead of undici's default of always tunneling via CONNECT -
  // the traditional forward-proxy method that's universally supported,
  // vs. CONNECT which some proxies only allow for https:// (443). An
  // https:// target still tunnels via CONNECT regardless, since that's
  // the only way to reach it through a proxy at all.
  const dispatcher: Dispatcher = proxyUrl
    ? new ProxyAgent({ uri: proxyUrl, proxyTunnel: false })
    : new Agent({
        connect: {
          lookup: createPinnedLookup(address!, address!.includes(":") ? 6 : 4),
        },
      });

  try {
    const response = await request(url, {
      dispatcher,
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
      body: closeAfter(response.body, dispatcher),
    };
  } catch (error) {
    await dispatcher.close();
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
  dispatcher: Dispatcher,
): AsyncIterable<Uint8Array> {
  try {
    yield* body;
  } finally {
    await dispatcher.close();
  }
}
