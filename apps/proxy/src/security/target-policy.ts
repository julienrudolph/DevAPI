import { lookup } from "node:dns/promises";

import ipaddr from "ipaddr.js";

const blockedHostnames = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

const allowedRanges = new Set(["unicast"]);

export type TargetResolver = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<readonly { address: string; family: number }[]>;

export class UnsafeTargetError extends Error {
  constructor(message = "Das Ziel ist aus Sicherheitsgründen nicht erlaubt.") {
    super(message);
    this.name = "UnsafeTargetError";
  }
}

export function assertPublicIp(address: string): void {
  if (!ipaddr.isValid(address)) throw new UnsafeTargetError();
  const parsed = ipaddr.process(address);
  if (!allowedRanges.has(parsed.range())) throw new UnsafeTargetError();
}

export function parseAllowedUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeTargetError("Die Ziel-URL ist ungültig.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeTargetError("Nur HTTP und HTTPS sind erlaubt.");
  }
  if (url.username || url.password) {
    throw new UnsafeTargetError("Zugangsdaten in der URL sind nicht erlaubt.");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    blockedHostnames.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new UnsafeTargetError();
  }
  return url;
}

export async function resolvePublicTarget(
  rawUrl: string,
  resolver: TargetResolver = (hostname, options) => lookup(hostname, options),
): Promise<{ url: URL; addresses: string[] }> {
  const url = parseAllowedUrl(rawUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (ipaddr.isValid(hostname)) {
    assertPublicIp(hostname);
    return { url, addresses: [hostname] };
  }

  const results = await resolver(hostname, { all: true, verbatim: true });
  if (results.length === 0) throw new UnsafeTargetError();
  const addresses = results.map(({ address }) => address);
  addresses.forEach(assertPublicIp);
  return { url, addresses };
}
