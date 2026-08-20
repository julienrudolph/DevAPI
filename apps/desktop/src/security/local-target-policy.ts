import { lookup } from "node:dns/promises";

import ipaddr from "ipaddr.js";

// Inverse of apps/proxy/src/security/target-policy.ts (AGENTS.md 11.1a):
// private, loopback, and link-local ranges are the whole point of local
// execution, so they are allowed here instead of blocked. Cloud metadata
// endpoints stay blocked regardless, since they typically live in the
// link-local range this policy otherwise allows.
const blockedHostnames = new Set(["metadata.google.internal", "metadata"]);

const blockedAddresses = new Set([
  "169.254.169.254", // AWS / GCP / Azure / DigitalOcean metadata
  "fd00:ec2::254", // AWS IMDSv2 IPv6 metadata
]);

const allowedRanges = new Set([
  "unicast",
  "private",
  "loopback",
  "linkLocal",
  "uniqueLocal",
  "carrierGradeNat",
]);

export type TargetResolver = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<readonly { address: string; family: number }[]>;

export class UnsafeLocalTargetError extends Error {
  constructor(message = "Das Ziel ist aus Sicherheitsgründen nicht erlaubt.") {
    super(message);
    this.name = "UnsafeLocalTargetError";
  }
}

export function assertAllowedLocalIp(address: string): void {
  if (!ipaddr.isValid(address)) throw new UnsafeLocalTargetError();
  if (blockedAddresses.has(address)) throw new UnsafeLocalTargetError();
  const parsed = ipaddr.process(address);
  if (!allowedRanges.has(parsed.range())) throw new UnsafeLocalTargetError();
}

export function parseAllowedLocalUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeLocalTargetError("Die Ziel-URL ist ungültig.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeLocalTargetError("Nur HTTP und HTTPS sind erlaubt.");
  }
  if (url.username || url.password) {
    throw new UnsafeLocalTargetError(
      "Zugangsdaten in der URL sind nicht erlaubt.",
    );
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (blockedHostnames.has(hostname)) {
    throw new UnsafeLocalTargetError();
  }
  return url;
}

export async function resolveLocalTarget(
  rawUrl: string,
  resolver: TargetResolver = (hostname, options) => lookup(hostname, options),
): Promise<{ url: URL; addresses: string[] }> {
  const url = parseAllowedLocalUrl(rawUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (ipaddr.isValid(hostname)) {
    assertAllowedLocalIp(hostname);
    return { url, addresses: [hostname] };
  }

  const results = await resolver(hostname, { all: true, verbatim: true });
  if (results.length === 0) throw new UnsafeLocalTargetError();
  const addresses = results.map(({ address }) => address);
  addresses.forEach(assertAllowedLocalIp);
  return { url, addresses };
}

// Used for a target routed through a configured upstream proxy (AGENTS.md
// 11.1b): the proxy resolves DNS itself for the CONNECT tunnel, so our own
// resolved-address check neither reflects the real connection nor protects
// against rebinding for this hop. The cheap, resolution-free checks (host
// blocklist, protocol, and a literal IP written directly in the URL) still
// apply regardless.
export function parseAllowedProxiedLocalUrl(rawUrl: string): URL {
  const url = parseAllowedLocalUrl(rawUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(hostname)) assertAllowedLocalIp(hostname);
  return url;
}
