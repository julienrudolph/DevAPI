import { Agent, request } from "undici";

import type {
  Transport,
  TransportResponse,
} from "./executor.js";

export const undiciTransport: Transport = async ({
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
      lookup(_hostname, _options, callback) {
        callback(null, address, family);
      },
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
      statusText: "",
      headers: response.headers,
      body: closeAfter(response.body, agent),
    };
  } catch (error) {
    await agent.close();
    throw error;
  }
};

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
