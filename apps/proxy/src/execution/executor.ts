import type {
  ExecuteRequest,
  ProxyResponse,
} from "@api-client/contracts";

import {
  parseAllowedProxiedUrl,
  resolvePublicTarget,
  type TargetResolver,
} from "../security/target-policy.js";
import {
  selectUpstreamProxy,
  type UpstreamProxyConfig,
} from "../security/proxy-config.js";
import {
  sanitizeRequestHeaders,
  sanitizeResponseHeaders,
} from "../security/headers.js";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export interface TransportRequest {
  url: URL;
  address?: string;
  proxyUrl?: string;
  method: ExecuteRequest["method"];
  headers: Record<string, string>;
  body?: string;
  signal: AbortSignal;
}

export interface TransportResponse {
  status: number;
  statusText: string;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
}

export type Transport = (
  request: TransportRequest,
) => Promise<TransportResponse>;

export interface ExecutionOptions {
  resolver?: TargetResolver;
  transport: Transport;
  maxRedirects?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
  upstreamProxy?: UpstreamProxyConfig;
}

export class ResponseTooLargeError extends Error {
  constructor() {
    super("Die Response überschreitet das erlaubte Größenlimit.");
    this.name = "ResponseTooLargeError";
  }
}

export class RedirectLimitError extends Error {
  constructor() {
    super("Die maximale Anzahl an Redirects wurde überschritten.");
    this.name = "RedirectLimitError";
  }
}

export async function executeHttpRequest(
  input: ExecuteRequest,
  options: ExecutionOptions,
): Promise<ProxyResponse> {
  const startedAt = performance.now();
  const maxRedirects = options.maxRedirects ?? 3;
  const maxResponseBytes = options.maxResponseBytes ?? 5 * 1024 * 1024;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

  let currentUrl = input.url;
  let method = input.method;
  let body = input.body;
  const headers = sanitizeRequestHeaders(input.headers);

  try {
    for (let redirectCount = 0; ; redirectCount += 1) {
      const proxyUrl = options.upstreamProxy
        ? selectUpstreamProxy(options.upstreamProxy, new URL(currentUrl))
        : undefined;
      const target = proxyUrl
        ? { url: parseAllowedProxiedUrl(currentUrl) }
        : await resolvePublicTarget(currentUrl, options.resolver);
      const response = await options.transport({
        url: target.url,
        address: "addresses" in target ? target.addresses[0] : undefined,
        proxyUrl,
        method,
        headers,
        body: method === "GET" ? undefined : body,
        signal: controller.signal,
      });

      const location = headerValue(response.headers, "location");
      if (redirectStatuses.has(response.status) && location) {
        await discardBody(response.body);
        if (redirectCount >= maxRedirects) throw new RedirectLimitError();
        currentUrl = new URL(location, target.url).toString();
        if (
          response.status === 303 ||
          ((response.status === 301 || response.status === 302) &&
            method === "POST")
        ) {
          method = "GET";
          body = undefined;
          delete headers["content-type"];
        }
        continue;
      }

      const responseBody = await readBody(response.body, maxResponseBytes);
      return {
        status: response.status,
        statusText: response.statusText,
        headers: sanitizeResponseHeaders(response.headers),
        body: new TextDecoder().decode(responseBody),
        durationMs: Math.round(performance.now() - startedAt),
      };
    }
  } finally {
    clearTimeout(timeout);
  }
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  requestedName: string,
): string | undefined {
  const entry = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === requestedName,
  );
  const value = entry?.[1];
  return Array.isArray(value) ? value[0] : value;
}

async function readBody(
  body: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new ResponseTooLargeError();
    chunks.push(chunk);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function discardBody(body: AsyncIterable<Uint8Array>): Promise<void> {
  for await (const _chunk of body) {
    // The transport can reuse or close the connection after the body is drained.
  }
}
